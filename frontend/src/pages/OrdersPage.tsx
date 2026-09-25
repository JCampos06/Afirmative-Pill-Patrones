import { useQuery, useReactiveVar } from '@apollo/client/react';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { POLL_INTERVAL_MS } from '../apollo/config';
import { pendingOrdersVar, resolvePendingOrders } from '../apollo/state';
import { OrderStatusBadge, RxBadge } from '../components/badges';
import { ChevronRightIcon, ClockIcon, FileTextIcon, PackageIcon, TagIcon, TruckIcon } from '../components/icons';
import { CardHeader, EmptyState, IconCircle, PageHeader, PageLoader, Spinner, StatCard } from '../components/ui';
import { MyOrdersQuery } from '../graphql/operations';
import { formatCOP, formatDateTime } from '../lib/format';

export function OrdersPage() {
  const { data, loading, startPolling, stopPolling } = useQuery(MyOrdersQuery, { fetchPolicy: 'cache-and-network' });
  const pending = useReactiveVar(pendingOrdersVar);
  const orders = data?.myOrders ?? [];
  const projectedIds = new Set(orders.map((o) => o.id));
  // Acuses de comandos cuya proyección aún no llega al read model.
  const stillPending = pending.filter((p) => !projectedIds.has(p.orderId));

  useEffect(() => {
    if (data) resolvePendingOrders(data.myOrders.map((o) => o.id));
  }, [data]);

  useEffect(() => {
    if (stillPending.length > 0) startPolling(POLL_INTERVAL_MS);
    else stopPolling();
    return () => stopPolling();
  }, [stillPending.length, startPolling, stopPolling]);

  if (loading && !data) return <PageLoader label="Cargando pedidos…" />;

  if (orders.length === 0 && stillPending.length === 0) {
    return (
      <EmptyState icon={<PackageIcon className="h-7 w-7" />} title="Aún no tienes pedidos">
        Cuando confirmes tu primer pedido podrás seguirlo aquí en tiempo real.
      </EmptyState>
    );
  }

  const active = orders.filter((o) => o.status === 'PENDING_APPROVAL' || o.status === 'APPROVED').length;
  const dispatched = orders.filter((o) => o.status === 'DISPATCHED').length;
  const spent = orders.filter((o) => o.status !== 'CANCELLED').reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Mis pedidos" subtitle="Sigue el estado de tus compras en tiempo real." />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Pedidos realizados" value={orders.length + stillPending.length} icon={<PackageIcon className="h-4 w-4" />} tone="brand" />
        <StatCard label="En curso" value={active + stillPending.length} icon={<ClockIcon className="h-4 w-4" />} tone="amber" />
        <StatCard label="Despachados" value={dispatched} icon={<TruckIcon className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Total comprado" value={formatCOP(spent)} icon={<TagIcon className="h-4 w-4" />} tone="violet" />
      </section>

      <section className="card p-5 sm:p-6">
        <CardHeader icon={<PackageIcon className="h-5 w-5" />} title="Historial de pedidos" subtitle="Toca un pedido para ver su seguimiento" />

        <ul className="mt-5 space-y-2">
          {stillPending.map((r) => (
            <li key={r.orderId}>
              <Link
                to={`/pedidos/${r.orderId}`}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4"
              >
                <IconCircle tone="slate">
                  <Spinner className="h-4 w-4" />
                </IconCircle>
                <div className="min-w-40 flex-1">
                  <p className="font-semibold text-slate-900">{r.code}</p>
                  <p className="text-xs text-slate-500">Pedido recibido · procesando…</p>
                </div>
                <Column label="Total">
                  <span className="font-bold text-slate-900 tabular-nums">{formatCOP(r.total)}</span>
                </Column>
              </Link>
            </li>
          ))}

          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to={`/pedidos/${o.id}`}
                className="group flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-slate-100 p-4 transition hover:border-slate-200 hover:bg-slate-50/60"
              >
                <div className="flex min-w-48 flex-1 items-center gap-3">
                  <IconCircle tone={o.requiresPrescription ? 'violet' : 'brand'}>
                    {o.requiresPrescription ? <FileTextIcon className="h-5 w-5" /> : <PackageIcon className="h-5 w-5" />}
                  </IconCircle>
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-brand-700">{o.code}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(o.placedAt)}</p>
                  </div>
                </div>
                <Column label="Estado">
                  <OrderStatusBadge status={o.status} />
                </Column>
                <Column label="Tipo" className="hidden sm:flex">
                  <RxBadge required={o.requiresPrescription} />
                </Column>
                <Column label="Unidades" className="hidden md:flex">
                  <span className="text-sm font-medium text-slate-700">{o.itemCount}</span>
                </Column>
                <Column label="Total" className="ml-auto items-end">
                  <span className="font-bold text-slate-900 tabular-nums">{formatCOP(o.total)}</span>
                </Column>
                <ChevronRightIcon className="hidden h-4 w-4 text-slate-300 group-hover:text-brand-600 sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Column({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      {children}
    </div>
  );
}
