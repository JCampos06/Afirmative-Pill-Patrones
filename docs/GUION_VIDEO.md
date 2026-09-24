# Guion sugerido para el video de sustentación (5–8 minutos)

Graba en **entorno local**: ahí funcionan las GraphQL Subscriptions (WebSocket) y ves los logs del servidor en la terminal.

## Preparación (antes de grabar)

1. Terminal 1: `cd backend && npm run dev` (deja visibles los logs).
2. Terminal 2: `cd frontend && npm run dev`.
3. Navegador A (normal): `http://localhost:5173` con **DevTools → Network** abierto y filtro **Fetch/XHR**.
4. Navegador B (incógnito): sesión del farmacéutico, `farmacia@afirmativepill.co` / `Farmacia123*`.
5. Opcional: `npm run db:reset` en `backend/` para empezar con datos limpios.

---

## Minuto 0:00 – 0:45 · Introducción y arquitectura

- Presenta el problema: e-commerce farmacéutico con fórmula médica, stock crítico y catálogos pesados.
- Muestra el diagrama del README (sección 2): React + Apollo Client → `/graphql` → Apollo Server → comandos / consultas / DataLoader → Supabase (write model, outbox, read model).

## 0:45 – 2:00 · Escenario A: catálogo sin over-fetching

1. En el catálogo, busca `acetaminofen` sin tilde y luego filtra por la categoría *Cardiovascular*.
2. **Network:** abre la petición `graphql`. Señala que:
   - la URL es `/graphql` (y en **Payload**, `operationName: Catalog`);
   - la **Response** trae solo `id, name, presentation, dosage, price, requiresPrescription, availability.status`.
3. Abre el acordeón **"{ } Operación de la vista condensada"** al final de la página.
4. Entra a la ficha de un medicamento: la nueva petición `MedicationDetail` sí pide laboratorio, indicaciones y principio activo.
5. Pulsa **Cargar más**: es paginación por cursor (`after`) y la caché concatena las páginas.

## 2:00 – 3:00 · N+1 y DataLoader (logs del servidor)

1. En Apollo Sandbox (`http://localhost:4000/graphql`) ejecuta:
   ```graphql
   query Demo { medications(first: 12) { edges { node { name category { name } laboratory { name } } } } }
   ```
2. En la terminal del backend señala:
   - `DATALOADER categoryById · lote de 9 claves … → 1 consulta SQL`
   - `◀ query Demo · 3 consultas SQL · 2 lotes DataLoader`
3. Contraste (opcional, 30 s): detén el backend y arráncalo con `DISABLE_DATALOADER=true`. En PowerShell: `$env:DISABLE_DATALOADER="true"; npm run dev`. Repite la query: **25 consultas SQL**.

## 3:00 – 5:00 · Escenario B: carrito y comandos con invariantes

1. Inicia sesión como paciente (`paciente@afirmativepill.co` / `Paciente123*`).
2. Agrega *Acetaminofén Forte* (venta libre) y *Amoxicilina Clavulanato* (℞). El contador del carrito cambia sin recargar: la caché de Apollo está normalizada.
3. En el carrito cambia una cantidad (actualización optimista).
4. **Invariante de fórmula:** escribe un documento de paciente distinto en la fórmula → `ValidationError` con mensaje por campo. Explica que, si el carrito tuviera ℞ y no se enviara fórmula, el comando responde `PrescriptionRequiredError`.
5. Corrige los datos y confirma. En **Network** muestra la mutation `PlaceOrder` y su respuesta `PlaceOrderPayload { receipt }`.
6. En los logs: `COMMAND PlaceOrder → AP-00xxxx` y, 1,5 s después, `PROJECTOR #n OrderPlaced proyectado`.

## 5:00 – 6:30 · Escenario C: proyección, consistencia eventual y tiempo real

1. Señala la pantalla intermedia "Pedido recibido · preparando resumen…": el comando ya se confirmó, pero la proyección aún no existe. Después aparece el seguimiento.
2. En la terminal, muestra las líneas `Subscription → orden … ahora PENDING_APPROVAL`.
3. En el navegador B (farmacéutico), la orden aparece en la bandeja (feed en vivo). Pulsa **Aprobar fórmula**.
4. En el navegador A el estado cambia a **Aprobado** sin recargar (Network → **WS** muestra los mensajes `next`).
5. En B pasa a **Por despachar** y pulsa **Despachar**: A muestra **Despachado** y el historial completo.
6. (Opcional) Crea un pedido solo con venta libre: pasa a **Aprobado** automáticamente (política del sistema, actor *Sistema*).

## 6:30 – 7:30 · Cierre: CQRS y Zero-REST

- **CQRS:** `commands/` escribe en el write model y el outbox; `queries/` lee solo `medication_catalog` y `order_projections`; el proyector las conecta.
- **Zero-REST:** en Network todas las peticiones van a `/graphql`. En Supabase, RLS bloquea la API REST automática.
- **Stock atómico:** `SELECT … FOR UPDATE` + `CHECK (stock >= 0)`. Menciona `npm run smoke` (26 verificaciones).
