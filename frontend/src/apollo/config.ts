const env = import.meta.env;

/** Único endpoint del backend (Zero-REST). */
export const GRAPHQL_HTTP_URL: string = env.VITE_GRAPHQL_HTTP_URL || 'http://localhost:4000/graphql';

export const GRAPHQL_WS_URL: string = env.VITE_GRAPHQL_WS_URL || GRAPHQL_HTTP_URL.replace(/^http/, 'ws');

/**
 * true  → seguimiento con GraphQL Subscriptions (WebSocket).
 * false → seguimiento con polling (p. ej. backend serverless en Vercel).
 */
export const SUBSCRIPTIONS_ENABLED: boolean = (env.VITE_ENABLE_SUBSCRIPTIONS ?? 'true') !== 'false';

/** Intervalo de polling cuando no hay subscriptions o la proyección aún no llega. */
export const POLL_INTERVAL_MS = 2000;
