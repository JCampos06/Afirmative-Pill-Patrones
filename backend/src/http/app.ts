/**
 * Aplicación HTTP. ZERO-REST: el único endpoint expuesto es /graphql.
 * (/api/graphql es el mismo endpoint GraphQL tal como lo enruta Vercel.)
 */
import { ApolloServer, type ApolloServerPlugin } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { expressMiddleware } from '@as-integrations/express5';
import cors from 'cors';
import express, { type Express } from 'express';
import type { GraphQLSchema } from 'graphql';
import { env } from '../config/env.js';
import { requestStats, type RequestStats } from '../infra/db.js';
import { buildContext, type GraphQLContext } from '../graphql/context.js';
import { operationLoggerPlugin } from '../graphql/plugins.js';

export const GRAPHQL_PATHS = ['/graphql', '/api/graphql'];

interface CreateAppOptions {
  schema: GraphQLSchema;
  plugins?: ApolloServerPlugin<GraphQLContext>[];
}

export async function createApp({ schema, plugins = [] }: CreateAppOptions): Promise<{
  app: Express;
  apollo: ApolloServer<GraphQLContext>;
}> {
  const apollo = new ApolloServer<GraphQLContext>({
    schema,
    introspection: env.introspection,
    includeStacktraceInErrorResponses: false,
    plugins: [
      ...plugins,
      operationLoggerPlugin,
      env.introspection
        ? ApolloServerPluginLandingPageLocalDefault({ embed: true, includeCookies: false })
        : ApolloServerPluginLandingPageDisabled(),
    ],
  });
  await apollo.start();

  const app = express();
  app.disable('x-powered-by');

  app.use(
    GRAPHQL_PATHS,
    cors(env.corsOrigin.includes('*') ? { origin: true } : { origin: env.corsOrigin }),
    express.json({ limit: '1mb' }),
    // Abre un contexto de métricas por request (AsyncLocalStorage).
    (_req, res, next) => {
      const stats: RequestStats = { queries: 0, loaderBatches: 0 };
      res.locals.stats = stats;
      requestStats.run(stats, next);
    },
    expressMiddleware(apollo, {
      context: async ({ req, res }) => buildContext(req.headers.authorization, res.locals.stats as RequestStats),
    }),
  );

  return { app, apollo };
}
