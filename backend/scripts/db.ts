/**
 * Utilidades de base de datos (se ejecutan con `npm run db:*`).
 *
 *   setup                → aplica migraciones + seeds (idempotente)
 *   reset                → borra todo el esquema y vuelve a ejecutar setup
 *   bundle               → genera database/supabase_setup.sql (todo en un archivo
 *                          para pegarlo en el SQL Editor de Supabase)
 *   rebuild-projections  → reconstruye el read model a partir del write model
 */
import { config } from 'dotenv';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

config({ quiet: true });

const here = dirname(fileURLToPath(import.meta.url));
const databaseDir = join(here, '..', '..', 'database');

function sqlFiles(folder: string): string[] {
  const dir = join(databaseDir, folder);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(dir, f));
}

const orderedFiles = () => [...sqlFiles('migrations'), ...sqlFiles('seed')];

function client(): pg.Client {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL en backend/.env');
  return new pg.Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
}

async function runFiles(files: string[]) {
  const c = client();
  await c.connect();
  try {
    for (const file of files) {
      const rel = file.slice(databaseDir.length + 1);
      process.stdout.write(`  → ${rel} ... `);
      await c.query(readFileSync(file, 'utf8'));
      console.log('ok');
    }
  } finally {
    await c.end();
  }
}

async function setup() {
  console.log('Aplicando migraciones y seeds:');
  await runFiles(orderedFiles());
  const c = client();
  await c.connect();
  const { rows } = await c.query<{ meds: string; cats: string; labs: string; catalog: string }>(`
    select (select count(*) from medications)        as meds,
           (select count(*) from categories)         as cats,
           (select count(*) from laboratories)       as labs,
           (select count(*) from medication_catalog) as catalog`);
  await c.end();
  const r = rows[0];
  console.log(
    `\n✔ Listo: ${r.meds} medicamentos, ${r.cats} categorías, ${r.labs} laboratorios, ${r.catalog} filas en el read model.`,
  );
}

async function reset() {
  console.log('Eliminando esquema:');
  await runFiles([join(databaseDir, 'reset.sql')]);
  await setup();
}

function bundle() {
  const parts = orderedFiles().map((file) => {
    const rel = file.slice(databaseDir.length + 1).replaceAll('\\', '/');
    return `-- >>>>>>>>>>>>>>>>>>>> ${rel} <<<<<<<<<<<<<<<<<<<<\n\n${readFileSync(file, 'utf8').trim()}\n`;
  });
  const header =
    '-- =====================================================================\n' +
    '-- Afirmative Pill · Script único para el SQL Editor de Supabase\n' +
    '-- (GENERADO con `npm run db:bundle` — no editar a mano)\n' +
    '-- Contiene, en orden: migraciones 001-004 y seeds 001-003.\n' +
    '-- =====================================================================\n\n';
  const out = join(databaseDir, 'supabase_setup.sql');
  writeFileSync(out, header + parts.join('\n'), 'utf8');
  console.log(`✔ Generado ${out}`);
}

async function rebuildProjections() {
  const c = client();
  await c.connect();
  const { rows } = await c.query<{ n: number }>('select refresh_medication_catalog() as n');
  await c.end();
  console.log(`✔ medication_catalog reconstruida (${rows[0].n} filas).`);
}

const command = process.argv[2];
const actions: Record<string, () => unknown> = {
  setup,
  reset,
  bundle,
  'rebuild-projections': rebuildProjections,
};

const action = actions[command];
if (!action) {
  console.error(`Comando desconocido: ${command}. Usa: ${Object.keys(actions).join(' | ')}`);
  process.exit(1);
}

Promise.resolve(action()).catch((err) => {
  console.error('\n✖ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
