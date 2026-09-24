/**
 * MUTATIONS → lado de ESCRITURA de CQRS. Cada mutation delega en un
 * Command Handler y traduce el resultado a la unión tipada del contrato:
 *   éxito → *Payload   |   invariante violada → *Error (miembro de la unión)
 */
import * as authCommands from '../../commands/auth.commands.js';
import * as cartCommands from '../../commands/cart.commands.js';
import * as orderCommands from '../../commands/order.commands.js';
import { DomainError } from '../../domain/errors.js';
import { getCartById } from '../../queries/cart.queries.js';
import { requireRole, requireUser, type GraphQLContext } from '../context.js';

/** Convierte errores de dominio en miembros de la unión de resultado. */
async function asResult(run: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof DomainError) return err.toGraphQL();
    throw err;
  }
}

async function cartPayload(cartId: string) {
  return { __typename: 'CartPayload', cart: await getCartById(cartId) };
}

type Input = { input: unknown };

export const mutationResolvers = {
  Mutation: {
    register: (_root: unknown, { input }: Input) =>
      asResult(async () => ({ __typename: 'AuthPayload', ...(await authCommands.register(input)) })),

    login: (_root: unknown, { input }: Input) =>
      asResult(async () => ({ __typename: 'AuthPayload', ...(await authCommands.login(input)) })),

    // ─── Carrito ───────────────────────────────────────────────────
    createCart: (_root: unknown, _args: unknown, ctx: GraphQLContext) =>
      asResult(async () => cartPayload(await cartCommands.createCart(requireUser(ctx)))),

    addItemToCart: (_root: unknown, { input }: Input, ctx: GraphQLContext) =>
      asResult(async () => cartPayload(await cartCommands.addItemToCart(requireUser(ctx), input))),

    updateCartItemQuantity: (_root: unknown, { input }: Input, ctx: GraphQLContext) =>
      asResult(async () => cartPayload(await cartCommands.updateCartItemQuantity(requireUser(ctx), input))),

    removeItemFromCart: (_root: unknown, { input }: Input, ctx: GraphQLContext) =>
      asResult(async () => cartPayload(await cartCommands.removeItemFromCart(requireUser(ctx), input))),

    clearCart: (_root: unknown, _args: unknown, ctx: GraphQLContext) =>
      asResult(async () => cartPayload(await cartCommands.clearCart(requireUser(ctx)))),

    // ─── Órdenes ───────────────────────────────────────────────────
    placeOrder: (_root: unknown, { input }: Input, ctx: GraphQLContext) =>
      asResult(async () => ({
        __typename: 'PlaceOrderPayload',
        receipt: await orderCommands.placeOrder(requireUser(ctx), input),
      })),

    cancelOrder: (_root: unknown, { input }: Input, ctx: GraphQLContext) =>
      asResult(async () => ({
        __typename: 'OrderCommandPayload',
        receipt: await orderCommands.cancelOrder(requireUser(ctx), input),
      })),

    reviewPrescription: (_root: unknown, { input }: Input, ctx: GraphQLContext) =>
      asResult(async () => ({
        __typename: 'OrderCommandPayload',
        receipt: await orderCommands.reviewPrescription(requireRole(ctx, 'PHARMACIST'), input),
      })),

    dispatchOrder: (_root: unknown, { input }: Input, ctx: GraphQLContext) =>
      asResult(async () => ({
        __typename: 'OrderCommandPayload',
        receipt: await orderCommands.dispatchOrder(requireRole(ctx, 'PHARMACIST'), input),
      })),
  },
};
