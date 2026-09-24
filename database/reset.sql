-- =====================================================================
-- Afirmative Pill · RESET (¡destructivo!)
-- Elimina todas las tablas, tipos y funciones del proyecto para volver
-- a ejecutar las migraciones desde cero. No toca las extensiones.
-- =====================================================================

drop table if exists order_projections   cascade;
drop table if exists medication_catalog  cascade;
drop table if exists domain_events       cascade;
drop table if exists prescriptions       cascade;
drop table if exists order_items         cascade;
drop table if exists orders              cascade;
drop table if exists cart_items          cascade;
drop table if exists carts               cascade;
drop table if exists inventory           cascade;
drop table if exists users               cascade;
drop table if exists medications         cascade;
drop table if exists laboratories        cascade;
drop table if exists categories          cascade;
drop table if exists medications_dataset cascade;

drop function if exists refresh_medication_catalog(integer[]);
drop sequence if exists order_code_seq;

drop type if exists cart_status;
drop type if exists prescription_status;
drop type if exists order_status;
drop type if exists user_role;
