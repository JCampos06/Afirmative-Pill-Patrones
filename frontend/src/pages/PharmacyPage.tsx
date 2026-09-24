/**
 * Bandeja del químico farmacéutico: revisa fórmulas y despacha pedidos.
 * - Lista alimentada por la proyección (ordersForReview).
 * - orderFeed (subscription) refresca la bandeja cuando llegan pedidos nuevos.
 * - Tras cada comando la caché se actualiza al instante (cache.modify):
 *   la orden sale de la lista actual sin esperar a la proyección.
 */
import type { ApolloCache, Reference } from '@apollo/client';
import { useMutation, useQuery, useSubscription } from '@apollo/client/react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SUBSCRIPTIONS_ENABLED } from '../apollo/config';
import { ORDER_STATUS_DOT, OrderStatusBadge } from '../components/badges';
import { DomainErrorAlert, type DomainErrorLike } from '../components/DomainErrorAlert';
import {
  ActivityIcon,
  CheckIcon,
  ClipboardIcon,
  FileTextIcon,
  PackageIcon,
  RefreshIcon,
  TagIcon,
  TruckIcon,
  XIcon,
  ZapIcon,
} from '../components/icons';
import { OrderLines, PrescriptionDetails } from '../components/order';
import { EmptyState, IconCircle, PageHeader, PageLoader, StatCard } from '../components/ui';
import type { OrderCommandResultFieldsFragment, OrderStatus, OrderSummaryFieldsFragment } from '../gql/graphql';
import {
  DispatchOrderMutation,
  OrderFeedSubscription,
  ReviewPrescriptionMutation,
  ReviewQueueQuery,
} from '../graphql/operations';
import { formatCOP, formatDateTime, ORDER_STATUS_LABEL, REVIEW_TABS } from '../lib/format';

interface FeedEntry {
  key: string;
  code: string;
  status: OrderStatus;
  at: string;
}

/** Actualización inteligente de la caché tras un comando exitoso. */
function applyCommandToCache(cache: ApolloCache, orderId: string, result: OrderCommandResultFieldsFragment | undefined) {
  if (result?.__typename !== 'OrderCommandPayload') return;
  const entityId = cache.identify({ __typename: 'OrderSummary', id: orderId });
  cache.modify({ id: entityId, fields: { status: () => result.receipt.status } });
  cache.modify({
    fields: {
      ordersForReview: (existing: readonly Reference[] = [], { readField }) =>
        existing.filter((ref) => readField('id', ref) !== orderId),
    },
  });
}

export function PharmacyPage() {
  // La pestaña vive en la URL (?estado=) para que el menú lateral la controle.
  const [params, setParams] = useSearchParams();
  const tab = REVIEW_TABS.find((t) => t.status === params.get('estado'))?.status ?? 'PENDING_APPROVAL';
  const setTab = (status: OrderStatus) => setParams({ estado: status });
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const { data, loading, refetch } = useQuery(ReviewQueueQuery, {
    variables: { status: tab },
    fetchPolicy: 'cache-and-network',
    pollInterval: SUBSCRIPTIONS_ENABLED ? 0 : 5000,
  });

  useSubscription(OrderFeedSubscription, {
    skip: !SUBSCRIPTIONS_ENABLED,
    onData: ({ data: message }) => {
      const order = message.data?.orderFeed;
      if (!order) return;
      setFeed((f) =>
        [{ key: `${order.id}-${order.projectionVersion}`, code: order.code, status: order.status, at: order.updatedAt }, ...f].slice(0, 6),
      );
      // La entidad ya se actualizó por normalización; la pertenencia a la
      // lista (filtrada por estado) puede cambiar → se refresca la bandeja.
      void refetch();
    },
  });

  const orders = data?.ordersForReview ?? [];
  const tabLabel = REVIEW_TABS.find((t) => t.status === tab)?.label ?? '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bandeja del químico farmacéutico"
        subtitle="Valida fórmulas médicas y despacha pedidos aprobados."
        actions={
          <span className="badge bg-white px-3 py-1.5 text-slate-600 shadow-soft">
            {SUBSCRIPTIONS_ENABLED ? (
              <>
                <ZapIcon className="h-3.5 w-3.5 text-emerald-600" /> Feed en vivo (orderFeed)
              </>
            ) : (
              <>
                <RefreshIcon className="h-3.5 w-3.5 text-sky-600" /> Actualización cada 5 s
              </>
            )}
          </span>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label={`Pedidos · ${tabLabel}`} value={data ? orders.length : '—'} icon={<ClipboardIcon className="h-4 w-4" />} tone="brand" />
        <StatCard
          label="Con fórmula médica"
          value={data ? orders.filter((o) => o.prescription).length : '—'}
          icon={<FileTextIcon className="h-4 w-4" />}
          tone="violet"
        />
        <StatCard
          label="Unidades"
          value={data ? orders.reduce((n, o) => n + o.itemCount, 0) : '—'}
          icon={<PackageIcon className="h-4 w-4" />}
          tone="sky"
        />
        <StatCard
          label="Valor en bandeja"
          value={data ? formatCOP(orders.reduce((n, o) => n + o.total, 0)) : '—'}
          icon={<TagIcon className="h-4 w-4" />}
          tone="amber"
        />
      </section>

      {feed.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 p-4 text-xs">
          <span className="mr-1 inline-flex items-center gap-2 font-semibold text-slate-600">
            <ActivityIcon className="h-4 w-4 text-brand-600" /> Actividad reciente
          </span>
          {feed.map((f) => (
            <span key={f.key} className="badge bg-slate-50 text-slate-700 ring-1 ring-slate-100">
              <span className={`h-1.5 w-1.5 rounded-full ${ORDER_STATUS_DOT[f.status]}`} />
              {f.code} → {ORDER_STATUS_LABEL[f.status]}
            </span>
          ))}
        </div>
      )}

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 text-sm font-semibold shadow-soft">
        {REVIEW_TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            onClick={() => setTab(t.status)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 whitespace-nowrap transition ${
              tab === t.status ? 'bg-brand-600 text-white shadow-brand' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${ORDER_STATUS_DOT[t.status]} ${tab === t.status ? 'ring-2 ring-white/70' : ''}`} />
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <PageLoader label="Cargando bandeja…" />
      ) : orders.length === 0 ? (
        <EmptyState icon={<CheckIcon className="h-7 w-7" />} title="Nada pendiente en esta bandeja" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => (
            <ReviewCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ order }: { order: OrderSummaryFieldsFragment }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<DomainErrorLike | null>(null);
  const [review, reviewState] = useMutation(ReviewPrescriptionMutation);
  const [dispatch, dispatchState] = useMutation(DispatchOrderMutation);
  const busy = reviewState.loading || dispatchState.loading;

  async function handleReview(decision: 'APPROVE' | 'REJECT') {
    setError(null);
    const { data } = await review({
      variables: { input: { orderId: order.id, decision, notes: notes || null } },
      update: (cache, { data: r }) => applyCommandToCache(cache, order.id, r?.reviewPrescription),
    });
    const result = data?.reviewPrescription;
    if (result && result.__typename !== 'OrderCommandPayload') setError(result as DomainErrorLike);
  }

  async function handleDispatch() {
    setError(null);
    const { data } = await dispatch({
      variables: { input: { orderId: order.id } },
      update: (cache, { data: r }) => applyCommandToCache(cache, order.id, r?.dispatchOrder),
    });
    const result = data?.dispatchOrder;
    if (result && result.__typename !== 'OrderCommandPayload') setError(result as DomainErrorLike);
  }

  const awaitingReview = order.status === 'PENDING_APPROVAL' && order.prescription?.status === 'PENDING_REVIEW';

  return (
    <article className="card flex flex-col gap-4 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconCircle tone={order.prescription ? 'violet' : 'brand'}>
            {order.prescription ? <FileTextIcon className="h-5 w-5" /> : <PackageIcon className="h-5 w-5" />}
          </IconCircle>
          <div>
            <Link to={`/pedidos/${order.id}`} className="font-bold text-slate-900 hover:text-brand-700">
              {order.code}
            </Link>
            <p className="text-xs text-slate-500">
              {order.customerName} · {formatDateTime(order.placedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <OrderStatusBadge status={order.status} />
          <span className="font-bold text-slate-900 tabular-nums">{formatCOP(order.total)}</span>
        </div>
      </header>

      <div className="rounded-2xl bg-slate-50/70 px-4">
        <OrderLines items={order.items} />
      </div>

      {order.prescription ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
          <PrescriptionDetails prescription={order.prescription} />
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
          Pedido de venta libre (sin fórmula).
          {order.status === 'PENDING_APPROVAL' && ' La aprobación automática está en curso.'}
        </p>
      )}

      {error && <DomainErrorAlert error={error} />}

      {awaitingReview && (
        <div className="space-y-2">
          <label className="label" htmlFor={`notes-${order.id}`}>
            Observaciones (obligatorias para rechazar)
          </label>
          <input
            id={`notes-${order.id}`}
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Fórmula verificada con el prescriptor"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" disabled={busy} onClick={() => void handleReview('APPROVE')}>
              <CheckIcon className="h-4 w-4" /> Aprobar fórmula
            </button>
            <button type="button" className="btn-danger flex-1" disabled={busy} onClick={() => void handleReview('REJECT')}>
              <XIcon className="h-4 w-4" /> Rechazar
            </button>
          </div>
        </div>
      )}

      {order.status === 'APPROVED' && (
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void handleDispatch()}>
          <TruckIcon className="h-4 w-4" /> Despachar pedido
        </button>
      )}
    </article>
  );
}
