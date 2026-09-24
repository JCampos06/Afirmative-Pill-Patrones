/**
 * Proyección order_projections: resumen de la orden listo para la UI.
 * Cada handler es idempotente (last_event_id evita aplicar dos veces un evento).
 */
import type { Db } from '../infra/db.js';
import type { DomainEvent, PrescriptionReview, StoredEvent } from '../domain/events.js';
import type { Actor, OrderStatus } from '../domain/order.js';

type EventOf<T extends DomainEvent['type']> = Extract<DomainEvent, { type: T }>;

interface StatusChange {
  status: OrderStatus;
  at: string;
  note: string | null;
  actor: Actor;
}

export async function projectOrderPlaced(tx: Db, stored: StoredEvent<EventOf<'OrderPlaced'>>): Promise<void> {
  const e = stored.event;
  const history: StatusChange[] = [
    {
      status: e.status,
      at: e.placedAt,
      note: e.requiresPrescription
        ? 'Pedido recibido. Fórmula médica en revisión por el químico farmacéutico.'
        : 'Pedido recibido. Validando disponibilidad para aprobación automática.',
      actor: 'PATIENT',
    },
  ];
  await tx.rows(
    `insert into order_projections (
       order_id, code, user_id, customer_name, status, total, item_count, items,
       requires_prescription, prescription, shipping_address, status_history,
       placed_at, updated_at, projection_version, last_event_id, synced_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12::jsonb, $13, $13, 1, $14, now())
     on conflict (order_id) do nothing`,
    [
      e.orderId,
      e.code,
      e.userId,
      e.customerName,
      e.status,
      e.total,
      e.items.reduce((n, i) => n + i.quantity, 0),
      JSON.stringify(e.items),
      e.requiresPrescription,
      e.prescription ? JSON.stringify(e.prescription) : null,
      e.shippingAddress,
      JSON.stringify(history),
      e.placedAt,
      stored.id,
    ],
  );
}

async function applyStatusChange(
  tx: Db,
  stored: StoredEvent,
  orderId: string,
  change: StatusChange,
  review: PrescriptionReview | null,
): Promise<void> {
  await tx.rows(
    `update order_projections
        set status = $2,
            updated_at = $3,
            status_history = status_history || $4::jsonb,
            prescription = case when $5::jsonb is null then prescription
                                else coalesce(prescription, '{}'::jsonb) || $5::jsonb end,
            projection_version = projection_version + 1,
            last_event_id = $6,
            synced_at = now()
      where order_id = $1 and last_event_id < $6`,
    [
      orderId,
      change.status,
      change.at,
      JSON.stringify([change]),
      review ? JSON.stringify(review) : null,
      stored.id,
    ],
  );
}

export async function projectOrderApproved(tx: Db, stored: StoredEvent<EventOf<'OrderApproved'>>): Promise<void> {
  const e = stored.event;
  await applyStatusChange(
    tx,
    stored,
    e.orderId,
    { status: 'APPROVED', at: e.at, note: e.note, actor: e.actor },
    e.prescriptionReview,
  );
}

export async function projectOrderCancelled(tx: Db, stored: StoredEvent<EventOf<'OrderCancelled'>>): Promise<void> {
  const e = stored.event;
  await applyStatusChange(
    tx,
    stored,
    e.orderId,
    { status: 'CANCELLED', at: e.at, note: e.reason, actor: e.actor },
    e.prescriptionReview,
  );
}

export async function projectOrderDispatched(tx: Db, stored: StoredEvent<EventOf<'OrderDispatched'>>): Promise<void> {
  const e = stored.event;
  await applyStatusChange(
    tx,
    stored,
    e.orderId,
    { status: 'DISPATCHED', at: e.at, note: 'Pedido entregado a la transportadora.', actor: e.actor },
    null,
  );
}
