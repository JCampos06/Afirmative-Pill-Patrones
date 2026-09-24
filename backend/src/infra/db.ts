import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// numeric (precios) e int8 (count) → number; date → 'YYYY-MM-DD' sin zona horaria.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

/**
 * Métricas por request GraphQL (AsyncLocalStorage). Permiten imprimir al
 * final de cada operación cuántos SQL se ejecutaron: la evidencia de que
 * DataLoader evita el problema N+1.
 */
export interface RequestStats {
  queries: number;
  loaderBatches: number;
}

export const requestStats = new AsyncLocalStorage<RequestStats>();

/** Permite silenciar los logs SQL de tareas de fondo repetitivas. */
const sqlLogsMuted = new AsyncLocalStorage<boolean>();

export function withSqlLogsMuted<T>(fn: () => Promise<T>): Promise<T> {
  return sqlLogsMuted.run(true, fn);
}

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  max: env.databasePoolMax,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => logger.error('Error inesperado en el pool de PostgreSQL', err));

function compact(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function preview(params: readonly unknown[]): string {
  if (params.length === 0) return '';
  const text = JSON.stringify(params);
  return text.length > 90 ? `${text.slice(0, 87)}...]` : text;
}

/**
 * Ejecutor de SQL sobre el pool o sobre un cliente dentro de una transacción.
 * Toda consulta pasa por aquí para registrar logs y métricas.
 */
export class Db {
  constructor(private readonly target: pg.Pool | pg.PoolClient) {}

  async rows<T extends pg.QueryResultRow>(text: string, params: readonly unknown[] = []): Promise<T[]> {
    const started = performance.now();
    const result = await this.target.query<T>(text, params as unknown[]);
    const stats = requestStats.getStore();
    if (stats) stats.queries += 1;
    if (env.logSql && !sqlLogsMuted.getStore()) {
      const ms = (performance.now() - started).toFixed(1);
      const sql = compact(text);
      logger.sql(
        `${sql.length > 150 ? `${sql.slice(0, 147)}...` : sql} ` +
          logger.paint('dim', `${preview(params)} → ${result.rowCount ?? 0} filas · ${ms}ms`),
      );
    }
    return result.rows;
  }

  async one<T extends pg.QueryResultRow>(text: string, params: readonly unknown[] = []): Promise<T | null> {
    const rows = await this.rows<T>(text, params);
    return rows[0] ?? null;
  }
}

/** Ejecutor para lecturas simples fuera de transacción. */
export const db = new Db(pool);

/**
 * Ejecuta `fn` dentro de una transacción. Si `fn` lanza (por ejemplo un
 * error de dominio al violar una invariante) se hace ROLLBACK completo.
 */
export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(new Db(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
