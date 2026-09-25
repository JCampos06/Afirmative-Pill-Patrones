# 03 · Mitigación del problema N+1 con DataLoader

[← Índice](README.md) · Criterio 1 de la rúbrica (40 %), restricción de rendimiento del escenario A

---

## 1. El problema

En GraphQL cada campo tiene su propio resolver. En una consulta como esta:

```graphql
query DemoN1 {
  medications(first: 12) {
    edges { node { name category { name } laboratory { name } } }
  }
}
```

el resolver de `medications` trae 12 filas con **1** consulta. Luego, por cada uno de los 12 medicamentos, se ejecutan los resolvers de `category` y `laboratory`. Si cada uno consulta la BD por su cuenta, el total es **1 + 12 + 12 = 25 consultas SQL** para pintar una sola página. Con 50 medicamentos serían 101. Ese es el problema **N+1**.

---

## 2. La solución

### 2.1 Un juego de DataLoaders nuevo por cada request

El contexto de GraphQL crea los loaders **en cada petición** ([context.ts:14-20](../backend/src/graphql/context.ts#L14-L20)):

```ts
export function buildContext(authorization: unknown, stats?: RequestStats): GraphQLContext {
  return {
    user: verifyToken(extractToken(authorization)),
    loaders: createLoaders(),   // ← nuevos en cada request
    stats: stats ?? { queries: 0, loaderBatches: 0 },
  };
}
```

**Por qué por request:** la caché de DataLoader queda aislada por usuario y por petición. Un paciente nunca recibe datos cacheados de otra sesión, y una petición siguiente siempre ve datos actualizados.

### 2.2 Los resolvers anidados piden por id; DataLoader agrupa

Los resolvers no consultan la BD: llaman a `load(id)` ([types.resolvers.ts:25-27](../backend/src/graphql/resolvers/types.resolvers.ts#L25-L27)):

```ts
Medication: {
  category:   (m, _args, ctx) => ctx.loaders.categoryById.load(m.category_id),
  laboratory: (m, _args, ctx) => ctx.loaders.laboratoryById.load(m.laboratory_id),
}
```

DataLoader acumula todos los `load()` del mismo ciclo de ejecución y llama **una vez** a la función de lote con todas las claves. Cada función de lote es **una sola consulta SQL** con `WHERE id = ANY($1)` ([catalog.queries.ts:155-185](../backend/src/queries/catalog.queries.ts#L155-L185)):

```sql
select id, name, slug from categories where id = any($1::int[])
```

Además, DataLoader **deduplica**: si 12 medicamentos comparten 8 categorías, pide solo las 8 distintas.

### 2.3 Loaders disponibles y dónde se usan

Definidos en [dataloaders/index.ts:66-85](../backend/src/dataloaders/index.ts#L66-L85):

| Loader | Resuelve | Consulta en lote |
|---|---|---|
| `categoryById` | `Medication.category` | `categories where id = any($1)` |
| `laboratoryById` | `Medication.laboratory` | `laboratories where id = any($1)` |
| `medicationById` | `CartItem.medication`, `OrderLine.medication`, `StockShortage.medication`, `PrescriptionRequiredError.medications`, `Query.medication` | `medication_catalog where medication_id = any($1)` |
| `medicationsByCategoryId` | `Category.medications` | `medication_catalog where category_id = any($1)` |
| `medicationCountByCategoryId` | `Category.medicationCount` | `count(*) … where category_id = any($1) group by category_id` |

**Precarga (`prime`):** cuando `Query.medications` ya leyó las filas, las deja en la caché de `medicationById`. Si la misma respuesta vuelve a pedir un medicamento por id, no se consulta de nuevo ([query.resolvers.ts:23-28](../backend/src/graphql/resolvers/query.resolvers.ts#L23-L28)).

---

## 3. Cómo se mide

Para que la evidencia sea objetiva, el backend cuenta **cada consulta SQL de cada request**:

- Toda consulta pasa por la clase `Db`, que incrementa un contador guardado en un `AsyncLocalStorage` por request ([db.ts:16-21](../backend/src/infra/db.ts#L16-L21), [db.ts:57-71](../backend/src/infra/db.ts#L57-L71)).
- Cada lote de DataLoader se registra en el log con sus claves ([dataloaders/index.ts:46-59](../backend/src/dataloaders/index.ts#L46-L59)).
- Un plugin de Apollo imprime al final de cada operación el total: `N consultas SQL · M lotes DataLoader · T ms` ([plugins.ts:32-39](../backend/src/graphql/plugins.ts#L32-L39)).
- La variable `DISABLE_DATALOADER=true` desactiva el *batching* y la caché de los loaders ([dataloaders/index.ts:61-64](../backend/src/dataloaders/index.ts#L61-L64)). Así se puede mostrar el N+1 real con el **mismo código** y comparar.

---

## 4. Evidencia real (logs del servidor)

Capturada el 24/09/2026 contra la base de datos de Supabase, ejecutando las mismas tres consultas en los dos modos.

### 4.1 Resumen

| Consulta | Sin DataLoader (N+1) | Con DataLoader | Reducción |
|---|---|---|---|
| `DemoN1`: 12 medicamentos con `category` y `laboratory` | **25** consultas SQL | **3** consultas SQL (2 lotes) | −88 % |
| `CategoriasConConteo`: 14 categorías con `medicationCount` | **15** consultas SQL | **2** consultas SQL (1 lote) | −87 % |
| `Catalog` (vista condensada, sin relaciones anidadas) | 1 consulta SQL | 1 consulta SQL | — |

### 4.2 Con DataLoader (modo normal)

```text
00:18:06.251 GRAPHQL     ▶ query DemoN1
00:18:06.370 SQL         select medication_id, sku, name, active_ingredient, dosage, presentation, price, requires_prescription, description, category_id, category_name, la... [12,0] → 12 filas · 115.9ms
00:18:06.379 DATALOADER  categoryById · lote de 8 claves [14, 3, 5, 4, 11, 10, 6, 1] → 1 consulta SQL
00:18:06.380 DATALOADER  laboratoryById · lote de 8 claves [2, 12, 9, 1, 7, 14, 15, 10] → 1 consulta SQL
00:18:06.495 SQL         select id, name, slug from categories where id = any($1::int[]) [[14,3,5,4,11,10,6,1]] → 8 filas · 115.7ms
00:18:07.168 SQL         select id, name from laboratories where id = any($1::int[]) [[2,12,9,1,7,14,15,10]] → 8 filas · 788.4ms
00:18:07.169 GRAPHQL     ◀ query DemoN1 · 3 consultas SQL · 2 lotes DataLoader · 924ms

00:18:07.611 GRAPHQL     ▶ query Catalog
00:18:07.725 SQL         select medication_id, sku, name, active_ingredient, dosage, presentation, price, requires_prescription, description, category_id, category_name, la... [12,0] → 12 filas · 112.9ms
00:18:07.728 GRAPHQL     ◀ query Catalog · 1 consultas SQL · 0 lotes DataLoader · 121ms

00:18:08.155 GRAPHQL     ▶ query CategoriasConConteo
00:18:08.266 SQL         select id, name, slug from categories order by name → 14 filas · 110.8ms
00:18:08.267 DATALOADER  medicationCountByCategoryId · lote de 14 claves [14, 11, 8, 7, 13, 3, 5, 12, 10, 9, 1, 2, 4, 6] → 1 consulta SQL
00:18:08.387 SQL         select category_id, count(*) as n from medication_catalog where category_id = any($1::int[]) group by category_id [[14,11,8,7,13,3,5,12,10,9,1,2,4,6]] → 14 filas · 119.7ms
00:18:08.388 GRAPHQL     ◀ query CategoriasConConteo · 2 consultas SQL · 1 lotes DataLoader · 234ms
```

**Lectura:** los 12 medicamentos pedían 12 categorías y 12 laboratorios, pero DataLoader los **agrupó y deduplicó** en un lote de 8 categorías y otro de 8 laboratorios: **1 consulta SQL por relación**, sin importar cuántos nodos tenga la respuesta.

### 4.3 Sin DataLoader (`DISABLE_DATALOADER=true`)

```text
00:17:58.419 GRAPHQL     ▶ query DemoN1
00:17:58.537 SQL         select medication_id, sku, name, … from medication_catalog … [12,0] → 12 filas · 115.5ms
00:17:58.550 DATALOADER  categoryById · SIN batching (N+1): clave [14] → 1 consulta SQL por clave
00:17:58.550 DATALOADER  laboratoryById · SIN batching (N+1): clave [2] → 1 consulta SQL por clave
00:17:58.551 DATALOADER  categoryById · SIN batching (N+1): clave [3] → 1 consulta SQL por clave
   … (24 líneas de este tipo en total: 12 categorías + 12 laboratorios, con claves repetidas)
00:17:58.666 SQL         select id, name, slug from categories where id = any($1::int[]) [[14]] → 1 filas · 115.9ms
00:17:58.784 SQL         select id, name, slug from categories where id = any($1::int[]) [[5]] → 1 filas · 231.8ms
00:17:58.893 SQL         select id, name from laboratories where id = any($1::int[]) [[1]] → 1 filas · 340.4ms
   … (24 consultas SQL de 1 fila cada una)
00:17:59.474 GRAPHQL     ◀ query DemoN1 · 25 consultas SQL · 0 lotes DataLoader · 1060ms

00:18:00.449 GRAPHQL     ▶ query CategoriasConConteo
00:18:00.561 SQL         select id, name, slug from categories order by name → 14 filas · 111.4ms
   … (14 consultas COUNT, una por categoría)
00:18:00.791 GRAPHQL     ◀ query CategoriasConConteo · 15 consultas SQL · 0 lotes DataLoader · 344ms
```

<details>
<summary><b>Ver el log completo sin recortes de <code>query DemoN1</code> en modo N+1</b></summary>

```text
00:17:58.419 GRAPHQL     ▶ query DemoN1
00:17:58.537 SQL         select medication_id, sku, name, active_ingredient, dosage, presentation, price, requires_prescription, description, category_id, category_name, la... [12,0] → 12 filas · 115.5ms
00:17:58.550 DATALOADER  categoryById · SIN batching (N+1): clave [14] → 1 consulta SQL por clave
00:17:58.550 DATALOADER  laboratoryById · SIN batching (N+1): clave [2] → 1 consulta SQL por clave
00:17:58.551 DATALOADER  categoryById · SIN batching (N+1): clave [3] → 1 consulta SQL por clave
00:17:58.551 DATALOADER  laboratoryById · SIN batching (N+1): clave [12] → 1 consulta SQL por clave
00:17:58.551 DATALOADER  categoryById · SIN batching (N+1): clave [5] → 1 consulta SQL por clave
00:17:58.551 DATALOADER  laboratoryById · SIN batching (N+1): clave [9] → 1 consulta SQL por clave
00:17:58.552 DATALOADER  categoryById · SIN batching (N+1): clave [4] → 1 consulta SQL por clave
00:17:58.552 DATALOADER  laboratoryById · SIN batching (N+1): clave [1] → 1 consulta SQL por clave
00:17:58.552 DATALOADER  categoryById · SIN batching (N+1): clave [11] → 1 consulta SQL por clave
00:17:58.552 DATALOADER  laboratoryById · SIN batching (N+1): clave [7] → 1 consulta SQL por clave
00:17:58.552 DATALOADER  categoryById · SIN batching (N+1): clave [5] → 1 consulta SQL por clave
00:17:58.552 DATALOADER  laboratoryById · SIN batching (N+1): clave [1] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  categoryById · SIN batching (N+1): clave [11] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  laboratoryById · SIN batching (N+1): clave [12] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  categoryById · SIN batching (N+1): clave [10] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  laboratoryById · SIN batching (N+1): clave [12] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  categoryById · SIN batching (N+1): clave [6] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  laboratoryById · SIN batching (N+1): clave [14] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  categoryById · SIN batching (N+1): clave [1] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  laboratoryById · SIN batching (N+1): clave [15] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  categoryById · SIN batching (N+1): clave [5] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  laboratoryById · SIN batching (N+1): clave [10] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  categoryById · SIN batching (N+1): clave [11] → 1 consulta SQL por clave
00:17:58.553 DATALOADER  laboratoryById · SIN batching (N+1): clave [2] → 1 consulta SQL por clave
00:17:58.666 SQL         select id, name, slug from categories where id = any($1::int[]) [[14]] → 1 filas · 115.9ms
00:17:58.784 SQL         select id, name, slug from categories where id = any($1::int[]) [[5]] → 1 filas · 231.8ms
00:17:58.893 SQL         select id, name from laboratories where id = any($1::int[]) [[1]] → 1 filas · 340.4ms
00:17:59.002 SQL         select id, name, slug from categories where id = any($1::int[]) [[11]] → 1 filas · 449.6ms
00:17:59.111 SQL         select id, name from laboratories where id = any($1::int[]) [[12]] → 1 filas · 558.5ms
00:17:59.219 SQL         select id, name, slug from categories where id = any($1::int[]) [[10]] → 1 filas · 666.0ms
00:17:59.328 SQL         select id, name from laboratories where id = any($1::int[]) [[12]] → 1 filas · 775.6ms
00:17:59.337 SQL         select id, name, slug from categories where id = any($1::int[]) [[3]] → 1 filas · 786.3ms
00:17:59.339 SQL         select id, name, slug from categories where id = any($1::int[]) [[11]] → 1 filas · 786.8ms
00:17:59.343 SQL         select id, name from laboratories where id = any($1::int[]) [[9]] → 1 filas · 791.4ms
00:17:59.345 SQL         select id, name from laboratories where id = any($1::int[]) [[1]] → 1 filas · 792.8ms
00:17:59.346 SQL         select id, name, slug from categories where id = any($1::int[]) [[5]] → 1 filas · 794.2ms
00:17:59.364 SQL         select id, name from laboratories where id = any($1::int[]) [[2]] → 1 filas · 813.1ms
00:17:59.364 SQL         select id, name, slug from categories where id = any($1::int[]) [[4]] → 1 filas · 812.8ms
00:17:59.366 SQL         select id, name from laboratories where id = any($1::int[]) [[7]] → 1 filas · 813.8ms
00:17:59.394 SQL         select id, name from laboratories where id = any($1::int[]) [[12]] → 1 filas · 843.1ms
00:17:59.436 SQL         select id, name, slug from categories where id = any($1::int[]) [[6]] → 1 filas · 882.6ms
00:17:59.444 SQL         select id, name from laboratories where id = any($1::int[]) [[14]] → 1 filas · 891.4ms
00:17:59.446 SQL         select id, name, slug from categories where id = any($1::int[]) [[1]] → 1 filas · 892.7ms
00:17:59.450 SQL         select id, name from laboratories where id = any($1::int[]) [[15]] → 1 filas · 897.0ms
00:17:59.452 SQL         select id, name, slug from categories where id = any($1::int[]) [[5]] → 1 filas · 898.3ms
00:17:59.454 SQL         select id, name from laboratories where id = any($1::int[]) [[10]] → 1 filas · 900.6ms
00:17:59.473 SQL         select id, name, slug from categories where id = any($1::int[]) [[11]] → 1 filas · 919.7ms
00:17:59.474 SQL         select id, name from laboratories where id = any($1::int[]) [[2]] → 1 filas · 920.6ms
00:17:59.474 GRAPHQL     ◀ query DemoN1 · 25 consultas SQL · 0 lotes DataLoader · 1060ms
```

Se ve que la categoría `5` se consulta **3 veces**, la `11` **3 veces** y el laboratorio `12` **3 veces**: sin DataLoader no hay ni agrupación ni deduplicación.

</details>

---

## 5. Observación sobre los tiempos

La mejora principal es la **carga sobre la base de datos**: 25 → 3 consultas. En esta medición el tiempo total bajó menos (1060 ms → 924 ms) por dos razones:

- El pool de conexiones ejecutó varias consultas del modo N+1 **en paralelo**, lo que oculta parte del costo.
- Cada consulta a Supabase tarda unos **110 ms** de red, y esa latencia domina los tiempos de una prueba tan pequeña.

Con más usuarios concurrentes, el modo N+1 agota el pool de conexiones y multiplica la carga del servidor de base de datos. Por eso el indicador relevante es el **número de consultas por request**, que DataLoader mantiene constante: una por relación, sin importar cuántos nodos haya.

---

## 6. Cómo reproducirlo

```bash
cd backend

# Modo N+1 (Windows PowerShell: $env:DISABLE_DATALOADER="true"; npm run dev)
DISABLE_DATALOADER=true npm run dev

# Modo normal
npm run dev
```

En **Apollo Sandbox** (`http://localhost:4000/graphql`) ejecutar:

```graphql
query DemoN1 {
  medications(first: 12) {
    edges { node { name category { name } laboratory { name } } }
  }
}
```

Y en la terminal del backend observar las líneas `DATALOADER` y el resumen `◀ query DemoN1 · N consultas SQL`.
