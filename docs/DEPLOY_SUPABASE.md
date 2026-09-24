# Paso a paso: base de datos en Supabase

Esta guía deja la base de datos PostgreSQL de **Afirmative Pill** lista en Supabase: tablas, índices, proyecciones de lectura, los **50 medicamentos** del dataset y los usuarios de demostración.

⏱️ Tiempo estimado: 10 minutos.

---

## 1. Crear el proyecto

1. Entra a <https://supabase.com> e inicia sesión (puedes usar tu cuenta de GitHub).
2. Haz clic en **New project**.
3. Completa el formulario:
   - **Organization:** la tuya (se crea una por defecto).
   - **Project name:** `afirmative-pill`.
   - **Database password:** pulsa **Generate a password** y **guárdala** en un lugar seguro. La necesitarás para la cadena de conexión.
     > 💡 Evita que la contraseña tenga caracteres como `@`, `#`, `/`, `?` o `%`. Si los tiene, hay que codificarlos en la URL (por ejemplo, `@` → `%40`).
   - **Region:** `South America (São Paulo)`, la más cercana a Colombia.
4. Pulsa **Create new project** y espera 1–2 minutos a que termine el aprovisionamiento.

---

## 2. Crear el esquema y cargar los datos

Hay dos opciones. Ambas producen exactamente el mismo resultado; **elige una**.

### Opción A (recomendada): SQL Editor, sin instalar nada

1. En el menú lateral abre **SQL Editor**.
2. Pulsa **+ New query** (o **New SQL snippet**).
3. Abre en tu editor el archivo [`database/supabase_setup.sql`](../database/supabase_setup.sql), copia **todo** su contenido y pégalo en el editor de Supabase.
4. Pulsa **Run** (o `Ctrl + Enter`).
5. Al final debe aparecer un resultado con la columna `refresh_medication_catalog = 50`. Eso indica que el catálogo proyectado quedó con los 50 medicamentos.

> `supabase_setup.sql` es la unión, en orden, de `database/migrations/001…004` y `database/seed/001…003`. Si modificas alguno de esos archivos, regénéralo con `npm run db:bundle` desde `backend/`.

### Opción B: desde tu computador con el script del backend

1. Primero haz el [paso 4](#4-obtener-la-cadena-de-conexión) para obtener la cadena de conexión y configúrala en `backend/.env`.
2. Ejecuta:
   ```bash
   cd backend
   npm install
   npm run db:setup
   ```
3. Debe terminar con:
   ```
   ✔ Listo: 50 medicamentos, 14 categorías, 16 laboratorios, 50 filas en el read model.
   ```

Los scripts son **idempotentes**: puedes ejecutarlos más de una vez sin duplicar datos.

---

## 3. Verificar la carga

En **SQL Editor** ejecuta:

```sql
select
  (select count(*) from medications_dataset) as dataset,       -- 50
  (select count(*) from medications)         as medicamentos,  -- 50
  (select count(*) from categories)          as categorias,    -- 14
  (select count(*) from laboratories)        as laboratorios,  -- 16
  (select count(*) from inventory)           as inventario,    -- 50
  (select count(*) from medication_catalog)  as read_model,    -- 50
  (select count(*) from users)               as usuarios;      -- 2
```

También puedes revisar las tablas en **Table Editor**. Verás:

| Grupo | Tablas |
|---|---|
| Dataset original | `medications_dataset` (copia 1:1 del archivo entregado) |
| Catálogo normalizado | `categories`, `laboratories`, `medications` |
| Write model (comandos) | `users`, `inventory`, `carts`, `cart_items`, `orders`, `order_items`, `prescriptions`, `domain_events` |
| Read model (consultas) | `medication_catalog`, `order_projections` |

Para comprobar que la búsqueda usa los índices:

```sql
explain analyze
select name from medication_catalog
where search_text like '%' || lower(extensions.unaccent('acetaminofen')) || '%';
```

---

## 4. Obtener la cadena de conexión

1. En la parte superior del dashboard del proyecto pulsa **Connect**.
2. En la pestaña **Connection string**, con el tipo **URI**, verás tres variantes:

| Variante | Puerto | ¿Cuándo usarla? |
|---|---|---|
| Direct connection | 5432 | ❌ Solo funciona con IPv6. Muchas redes domésticas y universitarias no lo tienen. |
| **Session pooler** | 5432 | ✅ **Servidor local** (`npm run dev`), `npm run db:setup` y el **backend en Render**. |
| **Transaction pooler** | 6543 | Solo si despliegas el backend como función serverless en Vercel (alternativa sin subscriptions). |

3. Copia la URI y reemplaza `[YOUR-PASSWORD]` por la contraseña del paso 1. Tiene esta forma:
   ```
   postgresql://postgres.abcdefghijklmnop:TU_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```

---

## 5. Configurar el backend

En `backend/.env` (cópialo desde `.env.example`):

```env
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
JWT_SECRET=una-cadena-larga-y-aleatoria
```

Prueba la conexión levantando el backend:

```bash
cd backend
npm run dev
```

y en otra terminal:

```bash
npm run smoke
```

Si todo está bien, termina con **`Todo OK ✔`**.

---

## 6. Seguridad: ¿por qué aparecen avisos de "RLS enabled, no policy"?

Supabase publica automáticamente una **API REST** (PostgREST) sobre las tablas del schema `public`. El taller prohíbe REST en el canal de clientes, así que la migración `004_security.sql` **activa Row Level Security sin políticas** en todas las tablas:

- Los roles públicos de la API REST (`anon`, `authenticated`) **no pueden leer ni escribir nada**.
- El backend GraphQL se conecta con el rol propietario de las tablas (`postgres`), que no está sujeto a RLS.

Por eso el **Security Advisor** de Supabase puede mostrar avisos informativos del tipo *"RLS Enabled No Policy"*. Son **esperados** y forman parte del diseño Zero-REST.

---

## 7. (Opcional) Importar el dataset desde CSV

Si el profesor pide ver la carga desde el archivo, puedes importar [`database/seed/medications_dataset.csv`](../database/seed/medications_dataset.csv):

1. Ejecuta primero solo las migraciones (`database/migrations/001…004`) en el SQL Editor.
2. Ve a **Table Editor → medications_dataset → Insert → Import data from CSV** y selecciona el archivo.
3. Ejecuta después `database/seed/002_normalize_catalog.sql` y `database/seed/003_demo_users.sql`.

---

## 8. Reiniciar la base de datos

Para empezar de cero (⚠️ borra pedidos, carritos y usuarios registrados):

- **SQL Editor:** ejecuta [`database/reset.sql`](../database/reset.sql) y luego otra vez `database/supabase_setup.sql`.
- **Terminal:** `cd backend && npm run db:reset`.

---

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` o timeout | Usaste la *Direct connection* (solo IPv6) | Usa la URI del **Session pooler** |
| `password authentication failed for user "postgres"` | Contraseña incorrecta o con caracteres especiales sin codificar | Resetea la contraseña en **Project Settings → Database** o codifica los caracteres especiales |
| `Tenant or user not found` | El usuario de la URI del pooler debe ser `postgres.<ref>`, no solo `postgres` | Copia la URI completa desde **Connect** |
| `self-signed certificate in certificate chain` | Validación SSL | Deja `DATABASE_SSL=true`; el backend ya acepta el certificado de Supabase |
| `extension "pg_trgm" is not available` | Proyecto antiguo o extensión deshabilitada | **Database → Extensions** → activa `pg_trgm`, `unaccent` y `pgcrypto` |
| El proyecto no responde tras días sin uso | Los proyectos gratuitos se pausan tras una semana de inactividad | En el dashboard pulsa **Restore project** |
