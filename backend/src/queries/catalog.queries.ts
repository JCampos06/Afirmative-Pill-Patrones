/**
 * CONSULTAS DEL CATÁLOGO (read model).
 * Leen exclusivamente la proyección medication_catalog y las tablas de
 * referencia (categories, laboratories). Nunca modifican estado.
 */
import { db } from '../infra/db.js';

export interface CatalogRow {
  medication_id: number;
  sku: string;
  name: string;
  active_ingredient: string;
  dosage: string;
  presentation: string;
  price: number;
  requires_prescription: boolean;
  description: string;
  category_id: number;
  category_name: string;
  laboratory_id: number;
  laboratory_name: string;
  stock_available: number;
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  synced_at: Date;
}

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
}

export interface LaboratoryRow {
  id: number;
  name: string;
}

export const CATALOG_COLUMNS = `medication_id, sku, name, active_ingredient, dosage, presentation, price,
  requires_prescription, description, category_id, category_name, laboratory_id, laboratory_name,
  stock_available, availability, synced_at`;

export interface MedicationFilter {
  search?: string | null;
  activeIngredient?: string | null;
  categoryId?: string | null;
  laboratoryId?: string | null;
  requiresPrescription?: boolean | null;
  availability?: CatalogRow['availability'] | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface MedicationSort {
  field: 'NAME' | 'PRICE';
  direction: 'ASC' | 'DESC';
}

export interface SearchArgs {
  filter?: MedicationFilter | null;
  sort?: MedicationSort | null;
  first?: number | null;
  after?: string | null;
}

export interface SearchPage {
  rows: CatalogRow[];
  totalCount: number;
  offset: number;
  limit: number;
}

const MAX_PAGE_SIZE = 50;

/** Cursor opaco (base64) que codifica la posición dentro del resultado. */
export function encodeCursor(offset: number): string {
  return Buffer.from(`offset:${offset}`, 'utf8').toString('base64');
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const decoded = Buffer.from(cursor, 'base64').toString('utf8');
  const match = /^offset:(\d+)$/.exec(decoded);
  return match ? Number(match[1]) + 1 : 0;
}

/** Escapa comodines de LIKE para que el texto del usuario se busque literal. */
function likeEscape(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function searchMedications(args: SearchArgs): Promise<SearchPage> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const f = args.filter ?? {};

  if (f.search?.trim()) {
    where.push(`search_text like '%' || lower(extensions.unaccent(${add(likeEscape(f.search.trim()))})) || '%'`);
  }
  if (f.activeIngredient?.trim()) {
    where.push(`lower(active_ingredient) like '%' || lower(${add(likeEscape(f.activeIngredient.trim()))}) || '%'`);
  }
  if (f.categoryId) where.push(`category_id = ${add(Number(f.categoryId))}`);
  if (f.laboratoryId) where.push(`laboratory_id = ${add(Number(f.laboratoryId))}`);
  if (typeof f.requiresPrescription === 'boolean') {
    where.push(`requires_prescription = ${add(f.requiresPrescription)}`);
  }
  if (f.availability) where.push(`availability = ${add(f.availability)}`);
  if (typeof f.minPrice === 'number') where.push(`price >= ${add(f.minPrice)}`);
  if (typeof f.maxPrice === 'number') where.push(`price <= ${add(f.maxPrice)}`);

  const sortColumn = args.sort?.field === 'PRICE' ? 'price' : 'name';
  const direction = args.sort?.direction === 'DESC' ? 'desc' : 'asc';
  const limit = Math.min(Math.max(args.first ?? 12, 1), MAX_PAGE_SIZE);
  const offset = decodeCursor(args.after);

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const rows = await db.rows<CatalogRow & { total_count: number }>(
    `select ${CATALOG_COLUMNS}, count(*) over() as total_count
       from medication_catalog
       ${whereSql}
      order by ${sortColumn} ${direction}, medication_id ${direction}
      limit ${add(limit)} offset ${add(offset)}`,
    params,
  );

  let totalCount = rows[0]?.total_count ?? 0;
  if (rows.length === 0 && offset > 0) {
    const countRow = await db.one<{ n: number }>(
      `select count(*) as n from medication_catalog ${whereSql}`,
      params.slice(0, params.length - 2),
    );
    totalCount = countRow?.n ?? 0;
  }
  return { rows, totalCount, offset, limit };
}

export async function getMedicationBySku(sku: string): Promise<CatalogRow | null> {
  return db.one<CatalogRow>(`select ${CATALOG_COLUMNS} from medication_catalog where sku = $1`, [sku]);
}

export async function listCategories(): Promise<CategoryRow[]> {
  return db.rows<CategoryRow>('select id, name, slug from categories order by name');
}

export async function listLaboratories(): Promise<LaboratoryRow[]> {
  return db.rows<LaboratoryRow>('select id, name from laboratories order by name');
}

// ─── Consultas en LOTE (las usan los DataLoaders) ────────────────────

export async function medicationsByIds(ids: readonly number[]): Promise<CatalogRow[]> {
  return db.rows<CatalogRow>(
    `select ${CATALOG_COLUMNS} from medication_catalog where medication_id = any($1::int[])`,
    [ids],
  );
}

export async function categoriesByIds(ids: readonly number[]): Promise<CategoryRow[]> {
  return db.rows<CategoryRow>('select id, name, slug from categories where id = any($1::int[])', [ids]);
}

export async function laboratoriesByIds(ids: readonly number[]): Promise<LaboratoryRow[]> {
  return db.rows<LaboratoryRow>('select id, name from laboratories where id = any($1::int[])', [ids]);
}

export async function medicationsByCategoryIds(ids: readonly number[]): Promise<CatalogRow[]> {
  return db.rows<CatalogRow>(
    `select ${CATALOG_COLUMNS} from medication_catalog where category_id = any($1::int[]) order by name`,
    [ids],
  );
}

export async function medicationCountsByCategoryIds(
  ids: readonly number[],
): Promise<{ category_id: number; n: number }[]> {
  return db.rows<{ category_id: number; n: number }>(
    `select category_id, count(*) as n from medication_catalog
      where category_id = any($1::int[]) group by category_id`,
    [ids],
  );
}
