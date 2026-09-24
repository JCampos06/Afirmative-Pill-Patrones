import { waitUntil } from '@vercel/functions';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta trabajo asíncrono DESPUÉS de responder al cliente.
 *  - Servidor Node persistente: la promesa simplemente sigue viva.
 *  - Vercel (serverless): waitUntil() mantiene la función activa hasta que
 *    termine la tarea, aunque la respuesta HTTP ya se haya enviado.
 */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const promise = task().catch((err) => logger.error(`Tarea en segundo plano "${label}" falló`, err));
  if (env.isServerless) waitUntil(promise);
}
