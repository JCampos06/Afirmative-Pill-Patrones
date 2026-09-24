/**
 * Apollo Client: único canal de comunicación con el backend.
 *
 *   ErrorLink → SetContextLink (JWT) → split ─┬─ subscription → GraphQLWsLink (ws://…/graphql)
 *                                              └─ query/mutation → HttpLink (http://…/graphql)
 */
import { ApolloClient, ApolloLink, CombinedGraphQLErrors, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition, relayStylePagination } from '@apollo/client/utilities';
import { Kind, OperationTypeNode } from 'graphql';
import { createClient, type Client as WsClient } from 'graphql-ws';
import introspection from '../gql/possibleTypes';
import { GRAPHQL_HTTP_URL, GRAPHQL_WS_URL, SUBSCRIPTIONS_ENABLED } from './config';
import { authTokenVar } from './state';

// ─── Caché normalizada ────────────────────────────────────────────────

export const cache = new InMemoryCache({
  // Necesario para leer fragmentos sobre uniones/interfaces (CartResult, DomainError...)
  possibleTypes: introspection.possibleTypes,
  typePolicies: {
    Query: {
      fields: {
        // Paginación por cursor: fetchMore concatena páginas y cada
        // combinación de filtro/orden tiene su propia lista en caché.
        medications: relayStylePagination(['filter', 'sort']),
        // Las ids de Query.medication(id) y Query.order(id) apuntan a
        // entidades ya normalizadas: se leen de la caché sin ir a la red.
        medication: {
          read(existing, { args, toReference }) {
            return existing ?? toReference({ __typename: 'Medication', id: args?.id });
          },
        },
      },
    },
    Cart: {
      fields: {
        items: { merge: false },
      },
    },
    OrderSummary: {
      fields: {
        items: { merge: false },
        statusHistory: { merge: false },
      },
    },
    // Objetos sin id: se fusionan dentro de su entidad padre.
    Availability: { merge: true },
    PrescriptionSummary: { merge: true },
  },
});

// ─── Links ─────────────────────────────────────────────────────────────

const httpLink = new HttpLink({ uri: GRAPHQL_HTTP_URL });

/** Añade el JWT a cada operación HTTP. */
const authLink = new SetContextLink((prevContext) => {
  const token = authTokenVar();
  return {
    headers: {
      ...prevContext.headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

let onSessionExpired: (() => void) | null = null;

/** Permite al AuthProvider reaccionar a un token vencido. */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

const errorLink = new ErrorLink(({ error, operation }) => {
  if (CombinedGraphQLErrors.is(error)) {
    for (const e of error.errors) {
      if (e.extensions?.code === 'UNAUTHENTICATED' && authTokenVar()) onSessionExpired?.();
      console.warn(`[GraphQL] ${operation.operationName}: ${e.message}`);
    }
  } else {
    console.error(`[Red] ${operation.operationName}:`, error);
  }
});

export let wsClient: WsClient | null = null;

function buildTransport(): ApolloLink {
  if (!SUBSCRIPTIONS_ENABLED) return httpLink;

  wsClient = createClient({
    url: GRAPHQL_WS_URL,
    lazy: true,
    retryAttempts: Infinity,
    // Se evalúa en cada conexión: siempre envía el token vigente.
    connectionParams: () => {
      const token = authTokenVar();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  });

  return ApolloLink.split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === Kind.OPERATION_DEFINITION && definition.operation === OperationTypeNode.SUBSCRIPTION
      );
    },
    new GraphQLWsLink(wsClient),
    httpLink,
  );
}

export const client = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, buildTransport()]),
  cache,
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' },
  },
});

/** Reinicia el WebSocket para que las subscriptions usen el nuevo token. */
export function restartSubscriptions(): void {
  wsClient?.terminate();
}
