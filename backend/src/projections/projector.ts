/**
 * PROJECTOR — puente asíncrono entre el write model y el read model.
 *
 *  Comando ─COMMIT─► domain_events (outbox) ──(retardo)──► Projector
 *                                                           │  aplica handlers
 *                                                           ├─► order_projections / medication_catalog
 *                                                           ├─► PubSub → GraphQL Subscriptions
 *                                                           └─► Políticas (auto-aprobación OTC)
 *
 * Un advisory lock de PostgreSQL garantiza un único proyector activo, de
 * modo que los eventos se aplican estrictamente en orden de id.
 */
import { env } from '../config/env.js';
import { runInBackground, sleep } from '../infra/background.js';
import { withSqlLogsMuted, withTransaction, type Db } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import { pubsub, TOPICS } from '../infra/pubsub.js';
import type { DomainEvent, StoredEvent } from '../domain/events.js';
import { getOrderProjection, type OrderProjectionRow } from '../queries/order.queries.js';
import { projectInventoryMovement } from './catalog.projection.js';
import {
  projectOrderApproved,
  projectOrderCancelled,
  projectOrderDispatched,
  projectOrderPlaced,
} from './order.projection.js';
import { autoApprovalFollowUp, recoverStalledOtcOrders, type FollowUp } from './policies.js';

const PROJECTOR_LOCK_KEY = 74_242_026;
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;
const MAX_LOCK_RETRIES = 40;

interface EventRow {
  id: number;
  aggregate_type: string;
  aggregate_id: string;
  payload: DomainEvent;
  occurred_at: Date;
}

interface ApplyResult {
  orderId?: string;
  followUp?: FollowUp;
}

async function applyEvent(tx: Db, stored: StoredEvent): Promise<ApplyResult> {
  const e = stored.event;
  switch (e.type) {
    case 'OrderPlaced':
      await projectOrderPlaced(tx, stored as StoredEvent<typeof e>);
      return {
        orderId: e.orderId,
        followUp: e.requiresPrescription ? undefined : autoApprovalFollowUp(e.orderId),
      };
    case 'OrderApproved':
      await projectOrderApproved(tx, stored as StoredEvent<typeof e>);
      return { orderId: e.orderId };
    case 'OrderCancelled':
      await projectOrderCancelled(tx, stored as StoredEvent<typeof e>);
      return { orderId: e.orderId };
    case 'OrderDispatched':
      await projectOrderDispatched(tx, stored as StoredEvent<typeof e>);
      return { orderId: e.orderId };
    case 'InventoryReserved':
    case 'InventoryReleased':
      await projectInventoryMovement(tx, e.movements);
      return {};
    default: {
      const unknown: never = e;
      throw new Error(`Evento desconocido: ${JSON.stringify(unknown)}`);
    }
  }
}

interface BatchOutcome {
  locked: boolean;
  processed: number;
  /** Instantánea de la proyección tras CADA evento, en orden, para publicarla. */
  snapshots: OrderProjectionRow[];
  followUps: FollowUp[];
}

async function processBatch(): Promise<BatchOutcome> {
  return withTransaction(async (tx) => {
    const lock = await tx.one<{ locked: boolean }>('select pg_try_advisory_xact_lock($1) as locked', [
      PROJECTOR_LOCK_KEY,
    ]);
    if (!lock?.locked) return { locked: false, processed: 0, snapshots: [], followUps: [] };

    const rows = await tx.rows<EventRow>(
      `select id, aggregate_type, aggregate_id, payload, occurred_at
         from domain_events
        where processed_at is null and attempts < $1
        order by id
        limit $2`,
      [MAX_ATTEMPTS, BATCH_SIZE],
    );

    const snapshots: OrderProjectionRow[] = [];
    const followUps: FollowUp[] = [];

    for (const row of rows) {
      const stored: StoredEvent = {
        id: row.id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        event: row.payload,
        occurredAt: row.occurred_at,
      };
      await tx.rows('savepoint projector_event');
      try {
        const result = await applyEvent(tx, stored);
        await tx.rows('update domain_events set processed_at = now(), attempts = attempts + 1 where id = $1', [
          row.id,
        ]);
        await tx.rows('release savepoint projector_event');
        if (result.orderId) {
          const snapshot = await getOrderProjection(result.orderId, tx);
          if (snapshot) snapshots.push(snapshot);
        }
        if (result.followUp) followUps.push(result.followUp);
        logger.event(`#${row.id} ${row.payload.type} proyectado (${row.aggregate_type} ${row.aggregate_id.slice(0, 8)})`);
      } catch (err) {
        await tx.rows('rollback to savepoint projector_event');
        await tx.rows('update domain_events set attempts = attempts + 1, last_error = $2 where id = $1', [
          row.id,
          err instanceof Error ? err.message : String(err),
        ]);
        logger.error(`No se pudo proyectar el evento #${row.id} ${row.payload.type}`, err);
      }
    }

    return { locked: true, processed: rows.length, snapshots, followUps };
  });
}

/**
 * Publica en las subscriptions las proyecciones YA confirmadas (después del
 * COMMIT), una por evento, para que el cliente vea cada transición.
 */
async function publishSnapshots(snapshots: OrderProjectionRow[]): Promise<void> {
  for (const order of snapshots) {
    await pubsub.publish(TOPICS.ORDER_UPDATED, { order });
    logger.event(`Subscription → orden ${order.code} ahora ${order.status} (v${order.projection_version})`);
  }
}

/**
 * Procesa todos los eventos pendientes del outbox. Devuelve cuántos aplicó.
 * Al final ejecuta las políticas que se hayan disparado.
 */
export async function processOutbox(): Promise<number> {
  let total = 0;
  const followUps: FollowUp[] = [];

  for (let retries = 0; retries < MAX_LOCK_RETRIES; ) {
    const outcome = await processBatch();
    if (!outcome.locked) {
      retries += 1;
      await sleep(250);
      continue;
    }
    total += outcome.processed;
    followUps.push(...outcome.followUps);
    await publishSnapshots(outcome.snapshots);
    if (outcome.processed < BATCH_SIZE) break;
  }

  if (followUps.length > 0) {
    const results = await Promise.all(
      followUps.map((run) =>
        run().catch((err) => {
          logger.error('Una política del proyector falló', err);
          return false;
        }),
      ),
    );
    if (results.some(Boolean)) {
      await sleep(env.projectionDelayMs);
      total += await processOutbox();
    }
  }
  return total;
}

/**
 * Llamado por los comandos tras el COMMIT. El retardo configurable hace
 * visible la consistencia eventual: la orden existe en el write model
 * pero su proyección aparece unos instantes después.
 */
export function notifyNewEvents(): void {
  logger.event(`Nuevos eventos en el outbox → proyección en ${env.projectionDelayMs}ms (consistencia eventual)`);
  runInBackground('projector', async () => {
    await sleep(env.projectionDelayMs);
    await processOutbox();
  });
}

/**
 * Barrido periódico (servidor local) y recuperación de tareas perdidas.
 * Sus SQL no se imprimen para no ensuciar los logs de la demostración.
 */
export async function sweep(): Promise<void> {
  await withSqlLogsMuted(async () => {
    const recovered = await recoverStalledOtcOrders();
    const processed = await processOutbox();
    if (recovered || processed > 0) logger.event(`Barrido del outbox: ${processed} eventos aplicados.`);
  });
}
