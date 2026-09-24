import type { ApolloServerPlugin } from '@apollo/server';
import { logger } from '../infra/logger.js';
import type { GraphQLContext } from './context.js';

const EXPECTED_ERROR_CODES = new Set([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'BAD_USER_INPUT',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
]);

/**
 * Imprime cada operación con el número de consultas SQL y de lotes de
 * DataLoader que necesitó. Es la evidencia en logs pedida en la sustentación.
 */
export const operationLoggerPlugin: ApolloServerPlugin<GraphQLContext> = {
  async requestDidStart({ request }) {
    if (request.operationName === 'IntrospectionQuery') return;
    const started = performance.now();
    return {
      async didResolveOperation({ operation, operationName }) {
        logger.graphql(`▶ ${operation?.operation ?? 'operation'} ${operationName ?? '(anónima)'}`);
      },
      async didEncounterErrors({ errors }) {
        for (const error of errors) {
          const code = String(error.extensions?.code ?? '');
          if (EXPECTED_ERROR_CODES.has(code)) logger.warn(`${code}: ${error.message}`);
          else logger.error(`Error GraphQL: ${error.message}`, error.originalError ?? undefined);
        }
      },
      async willSendResponse({ contextValue, operation, operationName }) {
        if (!operation) return;
        const ms = (performance.now() - started).toFixed(0);
        const { queries, loaderBatches } = contextValue.stats;
        logger.graphql(
          `◀ ${operation.operation} ${operationName ?? '(anónima)'} · ${queries} consultas SQL · ` +
            `${loaderBatches} lotes DataLoader · ${ms}ms`,
        );
      },
    };
  },
};
