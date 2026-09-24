import { Link } from 'react-router';
import { SUBSCRIPTIONS_ENABLED } from '../apollo/config';
import type { OrderStatus, OrderSummaryFieldsFragment } from '../gql/graphql';
import { ACTOR_LABEL, formatCOP, formatDate, formatDateTime, ORDER_STATUS_LABEL, timeAgo } from '../lib/format';
import { ORDER_STATUS_DOT, PrescriptionStatusBadge, RxBadge } from './badges';
import { ArrowUpRightIcon, CheckIcon, ClockIcon, RefreshIcon, TruckIcon, XIcon } from './icons';

const FLOW: OrderStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'DISPATCHED'];

const FLOW_ICONS: Partial<Record<OrderStatus, typeof CheckIcon>> = {
  PENDING_APPROVAL: ClockIcon,
  APPROVED: CheckIcon,
  DISPATCHED: TruckIcon,
};

/** Stepper del flujo operacional de la orden. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 text-rose-600">
          <XIcon className="h-4 w-4" />
        </span>
        Pedido cancelado · el inventario reservado fue devuelto a bodega
      </div>
    );
  }
  const current = FLOW.indexOf(status);
  return (
    <ol className="flex items-start">
      {FLOW.map((step, i) => {
        const done = i <= current;
        const Icon = FLOW_ICONS[step] ?? CheckIcon;
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center gap-2 text-center">
            {i > 0 && (
              <span
                className={`absolute top-5 right-1/2 h-0.5 w-full -translate-y-1/2 ${i <= current ? 'bg-brand-500' : 'bg-slate-200'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative grid h-10 w-10 place-items-center rounded-full transition ${
                done ? 'bg-brand-600 text-white shadow-brand' : 'bg-slate-100 text-slate-400'
              } ${i === current ? 'ring-4 ring-brand-100' : ''}`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className={`text-xs font-semibold ${done ? 'text-brand-800' : 'text-slate-400'}`}>{ORDER_STATUS_LABEL[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderTimeline({ history }: { history: OrderSummaryFieldsFragment['statusHistory'] }) {
  return (
    <ol className="relative space-y-5 border-l-2 border-slate-100 pl-5">
      {[...history].reverse().map((h, i) => (
        <li key={`${h.status}-${h.at}`} className="relative">
          <span
            className={`absolute top-1 -left-[27px] h-3 w-3 rounded-full ring-4 ${
              i === 0 ? `${ORDER_STATUS_DOT[h.status]} ring-slate-100` : 'bg-slate-300 ring-white'
            }`}
          />
          <p className="text-sm font-semibold text-slate-800">{ORDER_STATUS_LABEL[h.status]}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(h.at)} · {ACTOR_LABEL[h.actor] ?? h.actor}
          </p>
          {h.note && <p className="mt-1 text-sm text-slate-600">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function OrderLines({ items }: { items: OrderSummaryFieldsFragment['items'] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((line) => (
        <li key={line.medicationId} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <Link to={`/medicamentos/${line.medicationId}`} className="font-medium text-slate-800 hover:text-brand-700">
              {line.name}
            </Link>
            <p className="text-xs text-slate-500">
              {line.sku} · {line.quantity} × {formatCOP(line.unitPrice)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {line.requiresPrescription && <RxBadge required />}
            <span className="font-semibold text-slate-900">{formatCOP(line.subtotal)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PrescriptionDetails({ prescription }: { prescription: NonNullable<OrderSummaryFieldsFragment['prescription']> }) {
  return (
    <div className="space-y-2 text-sm">
      <PrescriptionStatusBadge status={prescription.status} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-700">
        <dt className="text-slate-500">Médico</dt>
        <dd>{prescription.doctorName}</dd>
        <dt className="text-slate-500">Registro</dt>
        <dd>{prescription.doctorLicense}</dd>
        <dt className="text-slate-500">Paciente</dt>
        <dd>{prescription.patientDocument}</dd>
        <dt className="text-slate-500">Expedida</dt>
        <dd>{formatDate(prescription.issuedAt)}</dd>
      </dl>
      {prescription.documentUrl && (
        <a
          href={prescription.documentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
        >
          Ver documento de la fórmula <ArrowUpRightIcon className="h-3.5 w-3.5" />
        </a>
      )}
      {prescription.reviewNotes && (
        <p className="rounded-xl bg-white/70 p-2.5 text-slate-600 ring-1 ring-slate-100">
          <span className="font-semibold">Nota del farmacéutico:</span> {prescription.reviewNotes}
        </p>
      )}
    </div>
  );
}

/** Indica cómo llegan las actualizaciones y la frescura de la proyección. */
export function SyncIndicator({ order }: { order: Pick<OrderSummaryFieldsFragment, 'projectionVersion' | 'syncedAt'> }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      {SUBSCRIPTIONS_ENABLED ? (
        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> En vivo (subscription)
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700">
          <RefreshIcon className="h-3.5 w-3.5" /> Actualización periódica (polling)
        </span>
      )}
      <span>
        · Proyección v{order.projectionVersion} sincronizada {timeAgo(order.syncedAt)}
      </span>
    </p>
  );
}
