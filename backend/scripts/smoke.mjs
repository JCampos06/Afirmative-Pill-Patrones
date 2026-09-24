/**
 * Prueba de humo end-to-end contra un backend en ejecución.
 *   npm run smoke                      (usa http://localhost:4000/graphql)
 *   GRAPHQL_URL=https://.../graphql npm run smoke
 *
 * Recorre: catálogo → carrito → invariante de fórmula → placeOrder →
 * proyección eventual → subscription → revisión del farmacéutico → despacho.
 */
import { createClient } from 'graphql-ws';

const HTTP_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000/graphql';
const WS_URL = HTTP_URL.replace(/^http/, 'ws');
const SKIP_WS = process.env.SKIP_WS === 'true';

let failures = 0;
const ok = (msg) => console.log(`  \x1b[32m✔\x1b[0m ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  \x1b[31m✖ ${msg}\x1b[0m`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(query, variables = {}, token) {
  const res = await fetch(HTTP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors, null, 2));
  return body.data;
}

async function login(email, password) {
  const data = await gql(
    `mutation Login($input: LoginInput!) {
      login(input: $input) { __typename ... on AuthPayload { token user { fullName role documentNumber } } }
    }`,
    { input: { email, password } },
  );
  if (data.login.__typename !== 'AuthPayload') throw new Error(`Login falló: ${data.login.__typename}`);
  return data.login;
}

const CART_FIELDS = `__typename
  ... on CartPayload { cart { id itemCount subtotal requiresPrescription items { quantity medication { name } } } }
  ... on DomainError { code message }`;

async function waitForOrder(orderId, token, predicate, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { order } = await gql(
      `query Order($id: ID!) { order(id: $id) { id code status projectionVersion prescription { status } statusHistory { status actor } } }`,
      { id: orderId },
      token,
    );
    if (order && predicate(order)) return order;
    await sleep(500);
  }
  return null;
}

console.log(`\nAfirmative Pill · smoke test contra ${HTTP_URL}\n`);

// 1. Catálogo --------------------------------------------------------
console.log('1) Catálogo (lecturas optimizadas + DataLoader)');
const catalog = await gql(`query {
  medications(first: 8, filter: { search: "acetaminofen" }) { totalCount edges { node { name price category { name } laboratory { name } } } }
  all: medications(first: 50) { totalCount pageInfo { hasNextPage endCursor } edges { node { id category { name } laboratory { name } } } }
}`);
check(catalog.medications.totalCount === 1, 'Búsqueda sin tildes "acetaminofen" encuentra "Acetaminofén Forte"');
check(catalog.all.totalCount === 50, 'El catálogo proyectado tiene 50 medicamentos');

// 2. Autenticación -----------------------------------------------------
console.log('2) Autenticación por GraphQL');
const patient = await login('paciente@afirmativepill.co', 'Paciente123*');
const pharmacist = await login('farmacia@afirmativepill.co', 'Farmacia123*');
check(patient.user.role === 'PATIENT' && pharmacist.user.role === 'PHARMACIST', 'Login de paciente y farmacéutico');
const badLogin = await gql(
  `mutation { login(input: { email: "paciente@afirmativepill.co", password: "mala" }) { __typename } }`,
);
check(badLogin.login.__typename === 'InvalidCredentialsError', 'Credenciales erróneas → InvalidCredentialsError');

// 3. Carrito ----------------------------------------------------------
console.log('3) Carrito en el servidor (comandos)');
await gql(`mutation { clearCart { __typename } }`, {}, patient.token);
const add1 = await gql(
  `mutation($input: AddItemToCartInput!) { addItemToCart(input: $input) { ${CART_FIELDS} } }`,
  { input: { medicationId: '1', quantity: 2 } },
  patient.token,
);
const add3 = await gql(
  `mutation($input: AddItemToCartInput!) { addItemToCart(input: $input) { ${CART_FIELDS} } }`,
  { input: { medicationId: '3', quantity: 1 } },
  patient.token,
);
check(add1.addItemToCart.__typename === 'CartPayload', 'addItemToCart OTC (Acetaminofén x2)');
check(add3.addItemToCart.cart.requiresPrescription === true, 'addItemToCart Rx (Amoxicilina) marca requiresPrescription');
check(add3.addItemToCart.cart.subtotal === 9500 * 2 + 46000, `Subtotal correcto (${add3.addItemToCart.cart.subtotal})`);
const tooMany = await gql(
  `mutation($input: AddItemToCartInput!) { addItemToCart(input: $input) { ${CART_FIELDS} } }`,
  { input: { medicationId: '1', quantity: 11 } },
  patient.token,
);
check(tooMany.addItemToCart.__typename === 'ValidationError', 'Más de 10 unidades → ValidationError');
const cartId = add3.addItemToCart.cart.id;

// 4. Invariante de fórmula ---------------------------------------------
console.log('4) Invariante: fórmula médica obligatoria');
const PLACE = `mutation Place($input: PlaceOrderInput!) {
  placeOrder(input: $input) {
    __typename
    ... on PlaceOrderPayload { receipt { orderId code status total requiresPrescription } }
    ... on PrescriptionRequiredError { code message medications { name } }
    ... on ValidationError { code fieldErrors { field message } }
    ... on DomainError { code message }
  }
}`;
const noRx = await gql(PLACE, { input: { cartId, shippingAddress: 'Calle 100 # 15-20, Bogotá' } }, patient.token);
check(
  noRx.placeOrder.__typename === 'PrescriptionRequiredError' &&
    noRx.placeOrder.medications[0]?.name === 'Amoxicilina Clavulanato',
  'Sin fórmula → PrescriptionRequiredError con el medicamento afectado',
);
const today = new Date().toISOString().slice(0, 10);
const wrongDoc = await gql(
  PLACE,
  {
    input: {
      cartId,
      shippingAddress: 'Calle 100 # 15-20, Bogotá',
      prescription: { doctorName: 'Dra. Ana Ruiz', doctorLicense: 'RM-12345', patientDocument: '999', issuedAt: today },
    },
  },
  patient.token,
);
check(wrongDoc.placeOrder.__typename === 'ValidationError', 'Fórmula con documento ajeno → ValidationError');

// 5. placeOrder + consistencia eventual + subscription -----------------
console.log('5) placeOrder, proyección eventual y subscription');
const before = await gql(`query { medication(id: "3") { availability { unitsAvailable } } }`);
let wsUpdates = [];
let wsClient;
const placed = await gql(
  PLACE,
  {
    input: {
      cartId,
      shippingAddress: 'Calle 100 # 15-20, Bogotá',
      idempotencyKey: `smoke-${Date.now()}`,
      prescription: {
        doctorName: 'Dra. Ana Ruiz',
        doctorLicense: 'RM-12345',
        patientDocument: patient.user.documentNumber,
        issuedAt: today,
      },
    },
  },
  patient.token,
);
check(placed.placeOrder.__typename === 'PlaceOrderPayload', `Orden aceptada: ${placed.placeOrder.receipt?.code}`);
const receipt = placed.placeOrder.receipt;
check(receipt.status === 'PENDING_APPROVAL', 'El acuse devuelve PENDING_APPROVAL');

if (!SKIP_WS) {
  wsClient = createClient({ url: WS_URL, connectionParams: { authorization: `Bearer ${patient.token}` } });
  wsClient.subscribe(
    {
      query: `subscription($id: ID!) { orderStatusChanged(orderId: $id) { code status projectionVersion } }`,
      variables: { id: receipt.orderId },
    },
    { next: (msg) => wsUpdates.push(msg.data.orderStatusChanged), error: (e) => fail(`WS: ${JSON.stringify(e)}`), complete: () => {} },
  );
}

const immediate = await gql(`query($id: ID!) { order(id: $id) { status } }`, { id: receipt.orderId }, patient.token);
check(immediate.order === null, 'Justo después del comando la proyección aún no existe (consistencia eventual)');
const projected = await waitForOrder(receipt.orderId, patient.token, (o) => o.status === 'PENDING_APPROVAL');
check(projected?.prescription?.status === 'PENDING_REVIEW', 'La proyección aparece con la fórmula PENDING_REVIEW');
await sleep(300);
const after = await gql(`query { medication(id: "3") { availability { unitsAvailable } } }`);
check(
  after.medication.availability.unitsAvailable === before.medication.availability.unitsAvailable - 1,
  'El catálogo proyectado descontó el stock reservado',
);
const replay = await gql(
  PLACE,
  { input: { cartId, shippingAddress: 'Calle 100 # 15-20, Bogotá' } },
  patient.token,
);
check(replay.placeOrder.__typename === 'InvalidStateTransitionError', 'Reusar un carrito confirmado → InvalidStateTransitionError');

// 6. Farmacéutico ------------------------------------------------------
console.log('6) Flujo del químico farmacéutico');
const forbidden = await fetch(HTTP_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${patient.token}` },
  body: JSON.stringify({ query: '{ ordersForReview { id } }' }),
}).then((r) => r.json());
check(forbidden.errors?.[0]?.extensions?.code === 'FORBIDDEN', 'Un paciente no puede ver la bandeja → FORBIDDEN');
const inbox = await gql(`{ ordersForReview { id code } }`, {}, pharmacist.token);
check(inbox.ordersForReview.some((o) => o.id === receipt.orderId), 'La orden aparece en la bandeja del farmacéutico');
const REVIEW = `mutation($input: ReviewPrescriptionInput!) { reviewPrescription(input: $input) {
  __typename ... on OrderCommandPayload { receipt { status } } ... on DomainError { code message } } }`;
const approved = await gql(REVIEW, { input: { orderId: receipt.orderId, decision: 'APPROVE' } }, pharmacist.token);
check(approved.reviewPrescription.receipt?.status === 'APPROVED', 'reviewPrescription APPROVE → APPROVED (write model)');
const again = await gql(REVIEW, { input: { orderId: receipt.orderId, decision: 'APPROVE' } }, pharmacist.token);
check(again.reviewPrescription.__typename === 'InvalidStateTransitionError', 'Revisar dos veces → InvalidStateTransitionError');
const dispatched = await gql(
  `mutation($input: DispatchOrderInput!) { dispatchOrder(input: $input) { __typename ... on OrderCommandPayload { receipt { status } } } }`,
  { input: { orderId: receipt.orderId } },
  pharmacist.token,
);
check(dispatched.dispatchOrder.receipt?.status === 'DISPATCHED', 'dispatchOrder → DISPATCHED');
const final = await waitForOrder(receipt.orderId, patient.token, (o) => o.status === 'DISPATCHED');
check(final?.statusHistory.length === 3, 'Historial proyectado: PENDING_APPROVAL → APPROVED → DISPATCHED');
if (!SKIP_WS) {
  await sleep(500);
  const statuses = wsUpdates.map((u) => u.status);
  check(
    statuses.includes('APPROVED') && statuses.includes('DISPATCHED'),
    `Subscription recibió los cambios en tiempo real: ${statuses.join(' → ')}`,
  );
}

// 7. Pedido OTC con aprobación automática --------------------------------
console.log('7) Pedido de venta libre con aprobación automática (política)');
await gql(
  `mutation($input: AddItemToCartInput!) { addItemToCart(input: $input) { ${CART_FIELDS} } }`,
  { input: { medicationId: '4', quantity: 1 } },
  patient.token,
);
const { myCart } = await gql(`{ myCart { id } }`, {}, patient.token);
const otc = await gql(PLACE, { input: { cartId: myCart.id, shippingAddress: 'Carrera 7 # 72-41, Bogotá' } }, patient.token);
check(otc.placeOrder.receipt?.requiresPrescription === false, `Orden OTC aceptada sin fórmula: ${otc.placeOrder.receipt?.code}`);
const auto = await waitForOrder(otc.placeOrder.receipt.orderId, patient.token, (o) => o.status === 'APPROVED');
check(auto?.statusHistory.at(-1)?.actor === 'SYSTEM', 'La política la aprobó automáticamente (actor SYSTEM)');
const CANCEL = `mutation($input: CancelOrderInput!) { cancelOrder(input: $input) {
  __typename ... on OrderCommandPayload { receipt { status } } ... on DomainError { code } } }`;
const cancelled = await gql(
  CANCEL,
  { input: { orderId: otc.placeOrder.receipt.orderId, reason: 'Ya no lo necesito' } },
  patient.token,
);
check(cancelled.cancelOrder.receipt?.status === 'CANCELLED', 'El paciente cancela → CANCELLED y se libera el stock');

wsClient?.dispose();
console.log(failures === 0 ? '\n\x1b[32mTodo OK ✔\x1b[0m\n' : `\n\x1b[31m${failures} verificaciones fallaron ✖\x1b[0m\n`);
process.exit(failures === 0 ? 0 : 1);
