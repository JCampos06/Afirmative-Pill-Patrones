# 05 · Frontend con Apollo Client

[← Índice](README.md) · Criterio 3 de la rúbrica (20 %)

El frontend es una SPA en **React 19 + Vite**. Toda la comunicación con el backend pasa por **Apollo Client 4**; no hay ningún `fetch` directo.

---

## 1. `ApolloProvider` en la raíz del árbol

[main.tsx:12-22](../frontend/src/main.tsx#L12-L22):

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
);
```

Toda la aplicación comparte **un único cliente y una única caché normalizada** a través del contexto de Apollo. Incluso el `AuthProvider` está dentro: la sesión también se consulta con GraphQL (`query Me`).

---

## 2. Configuración del cliente

### 2.1 Cadena de links

[client.ts:1-6](../frontend/src/apollo/client.ts#L1-L6) y [client.ts:57-122](../frontend/src/apollo/client.ts#L57-L122):

```text
ErrorLink → SetContextLink (JWT) → split ─┬─ subscription → GraphQLWsLink (wss://…/graphql)
                                           └─ query/mutation → HttpLink (https://…/graphql)
```

| Link | Qué hace |
|---|---|
| `ErrorLink` | Centraliza los errores. Si el servidor responde `UNAUTHENTICATED` con una sesión activa, cierra la sesión (token vencido). |
| `SetContextLink` | Agrega `Authorization: Bearer <token>` a cada operación HTTP, leyendo el token de una *reactive var*. |
| `split` | Envía las subscriptions por WebSocket (`graphql-ws`) y el resto por HTTP. **Ambos van al mismo `/graphql`.** El WebSocket envía el token en `connectionParams` y se reinicia al iniciar o cerrar sesión. |

### 2.2 Caché normalizada (`InMemoryCache`)

[client.ts:20-53](../frontend/src/apollo/client.ts#L20-L53):

| Configuración | Para qué |
|---|---|
| `possibleTypes` (generado por codegen) | Permite leer fragmentos sobre **uniones e interfaces** (`PlaceOrderResult`, `DomainError`). |
| `Query.medications: relayStylePagination(['filter', 'sort'])` | `fetchMore` **concatena** páginas, y cada combinación de filtro y orden tiene su propia lista en caché. |
| `Query.medication.read → toReference(...)` | `medication(id)` apunta a la entidad `Medication` ya normalizada. Si la ficha ya se visitó y tiene todos sus campos en caché, se lee **sin ir a la red**; si faltan campos, Apollo envía la consulta al servidor. |
| `Cart.items`, `OrderSummary.items`, `statusHistory`: `merge: false` | Estas listas se **reemplazan** con la versión del servidor en lugar de mezclarse. |
| `Availability`, `PrescriptionSummary`: `merge: true` | Objetos sin `id` que se fusionan dentro de su entidad padre. |
| `defaultOptions.watchQuery: cache-and-network` | Muestra lo que hay en caché al instante y lo refresca en segundo plano. |

### 2.3 Operaciones tipadas

Todas las operaciones están en [operations.ts](../frontend/src/graphql/operations.ts), organizadas con **fragmentos** reutilizables (`MedicationCardFields`, `CartFields`, `OrderSummaryFields`…). **GraphQL Code Generator** genera los tipos TypeScript a partir de `backend/schema.graphql` ([codegen.ts](../frontend/codegen.ts)): si una vista pide un campo que no existe en el schema, el proyecto no compila.

---

## 3. Uso idiomático de los hooks

| Vista | Hooks | Detalle |
|---|---|---|
| Catálogo ([CatalogPage.tsx](../frontend/src/pages/CatalogPage.tsx)) | `useQuery` + `fetchMore` | `notifyOnNetworkStatusChange` distingue la carga inicial de "cargar más". Los filtros forman parte de las variables. |
| Ficha ([MedicationDetailPage.tsx](../frontend/src/pages/MedicationDetailPage.tsx)) | `useQuery` | Selección de campos más amplia que la tarjeta. |
| Carrito ([CartPage.tsx](../frontend/src/pages/CartPage.tsx), [useCartActions.ts](../frontend/src/hooks/useCartActions.ts)) | `useQuery`, `useMutation` | Mutations con `update` y `optimisticResponse`. |
| Mis pedidos ([OrdersPage.tsx](../frontend/src/pages/OrdersPage.tsx)) | `useQuery`, `useReactiveVar` | `startPolling`/`stopPolling` solo mientras hay pedidos sin proyectar. |
| Seguimiento ([OrderTrackingPage.tsx](../frontend/src/pages/OrderTrackingPage.tsx)) | `useQuery`, `useSubscription`, `useMutation` | La subscription escribe en la caché; la cancelación actualiza la caché con el acuse. |
| Bandeja del farmacéutico ([PharmacyPage.tsx](../frontend/src/pages/PharmacyPage.tsx)) | `useQuery`, `useSubscription`, `useMutation` | Feed en vivo (`orderFeed`) y comandos de revisión y despacho. |
| Menú y barra superior ([Layout.tsx](../frontend/src/components/Layout.tsx)) | `useQuery` | Comparte la entrada `myCart` de la caché con el carrito: el contador se actualiza solo. |

**Estados reactivos:** cada vista maneja explícitamente `loading` (indicador de carga), `error` (alerta con el mensaje) y `data`. Los errores de negocio **no** llegan por `error`: llegan en `data` como miembros de la unión y se pintan con el componente [`DomainErrorAlert`](../frontend/src/components/DomainErrorAlert.tsx), que muestra el detalle de cada tipo (campos inválidos, faltantes de stock, medicamentos que exigen fórmula).

---

## 4. Actualización inteligente de la caché tras una mutation

| Mutation | Estrategia | Resultado en la UI | Código |
|---|---|---|---|
| `addItemToCart` y demás del carrito | El `Cart` devuelto se **normaliza por `id`**; `update` escribe además `Query.myCart` cuando el carrito se acaba de crear | El contador del menú y la página del carrito cambian sin volver a consultar | [useCartActions.ts:22-26](../frontend/src/hooks/useCartActions.ts#L22-L26) |
| `updateCartItemQuantity`, `removeItemFromCart` | **`optimisticResponse`** con los totales recalculados en el cliente | La cantidad y el total cambian **antes** de que responda el servidor; si falla, Apollo revierte | [useCartActions.ts:66-88](../frontend/src/hooks/useCartActions.ts#L66-L88) |
| `placeOrder` | `cache.modify` deja `myCart` en `null`; `cache.evict` retira el carrito y la lista `myOrders`; `cache.gc()` limpia | El carrito queda vacío al instante y "Mis pedidos" se reconstruye desde el read model | [CartPage.tsx:83-91](../frontend/src/pages/CartPage.tsx#L83-L91) |
| `reviewPrescription`, `dispatchOrder` | `cache.modify` cambia el `status` de la entidad `OrderSummary` y la **retira de la bandeja** actual | La orden sale de "Por revisar" sin esperar a la proyección | [PharmacyPage.tsx:46-57](../frontend/src/pages/PharmacyPage.tsx#L46-L57) |
| `cancelOrder` | `cache.modify` con el estado confirmado por el write model | El estado cambia al instante y la UI indica que el historial se está sincronizando | [OrderTrackingPage.tsx:195-202](../frontend/src/pages/OrderTrackingPage.tsx#L195-L202) |

---

## 5. Subscriptions en tiempo real (escenario C)

| Subscription | Dónde | Qué hace con el dato |
|---|---|---|
| `orderStatusChanged(orderId)` | Seguimiento del pedido | `client.writeQuery` escribe la proyección recibida en la caché: la barra de progreso y el historial se actualizan sin otra petición ([OrderTrackingPage.tsx:40-47](../frontend/src/pages/OrderTrackingPage.tsx#L40-L47)). |
| `orderFeed` | Bandeja del farmacéutico | La entidad ya se actualiza por normalización; además se refresca la bandeja porque la orden puede cambiar de pestaña ([PharmacyPage.tsx:70-82](../frontend/src/pages/PharmacyPage.tsx#L70-L82)). |

Si el entorno no admite WebSocket, una sola variable (`VITE_ENABLE_SUBSCRIPTIONS=false`) cambia el seguimiento a *polling* sin tocar las vistas.

---

## 6. Estado local con reactive vars

[state.ts](../frontend/src/apollo/state.ts):

| Reactive var | Contenido | Uso |
|---|---|---|
| `authTokenVar` ([state.ts:29](../frontend/src/apollo/state.ts#L29)) | JWT de la sesión (persistido en `localStorage`) | Lo leen el `SetContextLink` y el WebSocket en cada operación. |
| `pendingOrdersVar` ([state.ts:60](../frontend/src/apollo/state.ts#L60)) | Acuses de `placeOrder` cuya proyección aún no llega | Pinta "Procesando…" hasta que el read model tiene la orden (ver [04 · CQRS, sección 5](04_CQRS.md#5-qué-ve-el-usuario-mientras-tanto)). |
