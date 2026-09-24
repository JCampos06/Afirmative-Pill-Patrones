import { InvalidStateTransitionError } from './errors.js';

export const ORDER_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Role = 'PATIENT' | 'PHARMACIST';
export type Actor = 'SYSTEM' | Role;

/**
 * Máquina de estados de la orden.
 *
 *   PENDING_APPROVAL ──► APPROVED ──► DISPATCHED
 *          │                │
 *          └──► CANCELLED ◄─┘
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

/** Unidades máximas de un mismo medicamento por pedido (control de dispensación). */
export const MAX_UNITS_PER_ITEM = 10;
