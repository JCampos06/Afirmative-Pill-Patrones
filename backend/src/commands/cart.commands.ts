/**
 * COMANDOS DEL CARRITO (write model).
 * El carrito vive en el servidor: cada cambio es un comando con intención
 * de negocio que valida invariantes antes de persistir.
 * Los comandos devuelven solo el id del carrito; la vista actualizada la
 * arma el lado de consultas (CQRS).
 */
import { z } from 'zod';
import type { AuthUser } from '../auth/jwt.js';
import { withTransaction, type Db } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import { InsufficientStockError, NotFoundError, ValidationError } from '../domain/errors.js';
import { MAX_UNITS_PER_ITEM } from '../domain/order.js';
import { medicationIdSchema, parseInput } from './validation.js';

const quantitySchema = z
  .number()
  .int()
  .positive('La cantidad debe ser mayor que cero.')
  .max(MAX_UNITS_PER_ITEM, `Máximo ${MAX_UNITS_PER_ITEM} unidades por medicamento en un pedido.`);

const addItemSchema = z.object({ medicationId: medicationIdSchema, quantity: quantitySchema.default(1) });
const updateItemSchema = z.object({ medicationId: medicationIdSchema, quantity: quantitySchema });
const removeItemSchema = z.object({ medicationId: medicationIdSchema });

/** Obtiene (y bloquea) el carrito abierto del usuario; opcionalmente lo crea. */
async function lockOpenCart(tx: Db, userId: string, createIfMissing: boolean): Promise<string | null> {
  const existing = await tx.one<{ id: string }>(
    `select id from carts where user_id = $1 and status = 'OPEN' for update`,
    [userId],
  );
  if (existing) return existing.id;
  if (!createIfMissing) return null;
  const created = await tx.one<{ id: string }>(
    `insert into carts (user_id) values ($1)
     on conflict (user_id) where status = 'OPEN' do update set updated_at = now()
     returning id`,
    [userId],
  );
  return created!.id;
}

/** Invariantes de cantidad: tope por ítem y stock disponible en bodega. */
async function assertQuantityAllowed(tx: Db, medicationId: number, quantity: number): Promise<void> {
  if (quantity > MAX_UNITS_PER_ITEM) {
    throw ValidationError.field(
      'quantity',
      `Máximo ${MAX_UNITS_PER_ITEM} unidades por medicamento en un pedido.`,
    );
  }
  const inventory = await tx.one<{ stock: number }>(
    'select stock from inventory where medication_id = $1',
    [medicationId],
  );
  if (!inventory) throw new NotFoundError('Medicamento', medicationId);
  if (inventory.stock < quantity) {
    throw new InsufficientStockError([{ medicationId, requested: quantity, available: inventory.stock }]);
  }
}

async function touchCart(tx: Db, cartId: string): Promise<void> {
  await tx.rows('update carts set updated_at = now() where id = $1', [cartId]);
}

export async function createCart(user: AuthUser): Promise<string> {
  const cartId = await withTransaction((tx) => lockOpenCart(tx, user.id, true));
  logger.command(`CreateCart → carrito ${cartId}`);
  return cartId!;
}

export async function addItemToCart(user: AuthUser, input: unknown): Promise<string> {
  const { medicationId, quantity } = parseInput(addItemSchema, input);
  const cartId = await withTransaction(async (tx) => {
    const cartId = (await lockOpenCart(tx, user.id, true))!;
    const current = await tx.one<{ quantity: number }>(
      'select quantity from cart_items where cart_id = $1 and medication_id = $2',
      [cartId, medicationId],
    );
    const newQuantity = (current?.quantity ?? 0) + quantity;
    await assertQuantityAllowed(tx, medicationId, newQuantity);
    await tx.rows(
      `insert into cart_items (cart_id, medication_id, quantity) values ($1, $2, $3)
       on conflict (cart_id, medication_id)
       do update set quantity = excluded.quantity, updated_at = now()`,
      [cartId, medicationId, newQuantity],
    );
    await touchCart(tx, cartId);
    return cartId;
  });
  logger.command(`AddItemToCart → medicamento ${medicationId} x${quantity}`);
  return cartId;
}

export async function updateCartItemQuantity(user: AuthUser, input: unknown): Promise<string> {
  const { medicationId, quantity } = parseInput(updateItemSchema, input);
  const cartId = await withTransaction(async (tx) => {
    const cartId = await lockOpenCart(tx, user.id, false);
    if (!cartId) throw new NotFoundError('Carrito');
    await assertQuantityAllowed(tx, medicationId, quantity);
    const updated = await tx.rows(
      `update cart_items set quantity = $3, updated_at = now()
       where cart_id = $1 and medication_id = $2 returning medication_id`,
      [cartId, medicationId, quantity],
    );
    if (updated.length === 0) throw new NotFoundError('Ítem del carrito', medicationId);
    await touchCart(tx, cartId);
    return cartId;
  });
  logger.command(`UpdateCartItemQuantity → medicamento ${medicationId} = ${quantity}`);
  return cartId;
}

export async function removeItemFromCart(user: AuthUser, input: unknown): Promise<string> {
  const { medicationId } = parseInput(removeItemSchema, input);
  const cartId = await withTransaction(async (tx) => {
    const cartId = await lockOpenCart(tx, user.id, false);
    if (!cartId) throw new NotFoundError('Carrito');
    const removed = await tx.rows(
      'delete from cart_items where cart_id = $1 and medication_id = $2 returning medication_id',
      [cartId, medicationId],
    );
    if (removed.length === 0) throw new NotFoundError('Ítem del carrito', medicationId);
    await touchCart(tx, cartId);
    return cartId;
  });
  logger.command(`RemoveItemFromCart → medicamento ${medicationId}`);
  return cartId;
}

export async function clearCart(user: AuthUser): Promise<string> {
  const cartId = await withTransaction(async (tx) => {
    const cartId = (await lockOpenCart(tx, user.id, true))!;
    await tx.rows('delete from cart_items where cart_id = $1', [cartId]);
    await touchCart(tx, cartId);
    return cartId;
  });
  logger.command(`ClearCart → carrito ${cartId}`);
  return cartId;
}
