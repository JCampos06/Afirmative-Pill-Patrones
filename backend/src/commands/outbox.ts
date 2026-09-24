import type { Db } from '../infra/db.js';
import type { DomainEvent } from '../domain/events.js';

/**
 * Registra eventos de dominio en el outbox DENTRO de la transacción del
 * comando: o se confirma el cambio de estado junto con sus eventos, o no
 * se confirma nada (atomicidad del patrón Transactional Outbox).
 */
export async function appendEvents(
  tx: Db,
  aggregateType: string,
  aggregateId: string,
  events: DomainEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const values = events.map((_, i) => `($1, $2, $${i * 2 + 3}, $${i * 2 + 4}::jsonb)`).join(', ');
  const params = [aggregateType, aggregateId, ...events.flatMap((e) => [e.type, JSON.stringify(e)])];
  await tx.rows(
    `insert into domain_events (aggregate_type, aggregate_id, event_type, payload) values ${values}`,
    params,
  );
}
