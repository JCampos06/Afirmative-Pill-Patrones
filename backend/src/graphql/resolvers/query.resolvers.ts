/**
 * QUERIES → lado de LECTURA de CQRS. Solo usan el paquete queries/ y los
 * DataLoaders; jamás invocan comandos ni modifican estado.
 */
import {
  encodeCursor,
  getMedicationBySku,
  listCategories,
  listLaboratories,
  searchMedications,
  type SearchArgs,
} from '../../queries/catalog.queries.js';
import { getOpenCartForUser } from '../../queries/cart.queries.js';
import { getOrderProjection, listOrdersByStatus, listOrdersByUser } from '../../queries/order.queries.js';
import { getUserById } from '../../queries/user.queries.js';
import type { OrderStatus } from '../../domain/order.js';
import { requireRole, requireUser, type GraphQLContext } from '../context.js';

export const queryResolvers = {
  Query: {
    medications: async (_root: unknown, args: SearchArgs, ctx: GraphQLContext) => {
      const page = await searchMedications(args);
      const edges = page.rows.map((row, i) => {
        // Precarga la caché del loader: si la misma respuesta pide el
        // medicamento por id más adelante, no se vuelve a consultar.
        ctx.loaders.medicationById.prime(row.medication_id, row);
        return { cursor: encodeCursor(page.offset + i), node: row };
      });
      return {
        edges,
        totalCount: page.totalCount,
        pageInfo: {
          hasNextPage: page.offset + page.rows.length < page.totalCount,
          hasPreviousPage: page.offset > 0,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges.at(-1)?.cursor ?? null,
        },
      };
    },

    medication: (_root: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const id = Number(args.id);
      if (!Number.isInteger(id) || id <= 0) return null;
      return ctx.loaders.medicationById.load(id);
    },

    medicationBySku: (_root: unknown, args: { sku: string }) => getMedicationBySku(args.sku),

    categories: () => listCategories(),

    laboratories: () => listLaboratories(),

    me: (_root: unknown, _args: unknown, ctx: GraphQLContext) => (ctx.user ? getUserById(ctx.user.id) : null),

    myCart: (_root: unknown, _args: unknown, ctx: GraphQLContext) => getOpenCartForUser(requireUser(ctx).id),

    myOrders: (_root: unknown, args: { status?: OrderStatus | null }, ctx: GraphQLContext) =>
      listOrdersByUser(requireUser(ctx).id, args.status),

    order: async (_root: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      const order = await getOrderProjection(args.id);
      if (!order) return null;
      // Un paciente solo ve sus propias órdenes.
      if (user.role === 'PATIENT' && order.user_id !== user.id) return null;
      return order;
    },

    ordersForReview: (_root: unknown, args: { status?: OrderStatus | null }, ctx: GraphQLContext) => {
      requireRole(ctx, 'PHARMACIST');
      return listOrdersByStatus(args.status ?? null);
    },
  },
};
