import { PubSub } from 'graphql-subscriptions';
import type { OrderProjectionRow } from '../queries/order.queries.js';

/**
 * Bus en memoria para GraphQL Subscriptions. Solo lo publica el Projector
 * DESPUÉS de actualizar el read model, así el cliente siempre recibe la
 * proyección ya consistente.
 */
export const TOPICS = {
  ORDER_UPDATED: 'ORDER_UPDATED',
} as const;

export interface PubSubEvents {
  [TOPICS.ORDER_UPDATED]: { order: OrderProjectionRow };
  [key: string]: unknown;
}

export const pubsub = new PubSub<PubSubEvents>();
