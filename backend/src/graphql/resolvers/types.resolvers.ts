/**
 * Resolvers de tipos. Toda relación anidada (Medication.category,
 * Medication.laboratory, CartItem.medication, OrderLine.medication, ...)
 * pasa por un DataLoader del contexto: sin importar cuántos nodos haya en
 * la respuesta, cada relación cuesta UNA consulta SQL por nivel.
 */
import type { CartItemView, CartView } from '../../queries/cart.queries.js';
import type { CatalogRow, CategoryRow, LaboratoryRow } from '../../queries/catalog.queries.js';
import type { OrderProjectionRow } from '../../queries/order.queries.js';
import type { OrderLineSnapshot } from '../../domain/events.js';
import type { Shortage } from '../../domain/errors.js';
import type { GraphQLContext } from '../context.js';

async function requiredMedication(ctx: GraphQLContext, id: number): Promise<CatalogRow> {
  const medication = await ctx.loaders.medicationById.load(id);
  if (!medication) throw new Error(`Medicamento ${id} no existe en el catálogo proyectado.`);
  return medication;
}

export const typeResolvers = {
  Medication: {
    id: (m: CatalogRow) => String(m.medication_id),
    activeIngredient: (m: CatalogRow) => m.active_ingredient,
    requiresPrescription: (m: CatalogRow) => m.requires_prescription,
    category: (m: CatalogRow, _args: unknown, ctx: GraphQLContext) => ctx.loaders.categoryById.load(m.category_id),
    laboratory: (m: CatalogRow, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.laboratoryById.load(m.laboratory_id),
    availability: (m: CatalogRow) => ({
      status: m.availability,
      unitsAvailable: m.stock_available,
      syncedAt: m.synced_at,
    }),
  },

  Category: {
    id: (c: CategoryRow) => String(c.id),
    medicationCount: (c: CategoryRow, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.medicationCountByCategoryId.load(c.id),
    medications: async (c: CategoryRow, args: { first?: number | null }, ctx: GraphQLContext) => {
      const all = await ctx.loaders.medicationsByCategoryId.load(c.id);
      return all.slice(0, Math.max(0, args.first ?? 10));
    },
  },

  Laboratory: {
    id: (l: LaboratoryRow) => String(l.id),
  },

  Cart: {
    itemCount: (c: CartView) => c.items.reduce((n, i) => n + i.quantity, 0),
    subtotal: (c: CartView) => c.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    requiresPrescription: (c: CartView) => c.items.some((i) => i.requiresPrescription),
  },

  CartItem: {
    id: (i: CartItemView) => `${i.cartId}:${i.medicationId}`,
    lineTotal: (i: CartItemView) => i.price * i.quantity,
    medication: (i: CartItemView, _args: unknown, ctx: GraphQLContext) => requiredMedication(ctx, i.medicationId),
  },

  OrderSummary: {
    id: (o: OrderProjectionRow) => o.order_id,
    itemCount: (o: OrderProjectionRow) => o.item_count,
    requiresPrescription: (o: OrderProjectionRow) => o.requires_prescription,
    shippingAddress: (o: OrderProjectionRow) => o.shipping_address,
    customerName: (o: OrderProjectionRow) => o.customer_name,
    statusHistory: (o: OrderProjectionRow) => o.status_history,
    placedAt: (o: OrderProjectionRow) => o.placed_at,
    updatedAt: (o: OrderProjectionRow) => o.updated_at,
    projectionVersion: (o: OrderProjectionRow) => o.projection_version,
    syncedAt: (o: OrderProjectionRow) => o.synced_at,
  },

  OrderLine: {
    medicationId: (l: OrderLineSnapshot) => String(l.medicationId),
    medication: (l: OrderLineSnapshot, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.medicationById.load(l.medicationId),
  },

  StockShortage: {
    medication: (s: Shortage, _args: unknown, ctx: GraphQLContext) => requiredMedication(ctx, s.medicationId),
  },

  PrescriptionRequiredError: {
    medications: async (e: { medicationIds: number[] }, _args: unknown, ctx: GraphQLContext) => {
      const rows = await ctx.loaders.medicationById.loadMany(e.medicationIds);
      return rows.filter((r): r is CatalogRow => r !== null && !(r instanceof Error));
    },
  },

  NotFoundError: {
    resourceId: (e: { resourceId: string | number | null }) => (e.resourceId === null ? null : String(e.resourceId)),
  },
};
