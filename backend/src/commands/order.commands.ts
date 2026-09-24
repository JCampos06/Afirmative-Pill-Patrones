/**
 * COMANDOS DE ÓRDENES (write model).
 *
 * Cada comando:
 *   1. valida la entrada (zod → ValidationError),
 *   2. abre UNA transacción y bloquea las filas que va a modificar,
 *   3. verifica las invariantes de negocio (lanza errores de dominio → ROLLBACK),
 *   4. persiste el nuevo estado + los eventos en el outbox,
 *   5. tras el COMMIT avisa al Projector (consistencia eventual del read model).
 */
import { z } from 'zod';
import type { AuthUser } from '../auth/jwt.js';
import { withTransaction, type Db } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import {
  EmptyCartError,
  InsufficientStockError,
  InvalidStateTransitionError,
  NotFoundError,
  PrescriptionRequiredError,
  ValidationError,
} from '../domain/errors.js';
import type {
  OrderLineSnapshot,
  PrescriptionReview,
  PrescriptionSnapshot,
  StockMovement,
} from '../domain/events.js';
import { assertTransition, type OrderStatus } from '../domain/order.js';
import { validatePrescription } from '../domain/prescription.js';
import { notifyNewEvents } from '../projections/projector.js';
import { appendEvents } from './outbox.js';
import { isoDateSchema, optionalText, parseInput, uuidSchema } from './validation.js';

export interface OrderReceipt {
  orderId: string;
  code: string;
  status: OrderStatus;
  total: number;
  requiresPrescription: boolean;
  acceptedAt: Date;
}

interface OrderRow {
  id: string;
  code: string;
  user_id: string;
  status: OrderStatus;
  total: number;
  requires_prescription: boolean;
  created_at: Date;
  updated_at: Date;
}

const ORDER_COLUMNS = 'id, code, user_id, status, total, requires_prescription, created_at, updated_at';

function toReceipt(order: OrderRow): OrderReceipt {
  return {
    orderId: order.id,
    code: order.code,
    status: order.status,
    total: order.total,
    requiresPrescription: order.requires_prescription,
    acceptedAt: order.updated_at,
  };
}

// ─── Esquemas de entrada ─────────────────────────────────────────────

const prescriptionSchema = z.object({
  doctorName: z.string().trim().min(3, 'El nombre del médico es obligatorio.').max(120),
  doctorLicense: z.string().trim().min(1, 'El registro médico es obligatorio.').max(20),
  patientDocument: z.string().trim().min(1, 'El documento del paciente es obligatorio.').max(20),
  issuedAt: isoDateSchema,
  documentUrl: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.url('El enlace de la fórmula no es una URL válida.').nullish(),
  ),
  notes: optionalText(500),
});

const placeOrderSchema = z.object({
  cartId: uuidSchema('El id del carrito'),
  shippingAddress: z
    .string()
    .trim()
    .min(10, 'La dirección de envío debe tener al menos 10 caracteres.')
    .max(250),
  prescription: prescriptionSchema.nullish(),
  idempotencyKey: optionalText(100),
});

const cancelOrderSchema = z.object({
  orderId: uuidSchema('El id de la orden'),
  reason: z.string().trim().min(5, 'Indica el motivo de la cancelación (mínimo 5 caracteres).').max(300),
});

const reviewSchema = z
  .object({
    orderId: uuidSchema('El id de la orden'),
    decision: z.enum(['APPROVE', 'REJECT']),
    notes: optionalText(500),
  })
  .refine((v) => v.decision === 'APPROVE' || (v.notes && v.notes.length >= 5), {
    path: ['notes'],
    message: 'Para rechazar una fórmula debes indicar el motivo (mínimo 5 caracteres).',
  });

const dispatchSchema = z.object({ orderId: uuidSchema('El id de la orden') });

// ─── Utilidades internas ─────────────────────────────────────────────

async function lockOrder(tx: Db, orderId: string): Promise<OrderRow> {
  const order = await tx.one<OrderRow>(`select ${ORDER_COLUMNS} from orders where id = $1 for update`, [orderId]);
  if (!order) throw new NotFoundError('Orden', orderId);
  return order;
}

async function changeStatus(tx: Db, orderId: string, status: OrderStatus): Promise<OrderRow> {
  return (await tx.one<OrderRow>(
    `update orders set status = $2, version = version + 1, updated_at = now()
      where id = $1 returning ${ORDER_COLUMNS}`,
    [orderId, status],
  ))!;
}

/**
 * Devuelve a bodega las unidades de una orden. Bloquea las filas de
 * inventario en orden ascendente de id (mismo orden que placeOrder) para
 * evitar interbloqueos entre transacciones concurrentes.
 */
async function releaseInventory(tx: Db, orderId: string): Promise<StockMovement[]> {
  await tx.rows(
    `select i.medication_id from inventory i
      where i.medication_id in (select medication_id from order_items where order_id = $1)
      order by i.medication_id for update`,
    [orderId],
  );
  const rows = await tx.rows<{ medication_id: number; stock: number; quantity: number }>(
    `update inventory i
        set stock = i.stock + oi.quantity, version = i.version + 1, updated_at = now()
       from order_items oi
      where oi.order_id = $1 and i.medication_id = oi.medication_id
  returning i.medication_id, i.stock, oi.quantity`,
    [orderId],
  );
  return rows.map((r) => ({ medicationId: r.medication_id, quantity: r.quantity, remaining: r.stock }));
}

// ─── PlaceOrder ──────────────────────────────────────────────────────

interface CartLineRow {
  medication_id: number;
  quantity: number;
  sku: string;
  name: string;
  price: number;
  requires_prescription: boolean;
}

export async function placeOrder(user: AuthUser, rawInput: unknown): Promise<OrderReceipt> {
  const input = parseInput(placeOrderSchema, rawInput);

  const { receipt, replayed } = await withTransaction(async (tx) => {
    // Idempotencia: reenviar el mismo comando devuelve la orden ya creada.
    if (input.idempotencyKey) {
      const existing = await tx.one<OrderRow>(
        `select ${ORDER_COLUMNS} from orders where user_id = $1 and idempotency_key = $2`,
        [user.id, input.idempotencyKey],
      );
      if (existing) return { receipt: toReceipt(existing), replayed: true };
    }

    const cart = await tx.one<{ id: string; status: string }>(
      'select id, status from carts where id = $1 and user_id = $2 for update',
      [input.cartId, user.id],
    );
    if (!cart) throw new NotFoundError('Carrito', input.cartId);
    if (cart.status !== 'OPEN') {
      throw new InvalidStateTransitionError(cart.status, 'CHECKED_OUT', 'Este carrito ya fue confirmado como pedido.');
    }

    // Precios y banderas se toman del write model, nunca del cliente.
    const lines = await tx.rows<CartLineRow>(
      `select ci.medication_id, ci.quantity, m.sku, m.name, m.price, m.requires_prescription
         from cart_items ci
         join medications m on m.id = ci.medication_id
        where ci.cart_id = $1
        order by ci.medication_id`,
      [cart.id],
    );
    if (lines.length === 0) throw new EmptyCartError();

    // ── Invariante 1: medicamentos con fórmula exigen soporte de prescripción
    const rxLines = lines.filter((l) => l.requires_prescription);
    const requiresPrescription = rxLines.length > 0;
    if (requiresPrescription && !input.prescription) {
      throw new PrescriptionRequiredError(rxLines.map((l) => l.medication_id));
    }
    const prescription = requiresPrescription ? input.prescription! : null;
    if (prescription) {
      const errors = validatePrescription(prescription, user.documentNumber);
      if (errors.length > 0) throw new ValidationError('La fórmula médica no es válida.', errors);
    }

    // ── Invariante 2: reserva atómica de inventario (bloqueo pesimista)
    const ids = lines.map((l) => l.medication_id);
    const quantities = lines.map((l) => l.quantity);
    const stockRows = await tx.rows<{ medication_id: number; stock: number }>(
      `select medication_id, stock from inventory
        where medication_id = any($1::int[])
        order by medication_id
        for update`,
      [ids],
    );
    const stockById = new Map(stockRows.map((r) => [r.medication_id, r.stock]));
    const shortages = lines
      .filter((l) => (stockById.get(l.medication_id) ?? 0) < l.quantity)
      .map((l) => ({
        medicationId: l.medication_id,
        requested: l.quantity,
        available: stockById.get(l.medication_id) ?? 0,
      }));
    if (shortages.length > 0) throw new InsufficientStockError(shortages);

    const reserved = await tx.rows<{ medication_id: number; stock: number }>(
      `update inventory i
          set stock = i.stock - r.qty, version = i.version + 1, updated_at = now()
         from unnest($1::int[], $2::int[]) as r(id, qty)
        where i.medication_id = r.id
    returning i.medication_id, i.stock`,
      [ids, quantities],
    );

    // ── Persistencia de la orden
    const items: OrderLineSnapshot[] = lines.map((l) => ({
      medicationId: l.medication_id,
      sku: l.sku,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.price,
      subtotal: l.price * l.quantity,
      requiresPrescription: l.requires_prescription,
    }));
    const total = items.reduce((sum, i) => sum + i.subtotal, 0);

    const order = (await tx.one<OrderRow>(
      `insert into orders (user_id, cart_id, total, requires_prescription, shipping_address, idempotency_key)
       values ($1, $2, $3, $4, $5, $6)
       returning ${ORDER_COLUMNS}`,
      [user.id, cart.id, total, requiresPrescription, input.shippingAddress, input.idempotencyKey ?? null],
    ))!;

    await tx.rows(
      `insert into order_items (order_id, medication_id, quantity, unit_price, subtotal)
       select $1, r.id, r.qty, r.price, r.subtotal
         from unnest($2::int[], $3::int[], $4::numeric[], $5::numeric[]) as r(id, qty, price, subtotal)`,
      [order.id, ids, quantities, items.map((i) => i.unitPrice), items.map((i) => i.subtotal)],
    );

    let prescriptionSnapshot: PrescriptionSnapshot | null = null;
    if (prescription) {
      await tx.rows(
        `insert into prescriptions (order_id, doctor_name, doctor_license, patient_document, issued_at, document_url, notes)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          prescription.doctorName,
          prescription.doctorLicense,
          prescription.patientDocument,
          prescription.issuedAt,
          prescription.documentUrl ?? null,
          prescription.notes ?? null,
        ],
      );
      prescriptionSnapshot = {
        status: 'PENDING_REVIEW',
        doctorName: prescription.doctorName,
        doctorLicense: prescription.doctorLicense,
        patientDocument: prescription.patientDocument,
        issuedAt: prescription.issuedAt,
        documentUrl: prescription.documentUrl ?? null,
        reviewNotes: null,
        reviewedAt: null,
      };
    }

    await tx.rows(`update carts set status = 'CHECKED_OUT', updated_at = now() where id = $1`, [cart.id]);

    await appendEvents(tx, 'Order', order.id, [
      {
        type: 'OrderPlaced',
        orderId: order.id,
        code: order.code,
        userId: user.id,
        customerName: user.fullName,
        status: order.status,
        items,
        total,
        requiresPrescription,
        prescription: prescriptionSnapshot,
        shippingAddress: input.shippingAddress,
        placedAt: order.created_at.toISOString(),
      },
      {
        type: 'InventoryReserved',
        orderId: order.id,
        movements: reserved.map((r) => ({
          medicationId: r.medication_id,
          quantity: quantities[ids.indexOf(r.medication_id)],
          remaining: r.stock,
        })),
      },
    ]);

    return { receipt: toReceipt(order), replayed: false };
  });

  if (replayed) {
    logger.command(`PlaceOrder (idempotente) → ${receipt.code} ya existía`);
  } else {
    logger.command(
      `PlaceOrder → ${receipt.code} · total $${receipt.total} · ${receipt.status}` +
        (receipt.requiresPrescription ? ' · con fórmula médica' : ' · venta libre'),
    );
    notifyNewEvents();
  }
  return receipt;
}

// ─── CancelOrder ─────────────────────────────────────────────────────

export async function cancelOrder(user: AuthUser, rawInput: unknown): Promise<OrderReceipt> {
  const input = parseInput(cancelOrderSchema, rawInput);
  const receipt = await withTransaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (user.role === 'PATIENT' && order.user_id !== user.id) throw new NotFoundError('Orden', input.orderId);
    assertTransition(order.status, 'CANCELLED');

    const movements = await releaseInventory(tx, order.id);
    const updated = await changeStatus(tx, order.id, 'CANCELLED');
    await appendEvents(tx, 'Order', order.id, [
      {
        type: 'OrderCancelled',
        orderId: order.id,
        actor: user.role,
        reason: input.reason,
        prescriptionReview: null,
        at: updated.updated_at.toISOString(),
      },
      { type: 'InventoryReleased', orderId: order.id, movements },
    ]);
    return toReceipt(updated);
  });
  logger.command(`CancelOrder → ${receipt.code} (${user.role})`);
  notifyNewEvents();
  return receipt;
}

// ─── ReviewPrescription ──────────────────────────────────────────────

export async function reviewPrescription(pharmacist: AuthUser, rawInput: unknown): Promise<OrderReceipt> {
  const input = parseInput(reviewSchema, rawInput);
  const receipt = await withTransaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!order.requires_prescription) {
      throw new InvalidStateTransitionError(
        order.status,
        input.decision === 'APPROVE' ? 'APPROVED' : 'CANCELLED',
        'Esta orden no contiene medicamentos con fórmula; se aprueba automáticamente.',
      );
    }
    const prescription = await tx.one<{ status: string }>(
      'select status from prescriptions where order_id = $1 for update',
      [order.id],
    );
    if (!prescription) throw new NotFoundError('Fórmula médica', order.id);
    if (prescription.status !== 'PENDING_REVIEW') {
      throw new InvalidStateTransitionError(
        prescription.status,
        input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        'La fórmula de esta orden ya fue revisada.',
      );
    }

    const approve = input.decision === 'APPROVE';
    const nextStatus: OrderStatus = approve ? 'APPROVED' : 'CANCELLED';
    assertTransition(order.status, nextStatus);

    const reviewed = (await tx.one<{ reviewed_at: Date }>(
      `update prescriptions
          set status = $2, reviewed_by = $3, reviewed_at = now(), review_notes = $4
        where order_id = $1
    returning reviewed_at`,
      [order.id, approve ? 'APPROVED' : 'REJECTED', pharmacist.id, input.notes ?? null],
    ))!;
    const review: PrescriptionReview = {
      status: approve ? 'APPROVED' : 'REJECTED',
      reviewNotes: input.notes ?? null,
      reviewedAt: reviewed.reviewed_at.toISOString(),
    };

    if (approve) {
      const updated = await changeStatus(tx, order.id, 'APPROVED');
      await appendEvents(tx, 'Order', order.id, [
        {
          type: 'OrderApproved',
          orderId: order.id,
          actor: 'PHARMACIST',
          note: input.notes ?? 'Fórmula médica verificada por el químico farmacéutico.',
          prescriptionReview: review,
          at: updated.updated_at.toISOString(),
        },
      ]);
      return toReceipt(updated);
    }

    const movements = await releaseInventory(tx, order.id);
    const updated = await changeStatus(tx, order.id, 'CANCELLED');
    await appendEvents(tx, 'Order', order.id, [
      {
        type: 'OrderCancelled',
        orderId: order.id,
        actor: 'PHARMACIST',
        reason: `Fórmula rechazada: ${input.notes}`,
        prescriptionReview: review,
        at: updated.updated_at.toISOString(),
      },
      { type: 'InventoryReleased', orderId: order.id, movements },
    ]);
    return toReceipt(updated);
  });
  logger.command(`ReviewPrescription → ${receipt.code} · ${input.decision} → ${receipt.status}`);
  notifyNewEvents();
  return receipt;
}

// ─── DispatchOrder ───────────────────────────────────────────────────

export async function dispatchOrder(pharmacist: AuthUser, rawInput: unknown): Promise<OrderReceipt> {
  const input = parseInput(dispatchSchema, rawInput);
  const receipt = await withTransaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    assertTransition(order.status, 'DISPATCHED');
    const updated = await changeStatus(tx, order.id, 'DISPATCHED');
    await appendEvents(tx, 'Order', order.id, [
      { type: 'OrderDispatched', orderId: order.id, actor: 'PHARMACIST', at: updated.updated_at.toISOString() },
    ]);
    return toReceipt(updated);
  });
  logger.command(`DispatchOrder → ${receipt.code} (por ${pharmacist.email})`);
  notifyNewEvents();
  return receipt;
}

// ─── AutoApproveOtcOrder (comando del sistema, disparado por una política) ─

/**
 * Aprueba automáticamente una orden de venta libre (sin fórmula).
 * Es idempotente: si la orden ya no está pendiente, no hace nada.
 */
export async function autoApproveOtcOrder(orderId: string): Promise<boolean> {
  const receipt = await withTransaction(async (tx) => {
    const order = await tx.one<OrderRow>(`select ${ORDER_COLUMNS} from orders where id = $1 for update`, [orderId]);
    if (!order || order.requires_prescription || order.status !== 'PENDING_APPROVAL') return null;
    const updated = await changeStatus(tx, order.id, 'APPROVED');
    await appendEvents(tx, 'Order', order.id, [
      {
        type: 'OrderApproved',
        orderId: order.id,
        actor: 'SYSTEM',
        note: 'Aprobación automática: pedido de venta libre (OTC).',
        prescriptionReview: null,
        at: updated.updated_at.toISOString(),
      },
    ]);
    return toReceipt(updated);
  });
  if (receipt) logger.command(`AutoApproveOtcOrder → ${receipt.code} APPROVED (SYSTEM)`);
  return receipt !== null;
}
