-- =====================================================================
-- Afirmative Pill · Migración 002 · WRITE MODEL (lado de comandos)
-- ---------------------------------------------------------------------
-- Tablas transaccionales que solo modifican los Command Handlers.
-- Las invariantes críticas se protegen también a nivel de BD
-- (CHECK stock >= 0, un único carrito abierto por usuario, etc.).
-- domain_events funciona como OUTBOX: cada comando registra sus eventos
-- en la MISMA transacción; el proyector los consume de forma asíncrona.
-- =====================================================================

do $$ begin
  create type user_role as enum ('PATIENT', 'PHARMACIST');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prescription_status as enum ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cart_status as enum ('OPEN', 'CHECKED_OUT');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Usuarios (pacientes y químicos farmacéuticos)
-- ---------------------------------------------------------------------
create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (email = lower(email)),
  full_name       text not null,
  document_number text not null,
  password_hash   text not null,
  role            user_role not null default 'PATIENT',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Inventario: fuente de verdad del stock (invariante: nunca negativo)
-- ---------------------------------------------------------------------
create table if not exists inventory (
  medication_id integer primary key references medications (id) on delete cascade,
  stock         integer not null check (stock >= 0),
  version       integer not null default 0,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Carrito (agregado transaccional en el servidor)
-- ---------------------------------------------------------------------
create table if not exists carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  status     cart_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_carts_one_open_per_user
  on carts (user_id) where status = 'OPEN';

create table if not exists cart_items (
  cart_id       uuid    not null references carts (id) on delete cascade,
  medication_id integer not null references medications (id),
  quantity      integer not null check (quantity > 0),
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (cart_id, medication_id)
);

-- ---------------------------------------------------------------------
-- Órdenes
-- ---------------------------------------------------------------------
create sequence if not exists order_code_seq start 1001;

create table if not exists orders (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique
                        default ('AP-' || lpad(nextval('order_code_seq')::text, 6, '0')),
  user_id               uuid not null references users (id),
  cart_id               uuid references carts (id),
  status                order_status not null default 'PENDING_APPROVAL',
  total                 numeric(12, 2) not null check (total >= 0),
  requires_prescription boolean not null,
  shipping_address      text not null,
  idempotency_key       text,
  version               integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists uq_orders_idempotency
  on orders (user_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_orders_user   on orders (user_id);
create index if not exists idx_orders_status on orders (status);

create table if not exists order_items (
  id            bigint generated always as identity primary key,
  order_id      uuid    not null references orders (id) on delete cascade,
  medication_id integer not null references medications (id),
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(12, 2) not null check (unit_price >= 0),
  subtotal      numeric(12, 2) not null check (subtotal >= 0),
  unique (order_id, medication_id)
);

create index if not exists idx_order_items_order on order_items (order_id);

-- ---------------------------------------------------------------------
-- Fórmulas médicas (soporte obligatorio para ítems con prescripción)
-- ---------------------------------------------------------------------
create table if not exists prescriptions (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references orders (id) on delete cascade,
  doctor_name      text not null,
  doctor_license   text not null,
  patient_document text not null,
  issued_at        date not null,
  document_url     text,
  notes            text,
  status           prescription_status not null default 'PENDING_REVIEW',
  reviewed_by      uuid references users (id),
  reviewed_at      timestamptz,
  review_notes     text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_prescriptions_status on prescriptions (status);

-- ---------------------------------------------------------------------
-- Outbox de eventos de dominio
-- ---------------------------------------------------------------------
create table if not exists domain_events (
  id             bigint generated always as identity primary key,
  aggregate_type text not null,
  aggregate_id   text not null,
  event_type     text not null,
  payload        jsonb not null,
  occurred_at    timestamptz not null default now(),
  processed_at   timestamptz,
  attempts       integer not null default 0,
  last_error     text
);

create index if not exists idx_domain_events_pending
  on domain_events (id) where processed_at is null;
create index if not exists idx_domain_events_aggregate
  on domain_events (aggregate_type, aggregate_id);
