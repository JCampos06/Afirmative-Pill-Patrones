/**
 * POLÍTICAS (process manager): reaccionan a eventos ya proyectados
 * emitiendo nuevos comandos del sistema.
 *
 *   OrderPlaced (sin fórmula) ──► espera ──► AutoApproveOtcOrder ──► OrderApproved
 */
import { env } from '../config/env.js';
import { sleep } from '../infra/background.js';
import { db } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import { autoApproveOtcOrder } from '../commands/order.commands.js';

export type FollowUp = () => Promise<boolean>;

export function autoApprovalFollowUp(orderId: string): FollowUp {
  return async () => {
    await sleep(env.autoApproveDelayMs);
    return autoApproveOtcOrder(orderId);
  };
}

/**
 * Red de seguridad: si una aprobación automática se perdió (p. ej. la
 * función serverless terminó antes), se retoma aquí.
 */
export async function recoverStalledOtcOrders(): Promise<boolean> {
  const stalled = await db.rows<{ id: string }>(
    `select id from orders
      where status = 'PENDING_APPROVAL' and not requires_prescription
        and updated_at < now() - make_interval(secs => $1)
      limit 20`,
    [Math.ceil(env.autoApproveDelayMs / 1000) * 3 + 10],
  );
  let changed = false;
  for (const { id } of stalled) {
    logger.warn(`Retomando aprobación automática pendiente de la orden ${id}`);
    changed = (await autoApproveOtcOrder(id)) || changed;
  }
  return changed;
}
