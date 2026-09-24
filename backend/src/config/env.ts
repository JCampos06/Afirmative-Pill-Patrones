import { config } from 'dotenv';

config({ quiet: true });

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable de entorno requerida no definida: ${name}`);
  return value;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  databaseSsl: bool(process.env.DATABASE_SSL, true),
  databasePoolMax: int(process.env.DATABASE_POOL_MAX, 10),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  port: int(process.env.PORT, 4000),
  corsOrigin: (process.env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  projectionDelayMs: int(process.env.PROJECTION_DELAY_MS, 1500),
  autoApproveDelayMs: int(process.env.AUTO_APPROVE_DELAY_MS, 4000),
  disableDataLoader: bool(process.env.DISABLE_DATALOADER, false),
  logSql: bool(process.env.LOG_SQL, true),
  introspection: bool(process.env.GRAPHQL_INTROSPECTION, true),
  /** Vercel define VERCEL=1 en sus funciones. */
  isServerless: Boolean(process.env.VERCEL),
} as const;
