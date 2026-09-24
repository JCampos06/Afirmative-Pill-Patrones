/**
 * Estado local del cliente con variables reactivas de Apollo.
 */
import { makeVar } from '@apollo/client';
import type { OrderStatus } from '../gql/graphql';

const TOKEN_KEY = 'afirmative-pill.token';
const PENDING_KEY = 'afirmative-pill.pending-orders';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible (modo privado): se ignora */
  }
}

// ─── Sesión ───────────────────────────────────────────────────────────

export const authTokenVar = makeVar<string | null>(readStorage(TOKEN_KEY));

export function setAuthToken(token: string | null): void {
  writeStorage(TOKEN_KEY, token);
  authTokenVar(token);
}

// ─── Consistencia eventual ────────────────────────────────────────────

/**
 * Acuse de recibo de un comando placeOrder cuya proyección de lectura
 * todavía no existe. La UI los muestra como "Procesando…" hasta que el
 * read model los materializa.
 */
export interface PendingOrderReceipt {
  orderId: string;
  code: string;
  status: OrderStatus;
  total: number;
  requiresPrescription: boolean;
  acceptedAt: string;
}

function readPending(): PendingOrderReceipt[] {
  try {
    return JSON.parse(readStorage(PENDING_KEY) ?? '[]') as PendingOrderReceipt[];
  } catch {
    return [];
  }
}

export const pendingOrdersVar = makeVar<PendingOrderReceipt[]>(readPending());

function savePending(list: PendingOrderReceipt[]) {
  writeStorage(PENDING_KEY, JSON.stringify(list));
  pendingOrdersVar(list);
}

export function addPendingOrder(receipt: PendingOrderReceipt): void {
  savePending([receipt, ...pendingOrdersVar().filter((r) => r.orderId !== receipt.orderId)]);
}

export function resolvePendingOrders(projectedIds: string[]): void {
  const current = pendingOrdersVar();
  const next = current.filter((r) => !projectedIds.includes(r.orderId));
  if (next.length !== current.length) savePending(next);
}

export function clearPendingOrders(): void {
  savePending([]);
}
