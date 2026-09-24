/**
 * CONSULTAS DEL CARRITO. El carrito es un agregado transaccional de vida
 * corta; su vista se arma aquí (lado de lectura) combinando las líneas con
 * el precio vigente de la proyección del catálogo.
 */
import { db } from '../infra/db.js';

export interface CartItemView {
  cartId: string;
  medicationId: number;
  quantity: number;
  price: number;
  requiresPrescription: boolean;
}

export interface CartView {
  id: string;
  status: 'OPEN' | 'CHECKED_OUT';
  updatedAt: Date;
  items: CartItemView[];
}

async function buildCart(cart: { id: string; status: CartView['status']; updated_at: Date } | null) {
  if (!cart) return null;
  const items = await db.rows<{ medication_id: number; quantity: number; price: number; requires_prescription: boolean }>(
    `select ci.medication_id, ci.quantity, mc.price, mc.requires_prescription
       from cart_items ci
       join medication_catalog mc on mc.medication_id = ci.medication_id
      where ci.cart_id = $1
      order by ci.added_at, ci.medication_id`,
    [cart.id],
  );
  return {
    id: cart.id,
    status: cart.status,
    updatedAt: cart.updated_at,
    items: items.map((i) => ({
      cartId: cart.id,
      medicationId: i.medication_id,
      quantity: i.quantity,
      price: i.price,
      requiresPrescription: i.requires_prescription,
    })),
  } satisfies CartView;
}

export async function getOpenCartForUser(userId: string): Promise<CartView | null> {
  const cart = await db.one<{ id: string; status: CartView['status']; updated_at: Date }>(
    `select id, status, updated_at from carts where user_id = $1 and status = 'OPEN'`,
    [userId],
  );
  return buildCart(cart);
}

export async function getCartById(cartId: string): Promise<CartView | null> {
  const cart = await db.one<{ id: string; status: CartView['status']; updated_at: Date }>(
    'select id, status, updated_at from carts where id = $1',
    [cartId],
  );
  return buildCart(cart);
}
