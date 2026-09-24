/**
 * Servidor local persistente: HTTP (queries/mutations) + WebSocket
 * (subscriptions con graphql-ws) sobre el MISMO endpoint /graphql.
 */
import { createServer } from 'node:http';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { useServer } from 'graphql-ws/use/ws';
import { WebSocketServer } from 'ws';
import { env } from './config/env.js';
import { pool } from './infra/db.js';
import { logger } from './infra/logger.js';
import { buildContext } from './graphql/context.js';
import { buildSchema } from './graphql/schema.js';
import { createApp } from './http/app.js';
import { sweep } from './projections/projector.js';

const SWEEP_INTERVAL_MS = 10_000;

const schema = buildSchema();
const httpServer = createServer();

const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
const wsCleanup = useServer(
  {
    schema,
    context: (ctx) => {
      const params = ctx.connectionParams ?? {};
      return buildContext(params.authorization ?? params.authToken);
    },
    onConnect: () => {
      logger.graphql('⇄ Cliente WebSocket conectado');
      return true;
    },
    onSubscribe: (_ctx, _id, payload) => {
      logger.graphql(`▶ subscription ${payload.operationName ?? '(anónima)'}`);
    },
    onDisconnect: () => logger.graphql('⇄ Cliente WebSocket desconectado'),
  },
  wsServer,
);

const { app } = await createApp({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await wsCleanup.dispose();
          },
        };
      },
    },
  ],
});

httpServer.on('request', app);
await new Promise<void>((resolve) => httpServer.listen(env.port, resolve));

logger.info(`🚀 GraphQL (HTTP)      → http://localhost:${env.port}/graphql`);
logger.info(`🔌 Subscriptions (WS)  → ws://localhost:${env.port}/graphql`);
logger.info(
  `⏱  Consistencia eventual: proyección +${env.projectionDelayMs}ms · auto-aprobación OTC +${env.autoApproveDelayMs}ms`,
);
logger.info(`🧮 DataLoader ${env.disableDataLoader ? 'DESACTIVADO (modo demostración N+1)' : 'activado'}`);

// Barrido periódico del outbox: red de seguridad por si algún evento quedó pendiente.
let sweeping = false;
async function runSweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    await sweep();
  } catch (err) {
    logger.error('Falló el barrido del outbox', err);
  } finally {
    sweeping = false;
  }
}
void runSweep();
const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);

async function shutdown() {
  logger.info('Cerrando servidor...');
  clearInterval(timer);
  httpServer.close();
  await pool.end().catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
