/**
 * DATALOADERS — mitigación del problema N+1.
 *
 * Se crea un juego NUEVO de loaders por cada request GraphQL (caché por
 * request, sin fugas de datos entre usuarios). Durante la ejecución,
 * todos los .load(id) de un mismo "tick" se agrupan en UNA sola consulta
 * SQL con `where id = any($1)`.
 *
 * Con DISABLE_DATALOADER=true se desactivan batching y caché para
 * evidenciar el N+1 en la sustentación.
 */
import DataLoader from 'dataloader';
import { env } from '../config/env.js';
import { requestStats } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import {
  categoriesByIds,
  laboratoriesByIds,
  medicationCountsByCategoryIds,
  medicationsByCategoryIds,
  medicationsByIds,
  type CatalogRow,
  type CategoryRow,
  type LaboratoryRow,
} from '../queries/catalog.queries.js';

/** Reordena las filas según las claves pedidas (contrato de DataLoader). */
function alignByKey<K, R>(keys: readonly K[], rows: R[], keyOf: (row: R) => K): (R | null)[] {
  const map = new Map<K, R>();
  for (const row of rows) map.set(keyOf(row), row);
  return keys.map((k) => map.get(k) ?? null);
}

function groupByKey<K, R>(keys: readonly K[], rows: R[], keyOf: (row: R) => K): R[][] {
  const map = new Map<K, R[]>();
  for (const row of rows) {
    const k = keyOf(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return keys.map((k) => map.get(k) ?? []);
}

/** Envuelve la función batch para registrar cada lote en los logs. */
function traced<K, V>(name: string, batchFn: (keys: readonly K[]) => Promise<V[]>) {
  return async (keys: readonly K[]): Promise<V[]> => {
    const stats = requestStats.getStore();
    if (env.disableDataLoader) {
      logger.loader(`${name} · SIN batching (N+1): clave [${keys.join(', ')}] → 1 consulta SQL por clave`);
    } else {
      if (stats) stats.loaderBatches += 1;
      logger.loader(
        `${name} · lote de ${keys.length} ${keys.length === 1 ? 'clave' : 'claves'} [${keys.join(', ')}] → 1 consulta SQL`,
      );
    }
    return batchFn(keys);
  };
}

function loader<K, V>(name: string, batchFn: (keys: readonly K[]) => Promise<V[]>) {
  const enabled = !env.disableDataLoader;
  return new DataLoader<K, V>(traced(name, batchFn), { batch: enabled, cache: enabled });
}

export function createLoaders() {
  return {
    medicationById: loader<number, CatalogRow | null>('medicationById', async (ids) =>
      alignByKey(ids, await medicationsByIds(ids), (r) => r.medication_id),
    ),
    categoryById: loader<number, CategoryRow | null>('categoryById', async (ids) =>
      alignByKey(ids, await categoriesByIds(ids), (r) => r.id),
    ),
    laboratoryById: loader<number, LaboratoryRow | null>('laboratoryById', async (ids) =>
      alignByKey(ids, await laboratoriesByIds(ids), (r) => r.id),
    ),
    medicationsByCategoryId: loader<number, CatalogRow[]>('medicationsByCategoryId', async (ids) =>
      groupByKey(ids, await medicationsByCategoryIds(ids), (r) => r.category_id),
    ),
    medicationCountByCategoryId: loader<number, number>('medicationCountByCategoryId', async (ids) => {
      const counts = new Map((await medicationCountsByCategoryIds(ids)).map((r) => [r.category_id, r.n]));
      return ids.map((id) => counts.get(id) ?? 0);
    }),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
