/**
 * Punto de entrada para Vercel (función serverless).
 * Vercel no mantiene conexiones WebSocket, así que aquí solo se atienden
 * queries y mutations por HTTP; el frontend cambia automáticamente a
 * polling para el seguimiento en tiempo real (ver frontend/src/apollo).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { runInBackground } from './infra/background.js';
import { buildSchema } from './graphql/schema.js';
import { createApp } from './http/app.js';
import { sweep } from './projections/projector.js';

let appPromise: Promise<Express> | undefined;
let lastSweep = 0;
const SWEEP_EVERY_MS = 30_000;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  appPromise ??= createApp({ schema: buildSchema() }).then(({ app }) => app);
  const app = await appPromise;

  // Sin procesos persistentes, el barrido del outbox se hace de forma
  // oportunista (como máximo cada 30 s por instancia).
  if (Date.now() - lastSweep > SWEEP_EVERY_MS) {
    lastSweep = Date.now();
    runInBackground('sweep', sweep);
  }

  app(req as Parameters<Express>[0], res as Parameters<Express>[1]);
}
