# 02 · Contrato GraphQL

[← Índice](README.md) · Criterio 1 de la rúbrica (40 %)

El contrato completo está en [`backend/schema.graphql`](../backend/schema.graphql). Es la **fuente única de verdad**: el backend lo carga tal cual y el frontend genera sus tipos TypeScript a partir de él con GraphQL Code Generator.

---

## 1. Principios del diseño

1. **El contrato refleja CQRS.** `Query` lee solo proyecciones, `Mutation` son comandos con intención de negocio y `Subscription` notifica cambios de las proyecciones. Las mutations de órdenes devuelven un **acuse** (`OrderReceipt`, write model) y no la proyección (`OrderSummary`, read model). Así la separación queda explícita en el propio schema ([schema.graphql:316-392](../backend/schema.graphql#L316-L392)).
2. **Los errores de negocio son datos, no excepciones.** Cada comando devuelve una unión `Payload | Error…` con el detalle que el cliente necesita para reaccionar.
3. **La validación de formato ocurre en el borde.** Los scalars personalizados rechazan valores mal formados antes de que lleguen al dominio.
4. **El cliente elige los campos.** La vista condensada y la ficha detallada piden subconjuntos distintos del mismo tipo `Medication`.

---

## 2. Scalars personalizados

| Scalar | Origen | Qué garantiza | Dónde se usa |
|---|---|---|---|
| `Money` | Propio ([scalars.ts:14-36](../backend/src/graphql/scalars.ts#L14-L36)) | Entero **≥ 0** en COP. Rechaza negativos y decimales al recibirlo. | `price`, `total`, `subtotal`, filtros `minPrice`/`maxPrice` |
| `SKU` | Propio ([scalars.ts:38-56](../backend/src/graphql/scalars.ts#L38-L56)) | Formato `MED-000` al entrar **y** al salir. | `Medication.sku`, `medicationBySku(sku:)` |
| `DateTime` | `graphql-scalars` | ISO-8601 en UTC. | Marcas de tiempo de órdenes y proyecciones |
| `Date` | `graphql-scalars` | Fecha calendario sin hora. | `PrescriptionInput.issuedAt` |
| `PositiveInt` | `graphql-scalars` | Entero > 0. | Cantidades del carrito y de la orden |
| `NonEmptyString` | `graphql-scalars` | Texto no vacío ni solo espacios. | Nombre del médico, dirección, motivo de cancelación |
| `EmailAddress` | `graphql-scalars` | Correo válido (RFC 5322). | Registro e inicio de sesión |

**Por qué:** con `Int` o `String` genéricos, una cantidad `0`, un precio `-500` o un SKU `abc` llegarían al comando y habría que validarlos allí. Con scalars, GraphQL rechaza la operación **antes de ejecutar el resolver** (error `BAD_USER_INPUT` si el valor llega en variables, o de validación si llega como literal), y el schema **documenta** la regla.

---

## 3. Enums

| Enum | Valores | Propósito |
|---|---|---|
| `OrderStatus` | `PENDING_APPROVAL`, `APPROVED`, `DISPATCHED`, `CANCELLED` | Estados de la máquina de la orden, los que pide el enunciado. |
| `PrescriptionStatus` | `PENDING_REVIEW`, `APPROVED`, `REJECTED` | Ciclo de revisión de la fórmula. |
| `PrescriptionDecision` | `APPROVE`, `REJECT` | Decisión del farmacéutico (input del comando). |
| `AvailabilityStatus` | `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK` | Disponibilidad **proyectada** del catálogo. |
| `ErrorCode` | `VALIDATION_FAILED`, `NOT_FOUND`, `INSUFFICIENT_STOCK`, `PRESCRIPTION_REQUIRED`, … | Códigos estables: el cliente reacciona sin comparar textos. |
| `Role`, `CartStatus`, `MedicationSortField`, `SortDirection` | — | Roles, estado del carrito y ordenamiento del catálogo. |

---

## 4. Inputs: un input por comando

Cada mutation recibe un `input` con **nombre de intención de negocio**, no un CRUD genérico:

| Mutation | Input | Intención |
|---|---|---|
| `addItemToCart` | `AddItemToCartInput { medicationId, quantity: PositiveInt! = 1 }` | Agregar unidades al carrito |
| `placeOrder` | `PlaceOrderInput { cartId, shippingAddress, prescription: PrescriptionInput, idempotencyKey }` | Confirmar la compra |
| `reviewPrescription` | `ReviewPrescriptionInput { orderId, decision, notes }` | Aprobar o rechazar la fórmula |
| `cancelOrder` | `CancelOrderInput { orderId, reason: NonEmptyString! }` | Cancelar y liberar stock |
| `dispatchOrder` | `DispatchOrderInput { orderId }` | Entregar a la transportadora |

Para las consultas, `MedicationFilter` (8 filtros opcionales combinables) y `MedicationSort` modelan la **búsqueda facetada** del catálogo ([schema.graphql:182-199](../backend/schema.graphql#L182-L199)).

---

## 5. Payloads tipados: uniones de resultado

Cada comando devuelve una **unión** con el caso de éxito y los errores de dominio posibles ([schema.graphql:465-491](../backend/schema.graphql#L465-L491)):

```graphql
union PlaceOrderResult =
    PlaceOrderPayload
  | ValidationError
  | NotFoundError
  | EmptyCartError
  | PrescriptionRequiredError
  | InsufficientStockError
  | InvalidStateTransitionError
```

Todos los errores implementan `interface DomainError { code: ErrorCode!, message: String! }` y además exponen **datos útiles** para la UI:

| Error | Datos extra | Qué hace la UI con ellos |
|---|---|---|
| `ValidationError` | `fieldErrors: [FieldError!]!` | Muestra el mensaje debajo de cada campo del formulario. |
| `InsufficientStockError` | `shortages { medication, requested, available }` | Lista qué medicamento no alcanza y cuántas unidades hay. |
| `PrescriptionRequiredError` | `medications: [Medication!]!` | Nombra los medicamentos que exigen fórmula. |
| `InvalidStateTransitionError` | `currentStatus`, `attemptedStatus` | Explica por qué la operación no aplica (p. ej. cancelar algo ya despachado). |

Así lo consume el frontend ([operations.ts:306-348](../frontend/src/graphql/operations.ts#L306-L348)):

```graphql
mutation PlaceOrder($input: PlaceOrderInput!) {
  placeOrder(input: $input) {
    __typename
    ... on PlaceOrderPayload { receipt { orderId code status total requiresPrescription acceptedAt } }
    ... on DomainError { code message }
    ... on ValidationError { fieldErrors { field message } }
    ... on PrescriptionRequiredError { medications { id name } }
    ... on InsufficientStockError { shortages { requested available medication { id name } } }
  }
}
```

En el servidor, los resolvers de mutations son delgados: delegan en el *Command Handler* y convierten cualquier `DomainError` en el miembro correspondiente de la unión ([mutation.resolvers.ts:13-21](../backend/src/graphql/resolvers/mutation.resolvers.ts#L13-L21)).

**Errores transversales:** autenticación y autorización **no** son resultados de negocio. Se devuelven como errores GraphQL estándar con `extensions.code = UNAUTHENTICATED | FORBIDDEN` ([context.ts:22-39](../backend/src/graphql/context.ts#L22-L39)).

---

## 6. Selección selectiva de campos (contra el over-fetching)

El escenario A pide una vista condensada que no sobrecargue la red móvil. El mismo tipo `Medication` se consulta con dos selecciones distintas:

| Vista | Operación | Campos pedidos |
|---|---|---|
| Tarjeta del catálogo | `query Catalog` con el fragmento `MedicationCardFields` ([operations.ts:11-23](../frontend/src/graphql/operations.ts#L11-L23)) | **7:** `id`, `name`, `presentation`, `dosage`, `price`, `requiresPrescription`, `availability.status` |
| Ficha detallada | `query MedicationDetail` ([operations.ts:181-208](../frontend/src/graphql/operations.ts#L181-L208)) | Los anteriores **más** `sku`, `activeIngredient`, `description`, `category`, `laboratory`, `unitsAvailable`, `syncedAt` |

**Respuesta real** de la vista condensada (primer nodo, capturada contra Supabase): el servidor devuelve **exactamente** los campos pedidos, sin descripción clínica, laboratorio ni categoría.

```json
{
  "id": "1",
  "name": "Acetaminofén Forte",
  "presentation": "Caja x 20 tabletas",
  "dosage": "500 mg",
  "price": 9500,
  "requiresPrescription": false,
  "availability": { "status": "IN_STOCK" }
}
```

Además, como la vista condensada **no** pide `category` ni `laboratory`, el servidor la resuelve con **1 sola consulta SQL** (ver el log de `query Catalog` en [03 · N+1](03_N1_DATALOADER.md#4-evidencia-real-logs-del-servidor)).

**Paginación:** `medications` devuelve una `MedicationConnection` estilo Relay (`edges`, `pageInfo`, `totalCount`, cursor opaco). El cliente pide páginas de 12 y concatena con `fetchMore`, en lugar de descargar los 50 medicamentos de una vez.

---

## 7. Zero-REST: cómo se garantiza

| Capa | Mecanismo | Dónde |
|---|---|---|
| Servidor | Express monta **una sola ruta de datos**: `/graphql` (queries y mutations por HTTP; subscriptions por WebSocket en la misma ruta). No existe ningún otro endpoint. | [app.ts:17](../backend/src/http/app.ts#L17), [app.ts:45-58](../backend/src/http/app.ts#L45-L58), [local-server.ts:22](../backend/src/local-server.ts#L22) |
| Autenticación | Login y registro también son mutations (`login`, `register`) que devuelven un JWT. | [schema.graphql:535-536](../backend/schema.graphql#L535-L536) |
| Cliente | El frontend no usa `fetch` directo: toda comunicación pasa por Apollo Client (`HttpLink` + `GraphQLWsLink`, ambos contra `/graphql`). | [client.ts:57](../frontend/src/apollo/client.ts#L57), [client.ts:90-114](../frontend/src/apollo/client.ts#L90-L114) |
| Base de datos | Supabase genera automáticamente una API REST (PostgREST). Se activa **Row Level Security sin políticas** en las 14 tablas: esa API queda inutilizable y el único camino a los datos es el backend GraphQL. | [004_security.sql](../database/migrations/004_security.sql) |

**Verificación:** en **DevTools → Network**, la pestaña *Fetch/XHR* solo muestra peticiones a `/graphql`, y la pestaña *WS* muestra una sola conexión a `/graphql` para las subscriptions.
