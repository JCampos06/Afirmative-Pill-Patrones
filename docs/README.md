# Documentación técnica · Afirmative Pill

Esta carpeta reúne la **justificación de las decisiones de diseño** y la **evidencia** de cada criterio de la rúbrica del taller. Cada documento enlaza al código exacto (archivo y líneas) donde se implementa lo que describe.

La evidencia de logs y datos se capturó el **24/09/2026** contra la base de datos real en Supabase, con el mismo servidor que corre en producción.

---

## Mapa de la rúbrica

| # | Criterio (peso) | Documento | Evidencia principal |
|---|---|---|---|
| 1 | **Diseño e implementación de GraphQL** (40 %) | [02 · Contrato GraphQL](02_GRAPHQL.md) | Schema SDL con 7 scalars, 9 enums, inputs por comando, 5 uniones de resultado e `interface DomainError`. Respuesta real de la vista condensada (sin over-fetching). |
| | ↳ Mitigación del problema N+1 | [03 · N+1 y DataLoader](03_N1_DATALOADER.md) | **Logs reales:** la misma consulta pasa de **25 → 3** consultas SQL, y la de categorías de **15 → 2**. |
| | ↳ Zero-REST | [02 · Contrato GraphQL, sección 7](02_GRAPHQL.md#7-zero-rest-cómo-se-garantiza) | Una sola ruta `/graphql` en el servidor; RLS en las 14 tablas bloquea la API REST automática de Supabase. |
| 2 | **Arquitectura CQRS y modelo de dominio** (25 %) | [04 · CQRS y consistencia eventual](04_CQRS.md) | Write model / read model en tablas separadas, outbox transaccional, proyector asíncrono, 8 invariantes protegidas, estrategia de UI para la latencia. |
| 3 | **Frontend con Apollo Client & Context** (20 %) | [05 · Frontend con Apollo Client](05_FRONTEND_APOLLO.md) | `ApolloProvider` en la raíz, caché normalizada con `typePolicies`, `optimisticResponse`, `cache.modify`/`evict`, subscriptions escritas en caché. |
| 4 | **Persistencia en Supabase, calidad y documentación** (15 %) | [06 · Persistencia en Supabase](06_SUPABASE.md) | 50 medicamentos cargados y normalizados (14 categorías, 16 laboratorios), 43 índices (trigramas, facetas, parciales). |
| — | Visión general | [01 · Arquitectura](01_ARQUITECTURA.md) | Diagramas de componentes, despliegue y flujo de un pedido. |

El contrato completo está en [`backend/schema.graphql`](../backend/schema.graphql).

---

## Cómo reproducir la evidencia

| Qué | Cómo |
|---|---|
| Logs del N+1 vs. DataLoader | Arrancar el backend con `DISABLE_DATALOADER=true` y luego con `false`, y ejecutar en Apollo Sandbox la consulta de [03 · N+1](03_N1_DATALOADER.md#6-cómo-reproducirlo). |
| Todas las llamadas van a `/graphql` | Abrir la aplicación con **DevTools → Network**: en *Fetch/XHR* solo aparece `/graphql`; en *WS*, la conexión de subscriptions al mismo `/graphql`. |
| Campos exactos (sin over-fetching) | En DevTools, abrir la petición `Catalog` → *Response*: cada medicamento trae solo los 7 campos de la tarjeta. Al final del catálogo, el panel **"Operación de la vista condensada (sin over-fetching)"** muestra la operación exacta que se envía. |
| Invariantes y consistencia eventual | `cd backend && npm run smoke`: 26 verificaciones de extremo a extremo (fórmula médica, stock, proyección, subscriptions, cancelación). |
| Reglas de dominio | `cd backend && npm test` (Vitest). |
