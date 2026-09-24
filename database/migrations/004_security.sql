-- =====================================================================
-- Afirmative Pill · Migración 004 · Seguridad (Zero-REST)
-- ---------------------------------------------------------------------
-- Supabase expone automáticamente una API REST (PostgREST) sobre las
-- tablas del schema public. Para cumplir el mandato Zero-REST se activa
-- Row Level Security SIN políticas: los roles anon/authenticated de la
-- Data API quedan sin acceso y el ÚNICO camino a los datos es el
-- backend GraphQL (que se conecta con el rol dueño de las tablas).
-- =====================================================================

alter table medications_dataset enable row level security;
alter table categories          enable row level security;
alter table laboratories        enable row level security;
alter table medications         enable row level security;
alter table users               enable row level security;
alter table inventory           enable row level security;
alter table carts               enable row level security;
alter table cart_items          enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table prescriptions       enable row level security;
alter table domain_events       enable row level security;
alter table medication_catalog  enable row level security;
alter table order_projections   enable row level security;
