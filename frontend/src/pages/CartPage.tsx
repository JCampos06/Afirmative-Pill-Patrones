import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { addPendingOrder } from '../apollo/state';
import { useAuth } from '../auth/AuthContext';
import { RxBadge } from '../components/badges';
import { DomainErrorAlert, fieldError, type DomainErrorLike } from '../components/DomainErrorAlert';
import { CartIcon, FileTextIcon, PillIcon, TagIcon, TrashIcon } from '../components/icons';
import { Alert, CardHeader, EmptyState, IconCircle, PageHeader, PageLoader, Spinner } from '../components/ui';
import type { CartFieldsFragment } from '../gql/graphql';
import { MyCartQuery, PlaceOrderMutation } from '../graphql/operations';
import { useCartActions } from '../hooks/useCartActions';
import { formatCOP, todayIso } from '../lib/format';

const MAX_UNITS = 10;

export function CartPage() {
  const { data, loading } = useQuery(MyCartQuery);
  const cart = data?.myCart;

  if (loading && !data) return <PageLoader label="Cargando carrito…" />;
  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState icon={<CartIcon className="h-7 w-7" />} title="Tu carrito está vacío">
        Explora el{' '}
        <Link to="/" className="font-semibold text-brand-700 underline">
          catálogo
        </Link>{' '}
        y agrega tus medicamentos.
      </EmptyState>
    );
  }
  return <CartWithCheckout cart={cart} />;
}

function CartWithCheckout({ cart }: { cart: CartFieldsFragment }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { updateQuantity, removeItem, updating } = useCartActions();
  const [placeOrder, { loading: placing }] = useMutation(PlaceOrderMutation);

  // Una clave por intento de compra: reenviar el formulario no duplica la orden.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [address, setAddress] = useState('');
  const [rx, setRx] = useState({
    doctorName: '',
    doctorLicense: '',
    patientDocument: user?.documentNumber ?? '',
    issuedAt: todayIso(),
    documentUrl: '',
  });
  const [checkoutError, setCheckoutError] = useState<DomainErrorLike | null>(null);
  const [itemError, setItemError] = useState<DomainErrorLike | null>(null);

  const rxItems = cart.items.filter((i) => i.medication.requiresPrescription);
  const setRxField = (key: keyof typeof rx) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRx((r) => ({ ...r, [key]: e.target.value }));

  async function handleQuantity(medicationId: string, quantity: number) {
    setItemError(null);
    const result = await updateQuantity(cart, medicationId, quantity);
    if (result && result.__typename !== 'CartPayload') setItemError(result as DomainErrorLike);
  }

  async function handleRemove(medicationId: string) {
    setItemError(null);
    const result = await removeItem(cart, medicationId);
    if (result && result.__typename !== 'CartPayload') setItemError(result as DomainErrorLike);
  }

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    setCheckoutError(null);
    const { data } = await placeOrder({
      variables: {
        input: {
          cartId: cart.id,
          shippingAddress: address,
          idempotencyKey,
          prescription: cart.requiresPrescription ? { ...rx, documentUrl: rx.documentUrl || null } : null,
        },
      },
      update(cache, { data: result }) {
        if (result?.placeOrder.__typename !== 'PlaceOrderPayload') return;
        // El carrito quedó CHECKED_OUT en el write model → se retira de la caché.
        cache.modify({ fields: { myCart: () => null } });
        cache.evict({ id: cache.identify({ __typename: 'Cart', id: cart.id }) });
        // La lista de pedidos se reconstruirá desde el read model al visitarla.
        cache.evict({ fieldName: 'myOrders' });
        cache.gc();
      },
    });

    const result = data?.placeOrder;
    if (!result) return;
    if (result.__typename === 'PlaceOrderPayload') {
      // Acuse del comando: se muestra como "procesando" hasta que llegue la proyección.
      addPendingOrder(result.receipt);
      navigate(`/pedidos/${result.receipt.orderId}`);
    } else {
      setCheckoutError(result as DomainErrorLike);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tu carrito" subtitle="Revisa tus productos y confirma el pedido." />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <section className="card h-fit space-y-4 p-5 sm:p-6">
          <CardHeader
            icon={<CartIcon className="h-5 w-5" />}
            title="Productos"
            subtitle={`${cart.items.length} referencias · ${cart.itemCount} unidades`}
          />
          {itemError && <DomainErrorAlert error={itemError} />}
          <ul className="space-y-2">
            {cart.items.map((item) => {
              const maxQty = Math.max(item.quantity, Math.min(MAX_UNITS, item.medication.availability.unitsAvailable));
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 p-4">
                  <div className="flex min-w-48 flex-1 items-center gap-3">
                    <IconCircle tone={item.medication.requiresPrescription ? 'violet' : 'brand'}>
                      <PillIcon className="h-5 w-5" />
                    </IconCircle>
                    <div className="min-w-0">
                      <Link to={`/medicamentos/${item.medication.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                        {item.medication.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {item.medication.presentation} · {formatCOP(item.medication.price)} c/u
                      </p>
                      <div className="mt-1.5">
                        <RxBadge required={item.medication.requiresPrescription} />
                      </div>
                    </div>
                  </div>
                  <label className="sr-only" htmlFor={`qty-${item.id}`}>
                    Cantidad
                  </label>
                  <select
                    id={`qty-${item.id}`}
                    className="select-pill"
                    value={item.quantity}
                    disabled={updating}
                    onChange={(e) => void handleQuantity(item.medication.id, Number(e.target.value))}
                  >
                    {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="w-28 text-right font-bold text-slate-900 tabular-nums">{formatCOP(item.lineTotal)}</span>
                  <button
                    type="button"
                    className="icon-btn h-9 w-9 hover:border-rose-200 hover:text-rose-600"
                    disabled={updating}
                    onClick={() => void handleRemove(item.medication.id)}
                    aria-label={`Quitar ${item.medication.name}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <form className="card h-fit space-y-5 p-5 sm:p-6 lg:sticky lg:top-28" onSubmit={handleCheckout}>
          <CardHeader icon={<TagIcon className="h-5 w-5" />} tone="amber" title="Resumen del pedido" />
          <div className="space-y-1.5 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Unidades</span>
              <span>{cart.itemCount}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{formatCOP(cart.subtotal)}</span>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="address">
              Dirección de envío
            </label>
            <input
              id="address"
              className="input"
              placeholder="Calle 100 # 15-20, Bogotá"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
            <Hint message={fieldError(checkoutError, 'shippingAddress')} />
          </div>

          {cart.requiresPrescription && (
            <fieldset className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
              <legend className="sr-only">Soporte de fórmula médica</legend>
              <div className="flex items-center gap-2.5">
                <IconCircle tone="violet" size="sm">
                  <FileTextIcon className="h-4 w-4" />
                </IconCircle>
                <p className="text-sm font-semibold text-violet-900">℞ Soporte de fórmula médica</p>
              </div>
              <p className="text-xs text-violet-900">
                Obligatorio para: {rxItems.map((i) => i.medication.name).join(', ')}.
              </p>
              <div>
                <label className="label" htmlFor="doctorName">
                  Médico tratante
                </label>
                <input id="doctorName" className="input" value={rx.doctorName} onChange={setRxField('doctorName')} placeholder="Dra. Ana Ruiz" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="doctorLicense">
                    Registro médico
                  </label>
                  <input id="doctorLicense" className="input" value={rx.doctorLicense} onChange={setRxField('doctorLicense')} placeholder="RM-12345" />
                  <Hint message={fieldError(checkoutError, 'prescription.doctorLicense')} />
                </div>
                <div>
                  <label className="label" htmlFor="issuedAt">
                    Fecha
                  </label>
                  <input id="issuedAt" type="date" className="input" value={rx.issuedAt} max={todayIso()} onChange={setRxField('issuedAt')} />
                  <Hint message={fieldError(checkoutError, 'prescription.issuedAt')} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="patientDocument">
                  Documento del paciente
                </label>
                <input id="patientDocument" className="input" value={rx.patientDocument} onChange={setRxField('patientDocument')} />
                <Hint message={fieldError(checkoutError, 'prescription.patientDocument')} />
              </div>
              <div>
                <label className="label" htmlFor="documentUrl">
                  Enlace a la fórmula (opcional)
                </label>
                <input id="documentUrl" type="url" className="input" value={rx.documentUrl} onChange={setRxField('documentUrl')} placeholder="https://…" />
              </div>
            </fieldset>
          )}

          {checkoutError && <DomainErrorAlert error={checkoutError} />}

          <button type="submit" className="btn-primary w-full py-3" disabled={placing || updating}>
            {placing ? (
              <>
                <Spinner className="h-4 w-4 text-white" /> Confirmando pedido…
              </>
            ) : (
              `Confirmar pedido · ${formatCOP(cart.subtotal)}`
            )}
          </button>

          <Alert tone="info">
            Al confirmar, el inventario se reserva de forma atómica. El seguimiento del pedido se actualiza en tiempo real.
          </Alert>
        </form>
      </div>
    </div>
  );
}

function Hint({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs font-medium text-rose-700">{message}</p> : null;
}
