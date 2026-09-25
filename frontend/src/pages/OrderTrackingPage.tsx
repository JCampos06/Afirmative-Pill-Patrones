/**
 * Seguimiento de la orden (Escenario C).
 *
 * Consistencia eventual en la UI:
 *  1. Tras placeOrder el cliente tiene el ACUSE del comando (pendingOrdersVar)
 *     pero la proyección puede no existir aún → se muestra "Procesando" y se
 *     consulta periódicamente hasta que aparece.
 *  2. Los cambios de estado llegan por GraphQL Subscription y se escriben en
 *     la caché; sin WebSocket (Vercel) se usa polling.
 *  3. Tras un comando (cancelar) la caché refleja de inmediato el estado
 *     confirmado por el write model y se indica que la proyección se sincroniza.
 */
import { useMutation, useQuery, useReactiveVar, useSubscription } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { POLL_INTERVAL_MS, SUBSCRIPTIONS_ENABLED } from '../apollo/config';
import { pendingOrdersVar, resolvePendingOrders } from '../apollo/state';
import { useAuth } from '../auth/AuthContext';
import { OrderStatusBadge } from '../components/badges';
import { DomainErrorAlert, type DomainErrorLike } from '../components/DomainErrorAlert';
import { ArrowLeftIcon, ClockIcon, FileTextIcon, InboxIcon, MapPinIcon, PackageIcon, TruckIcon, XIcon } from '../components/icons';
import { OrderLines, OrderProgress, OrderTimeline, PrescriptionDetails, SyncIndicator } from '../components/order';
import { Alert, CardHeader, EmptyState, IconCircle, PageLoader, Spinner } from '../components/ui';
import { CancelOrderMutation, OrderQuery, OrderStatusChangedSubscription } from '../graphql/operations';
import { errorText, formatCOP, formatDateTime } from '../lib/format';

export function OrderTrackingPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const receipt = useReactiveVar(pendingOrdersVar).find((r) => r.orderId === id);
  const [awaitingVersion, setAwaitingVersion] = useState<number | null>(null);

  const { data, loading, error, startPolling, stopPolling } = useQuery(OrderQuery, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });
  const order = data?.order ?? null;

  // Push del servidor: cada evento proyectado llega aquí y se escribe en caché.
  useSubscription(OrderStatusChangedSubscription, {
    variables: { orderId: id },
    skip: !SUBSCRIPTIONS_ENABLED,
    onData: ({ client, data: message }) => {
      const updated = message.data?.orderStatusChanged;
      if (updated) client.writeQuery({ query: OrderQuery, variables: { id }, data: { order: updated } });
    },
  });

  const isFinal = order?.status === 'DISPATCHED' || order?.status === 'CANCELLED';
  const syncing = order !== null && awaitingVersion !== null && order.projectionVersion < awaitingVersion;
  const needsPolling = !order || syncing || (!SUBSCRIPTIONS_ENABLED && !isFinal);

  useEffect(() => {
    if (needsPolling) startPolling(POLL_INTERVAL_MS);
    else stopPolling();
    return () => stopPolling();
  }, [needsPolling, startPolling, stopPolling]);

  useEffect(() => {
    if (order) resolvePendingOrders([order.id]);
  }, [order]);

  useEffect(() => {
    if (!syncing) setAwaitingVersion(null);
  }, [syncing]);

  if (!order) {
    if (receipt) {
      return (
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="card flex flex-col items-center space-y-4 p-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
              <InboxIcon className="h-7 w-7" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Pedido {receipt.code} recibido</h1>
            <p className="text-slate-600">Reservamos tus productos por un total de {formatCOP(receipt.total)}.</p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Spinner className="h-4 w-4" /> Preparando el resumen de tu pedido…
            </div>
          </div>
          {import.meta.env.DEV && (
            <Alert tone="info" title="¿Por qué este paso intermedio?">
              La orden ya existe en el modelo de escritura, pero la vista de seguimiento se alimenta de una proyección
              de lectura que se construye de forma asíncrona (consistencia eventual). Aparecerá en unos instantes.
            </Alert>
          )}
        </div>
      );
    }
    if (loading) return <PageLoader label="Cargando pedido…" />;
    if (error) return <Alert tone="error" title="No se pudo cargar el pedido">{errorText(error)}</Alert>;
    return (
      <EmptyState icon={<PackageIcon className="h-7 w-7" />} title="Pedido no encontrado">
        Si acabas de crearlo, espera unos segundos: la vista se actualizará sola.{' '}
        <Link to="/pedidos" className="font-semibold text-brand-700 underline">
          Ver mis pedidos
        </Link>
      </EmptyState>
    );
  }

  const canCancel = user?.role === 'PATIENT' && (order.status === 'PENDING_APPROVAL' || order.status === 'APPROVED');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={user?.role === 'PHARMACIST' ? '/farmacia' : '/pedidos'} className="icon-btn" aria-label="Volver">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pedido {order.code}</h1>
            <p className="text-sm text-slate-500">Realizado el {formatDateTime(order.placedAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-full bg-white py-2 pr-5 pl-2 shadow-soft">
          <OrderStatusBadge status={order.status} />
          <span className="text-xl font-bold text-slate-900 tabular-nums">{formatCOP(order.total)}</span>
        </div>
      </div>

      <section className="card space-y-6 p-5 sm:p-6">
        <CardHeader icon={<TruckIcon className="h-5 w-5" />} title="Seguimiento" subtitle={<SyncIndicator order={order} />} />
        <OrderProgress status={order.status} />
        {syncing && (
          <Alert tone="info">
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Cambio registrado. Actualizando el historial de tu pedido…
            </span>
          </Alert>
        )}
        {order.status === 'PENDING_APPROVAL' && (
          <Alert tone="warning">
            {order.requiresPrescription
              ? 'Tu fórmula médica está siendo revisada por un químico farmacéutico.'
              : 'Pedido de venta libre: será aprobado automáticamente en unos segundos.'}
          </Alert>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <CardHeader icon={<PackageIcon className="h-5 w-5" />} title="Productos" subtitle={`${order.itemCount} unidades`} />
            <div className="mt-4">
              <OrderLines items={order.items} />
            </div>
            <div className="mt-2 flex justify-between rounded-2xl bg-slate-50 px-4 py-3 font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{formatCOP(order.total)}</span>
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <CardHeader icon={<ClockIcon className="h-5 w-5" />} tone="sky" title="Historial" subtitle="Cambios de estado de tu pedido" />
            <div className="mt-5 pl-2">
              <OrderTimeline history={order.statusHistory} />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-4 p-5 sm:p-6">
            <CardHeader icon={<MapPinIcon className="h-5 w-5" />} tone="emerald" title="Envío" subtitle={order.customerName} />
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{order.shippingAddress}</p>
          </section>
          {order.prescription && (
            <section className="card space-y-4 p-5 sm:p-6">
              <CardHeader icon={<FileTextIcon className="h-5 w-5" />} tone="violet" title="Fórmula médica" />
              <PrescriptionDetails prescription={order.prescription} />
            </section>
          )}
          {canCancel && (
            <CancelOrderPanel
              orderId={order.id}
              onAccepted={() => setAwaitingVersion(order.projectionVersion + 1)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function CancelOrderPanel({ orderId, onAccepted }: { orderId: string; onAccepted: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<DomainErrorLike | null>(null);
  const [cancelOrder, { loading }] = useMutation(CancelOrderMutation);

  async function handleCancel() {
    setError(null);
    const { data } = await cancelOrder({
      variables: { input: { orderId, reason } },
      update(cache, { data: result }) {
        const r = result?.cancelOrder;
        if (r?.__typename !== 'OrderCommandPayload') return;
        // La caché refleja al instante el estado confirmado por el write model.
        cache.modify({
          id: cache.identify({ __typename: 'OrderSummary', id: orderId }),
          fields: { status: () => r.receipt.status },
        });
      },
    });
    const result = data?.cancelOrder;
    if (result?.__typename === 'OrderCommandPayload') {
      onAccepted();
      setOpen(false);
    } else if (result) {
      setError(result as DomainErrorLike);
    }
  }

  return (
    <section className="card space-y-3 p-5 sm:p-6">
      {!open ? (
        <button type="button" className="btn-secondary w-full text-rose-700 hover:border-rose-200 hover:bg-rose-50" onClick={() => setOpen(true)}>
          <XIcon className="h-4 w-4" /> Cancelar pedido
        </button>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <IconCircle tone="rose" size="sm">
              <XIcon className="h-4 w-4" />
            </IconCircle>
            <p className="font-semibold text-slate-900">Cancelar pedido</p>
          </div>
          <label className="label" htmlFor="reason">
            Motivo de la cancelación
          </label>
          <textarea id="reason" className="input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <DomainErrorAlert error={error} />}
          <div className="flex gap-2">
            <button type="button" className="btn-danger flex-1" disabled={loading} onClick={handleCancel}>
              {loading ? 'Cancelando…' : 'Confirmar cancelación'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Volver
            </button>
          </div>
        </>
      )}
    </section>
  );
}
