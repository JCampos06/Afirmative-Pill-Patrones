import type { Actor, OrderStatus } from './order.js';

/**
 * Eventos de dominio. Se persisten en el outbox (domain_events) dentro de
 * la misma transacción del comando y el Projector los aplica al read model.
 */

export interface OrderLineSnapshot {
  medicationId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  requiresPrescription: boolean;
}

export interface PrescriptionSnapshot {
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  doctorName: string;
  doctorLicense: string;
  patientDocument: string;
  issuedAt: string;
  documentUrl: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
}

export interface StockMovement {
  medicationId: number;
  quantity: number;
  remaining: number;
}

/** Resultado de la revisión de la fórmula por parte del farmacéutico. */
export interface PrescriptionReview {
  status: 'APPROVED' | 'REJECTED';
  reviewNotes: string | null;
  reviewedAt: string;
}

export type DomainEvent =
  | {
      type: 'OrderPlaced';
      orderId: string;
      code: string;
      userId: string;
      customerName: string;
      status: OrderStatus;
      items: OrderLineSnapshot[];
      total: number;
      requiresPrescription: boolean;
      prescription: PrescriptionSnapshot | null;
      shippingAddress: string;
      placedAt: string;
    }
  | {
      type: 'OrderApproved';
      orderId: string;
      actor: Actor;
      note: string | null;
      prescriptionReview: PrescriptionReview | null;
      at: string;
    }
  | {
      type: 'OrderCancelled';
      orderId: string;
      actor: Actor;
      reason: string;
      prescriptionReview: PrescriptionReview | null;
      at: string;
    }
  | {
      type: 'OrderDispatched';
      orderId: string;
      actor: Actor;
      at: string;
    }
  | {
      type: 'InventoryReserved';
      orderId: string;
      movements: StockMovement[];
    }
  | {
      type: 'InventoryReleased';
      orderId: string;
      movements: StockMovement[];
    };

export type DomainEventType = DomainEvent['type'];

export interface StoredEvent<E extends DomainEvent = DomainEvent> {
  id: number;
  aggregateType: string;
  aggregateId: string;
  event: E;
  occurredAt: Date;
}
