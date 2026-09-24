-- =====================================================================
-- Afirmative Pill · Seed 003 · Usuarios de demostración
-- ---------------------------------------------------------------------
-- Contraseñas con bcrypt (pgcrypto). El backend las verifica con crypt().
--   Paciente:      paciente@afirmativepill.co  /  Paciente123*
--   Farmacéutico:  farmacia@afirmativepill.co  /  Farmacia123*
-- =====================================================================

insert into users (email, full_name, document_number, password_hash, role)
values
  ('paciente@afirmativepill.co', 'Paciente Demo', '1000000001',
   extensions.crypt('Paciente123*', extensions.gen_salt('bf', 10)), 'PATIENT'),
  ('farmacia@afirmativepill.co', 'Químico Farmacéutico Demo', '1000000002',
   extensions.crypt('Farmacia123*', extensions.gen_salt('bf', 10)), 'PHARMACIST')
on conflict (email) do nothing;
