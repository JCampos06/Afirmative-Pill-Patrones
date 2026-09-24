-- =====================================================================
-- Afirmative Pill · Migración 003 · READ MODEL (lado de consultas)
-- ---------------------------------------------------------------------
-- Proyecciones desnormalizadas y optimizadas para lectura. Solo las
-- escribe el Projector (a partir del outbox domain_events); las Queries
-- GraphQL leen EXCLUSIVAMENTE de estas tablas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Proyección del catálogo: búsqueda facetada + disponibilidad
-- ---------------------------------------------------------------------
create table if not exists medication_catalog (
  medication_id         integer primary key references medications (id) on delete cascade,
  sku                   text    not null,
  name                  text    not null,
  active_ingredient     text    not null,
  dosage                text    not null,
  presentation          text    not null,
  price                 numeric(12, 2) not null,
  requires_prescription boolean not null,
  description           text    not null,
  category_id           integer not null,
  category_name         text    not null,
  laboratory_id         integer not null,
  laboratory_name       text    not null,
  stock_available       integer not null,
  availability          text    not null
                        check (availability in ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK')),
  -- Documento de búsqueda precalculado: minúsculas y sin tildes
  -- (nombre comercial + principio activo + categoría + laboratorio + sku)
  search_text           text    not null,
  synced_at             timestamptz not null default now()
);

-- Búsqueda parcial (ILIKE '%texto%') indexada con trigramas
create index if not exists idx_catalog_search_trgm
  on medication_catalog using gin (search_text extensions.gin_trgm_ops);
create index if not exists idx_catalog_ingredient_trgm
  on medication_catalog using gin (lower(active_ingredient) extensions.gin_trgm_ops);
-- Facetas y ordenamientos
create index if not exists idx_catalog_category      on medication_catalog (category_id);
create index if not exists idx_catalog_laboratory    on medication_catalog (laboratory_id);
create index if not exists idx_catalog_prescription  on medication_catalog (requires_prescription);
create index if not exists idx_catalog_availability  on medication_catalog (availability);
create index if not exists idx_catalog_price         on medication_catalog (price, medication_id);
create index if not exists idx_catalog_name          on medication_catalog (name, medication_id);

-- Reconstruye (total o parcialmente) la proyección del catálogo.
-- LOW_STOCK se activa con 25 unidades o menos.
create or replace function refresh_medication_catalog(p_ids integer[] default null)
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  insert into medication_catalog as mc (
    medication_id, sku, name, active_ingredient, dosage, presentation, price,
    requires_prescription, description, category_id, category_name,
    laboratory_id, laboratory_name, stock_available, availability, search_text, synced_at
  )
  select
    m.id, m.sku, m.name, m.active_ingredient, m.dosage, m.presentation, m.price,
    m.requires_prescription, m.description, c.id, c.name,
    l.id, l.name, i.stock,
    case when i.stock = 0 then 'OUT_OF_STOCK'
         when i.stock <= 25 then 'LOW_STOCK'
         else 'IN_STOCK' end,
    lower(extensions.unaccent(concat_ws(' ', m.name, m.active_ingredient, c.name, l.name, m.sku))),
    now()
  from medications m
  join categories   c on c.id = m.category_id
  join laboratories l on l.id = m.laboratory_id
  join inventory    i on i.medication_id = m.id
  where p_ids is null or m.id = any (p_ids)
  on conflict (medication_id) do update set
    sku                   = excluded.sku,
    name                  = excluded.name,
    active_ingredient     = excluded.active_ingredient,
    dosage                = excluded.dosage,
    presentation          = excluded.presentation,
    price                 = excluded.price,
    requires_prescription = excluded.requires_prescription,
    description           = excluded.description,
    category_id           = excluded.category_id,
    category_name         = excluded.category_name,
    laboratory_id         = excluded.laboratory_id,
    laboratory_name       = excluded.laboratory_name,
    stock_available       = excluded.stock_available,
    availability          = excluded.availability,
    search_text           = excluded.search_text,
    synced_at             = excluded.synced_at;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------
-- Proyección de órdenes: resumen listo para pintar en la UI
-- ---------------------------------------------------------------------
create table if not exists order_projections (
  order_id              uuid primary key,
  code                  text not null,
  user_id               uuid not null,
  customer_name         text not null,
  status                order_status not null,
  total                 numeric(12, 2) not null,
  item_count            integer not null,
  items                 jsonb not null,           -- [{medicationId, sku, name, quantity, unitPrice, subtotal, requiresPrescription}]
  requires_prescription boolean not null,
  prescription          jsonb,                    -- {status, doctorName, doctorLicense, issuedAt, reviewNotes, reviewedAt}
  shipping_address      text not null,
  status_history        jsonb not null default '[]'::jsonb,  -- [{status, at, note, actor}]
  placed_at             timestamptz not null,
  updated_at            timestamptz not null,
  projection_version    integer not null default 1,
  last_event_id         bigint  not null,
  synced_at             timestamptz not null default now()
);

create index if not exists idx_order_proj_user   on order_projections (user_id, placed_at desc);
create index if not exists idx_order_proj_status on order_projections (status, placed_at desc);
