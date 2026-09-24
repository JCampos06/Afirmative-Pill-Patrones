/**
 * SUBSCRIPTIONS — el Projector publica aquí la proyección ya actualizada.
 * withFilter asegura que cada cliente reciba solo lo que le corresponde.
 */
import { withFilter } from 'graphql-subscriptions';
import { pubsub, TOPICS } from '../../infra/pubsub.js';
import type { OrderProjectionRow } from '../../queries/order.queries.js';
import { requireRole, requireUser, type GraphQLContext } from '../context.js';

type OrderEvent = { order: OrderProjectionRow };

const orderIterator = () => pubsub.asyncIterableIterator<OrderEvent>(TOPICS.ORDER_UPDATED);

export const subscriptionResolvers = {
  Subscription: {
    orderStatusChanged: {
      subscribe: withFilter<OrderEvent, { orderId: string }, GraphQLContext>(
        (_root, _args, ctx) => {
          requireUser(ctx!);
          return orderIterator();
        },
        (payload, args, ctx) => {
          const user = ctx!.user!;
          const order = payload!.order;
          return order.order_id === args!.orderId && (user.role === 'PHARMACIST' || order.user_id === user.id);
        },
      ),
      resolve: (payload: OrderEvent) => payload.order,
    },

    orderFeed: {
      subscribe: (_root: unknown, _args: unknown, ctx: GraphQLContext) => {
        requireRole(ctx, 'PHARMACIST');
        return orderIterator();
      },
      resolve: (payload: OrderEvent) => payload.order,
    },
  },
};
