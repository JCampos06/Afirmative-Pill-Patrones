-- =====================================================================
-- Afirmative Pill · Seed 002 · Normalización del dataset
-- ---------------------------------------------------------------------
-- medications_dataset  ->  categories + laboratories + medications
--                      ->  inventory (write model: stock real)
--                      ->  medication_catalog (read model proyectado)
-- Es idempotente: se puede ejecutar varias veces sin duplicar datos.
-- =====================================================================

insert into categories (name, slug)
select distinct
  d.category,
  trim(both '-' from regexp_replace(lower(extensions.unaccent(d.category)), '[^a-z0-9]+', '-', 'g'))
from medications_dataset d
on conflict (name) do nothing;

insert into laboratories (name)
select distinct d.manufacturer
from medications_dataset d
on conflict (name) do nothing;

insert into medications (
  id, sku, name, active_ingredient, category_id, laboratory_id,
  dosage, presentation, price, requires_prescription, description
)
select
  d.id, d.sku, d.name, d.active_ingredient, c.id, l.id,
  d.dosage, d.presentation, d.price, d.requires_prescription, d.description
from medications_dataset d
join categories   c on c.name = d.category
join laboratories l on l.name = d.manufacturer
on conflict (id) do nothing;

insert into inventory (medication_id, stock)
select d.id, d.stock
from medications_dataset d
on conflict (medication_id) do nothing;

-- Construye la proyección de lectura completa del catálogo
select refresh_medication_catalog();
