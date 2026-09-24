import type { AvailabilityStatus, OrderStatus, PrescriptionStatus } from '../gql/graphql';
import { AVAILABILITY_LABEL, ORDER_STATUS_LABEL, PRESCRIPTION_STATUS_LABEL } from '../lib/format';

/** Color del punto de cada estado; también lo usa el menú lateral. */
export const ORDER_STATUS_DOT: Record<OrderStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-500',
  APPROVED: 'bg-sky-500',
  DISPATCHED: 'bg-emerald-500',
  CANCELLED: 'bg-rose-500',
};

const ORDER_STYLES: Record<OrderStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-800',
  APPROVED: 'bg-sky-50 text-sky-800',
  DISPATCHED: 'bg-emerald-50 text-emerald-800',
  CANCELLED: 'bg-rose-50 text-rose-800',
};

function Dot({ className }: { className: string }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${className}`} aria-hidden="true" />;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`badge ${ORDER_STYLES[status]}`}>
      <Dot className={ORDER_STATUS_DOT[status]} /> {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

const AVAILABILITY_STYLES: Record<AvailabilityStatus, [string, string]> = {
  IN_STOCK: ['bg-emerald-50 text-emerald-700', 'bg-emerald-500'],
  LOW_STOCK: ['bg-amber-50 text-amber-700', 'bg-amber-500'],
  OUT_OF_STOCK: ['bg-slate-100 text-slate-500', 'bg-slate-400'],
};

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  const [style, dot] = AVAILABILITY_STYLES[status];
  return (
    <span className={`badge ${style}`}>
      <Dot className={dot} /> {AVAILABILITY_LABEL[status]}
    </span>
  );
}

export function RxBadge({ required }: { required: boolean }) {
  return required ? (
    <span className="badge bg-violet-50 text-violet-700" title="Exige fórmula médica verificada">
      ℞ Con fórmula
    </span>
  ) : (
    <span className="badge bg-slate-100 text-slate-600" title="Venta libre (OTC)">
      Venta libre
    </span>
  );
}

const PRESCRIPTION_STYLES: Record<PrescriptionStatus, string> = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-800',
  APPROVED: 'bg-emerald-50 text-emerald-800',
  REJECTED: 'bg-rose-50 text-rose-800',
};

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  return <span className={`badge ${PRESCRIPTION_STYLES[status]}`}>℞ {PRESCRIPTION_STATUS_LABEL[status]}</span>;
}
