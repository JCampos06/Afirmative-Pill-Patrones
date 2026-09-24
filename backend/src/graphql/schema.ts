import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { mutationResolvers } from './resolvers/mutation.resolvers.js';
import { queryResolvers } from './resolvers/query.resolvers.js';
import { subscriptionResolvers } from './resolvers/subscription.resolvers.js';
import { typeResolvers } from './resolvers/types.resolvers.js';
import { scalarResolvers } from './scalars.js';
import { typeDefs } from './typeDefs.generated.js';

/** Une el contrato SDL (schema.graphql) con sus resolvers. */
export function buildSchema(): GraphQLSchema {
  return makeExecutableSchema({
    typeDefs,
    resolvers: [scalarResolvers, typeResolvers, queryResolvers, mutationResolvers, subscriptionResolvers],
  });
}
