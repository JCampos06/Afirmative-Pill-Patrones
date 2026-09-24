/**
 * CONSULTAS DE ÓRDENES (read model): solo leen order_projections.
 */
import { db, type Db } from '../infra/db.js';
import type { Actor, OrderStatus } from '../domain/order.js';
import type { OrderLineSnapshot, PrescriptionSnapshot } from '../domain/events.js';

export interface OrderProjectionRow {
  order_id: string;
  code: string;
  user_id: string;
  customer_name: string;
  status: OrderStatus;
  total: number;
  item_count: number;
  items: OrderLineSnapshot[];
  requires_prescription: boolean;
  prescription: PrescriptionSnapshot | null;
  shipping_address: string;
  status_history: { status: OrderStatus; at: string; note: string | null; actor: Actor }[];
  placed_at: Date;
  updated_at: Date;
  projection_version: number;
  last_event_id: number;
  synced_at: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function getOrderProjection(orderId: string, executor: Db = db): Promise<OrderProjectionRow | null> {
  if (!isUuid(orderId)) return null;
  return executor.one<OrderProjectionRow>('select * from order_projections where order_id = $1', [orderId]);
}

export async function listOrdersByUser(userId: string, status?: OrderStatus | null): Promise<OrderProjectionRow[]> {
  return db.rows<OrderProjectionRow>(
    `select * from order_projections
      where user_id = $1 and ($2::order_status is null or status = $2)
      order by placed_at desc
      limit 50`,
    [userId, status ?? null],
  );
}

export async function listOrdersByStatus(status: OrderStatus | null): Promise<OrderProjectionRow[]> {
  return db.rows<OrderProjectionRow>(
    `select * from order_projections
      where ($1::order_status is null or status = $1)
      order by requires_prescription desc, placed_at asc
      limit 100`,
    [status],
  );
}
