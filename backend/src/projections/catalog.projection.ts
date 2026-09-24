/**
 * Proyección medication_catalog: sincroniza la disponibilidad del catálogo
 * cuando el inventario se reserva o se libera. Mientras el evento no se
 * procesa, el catálogo muestra el stock anterior (consistencia eventual);
 * la verdad la tiene siempre el write model, que valida al confirmar.
 */
import type { Db } from '../infra/db.js';
import type { StockMovement } from '../domain/events.js';

export async function projectInventoryMovement(tx: Db, movements: StockMovement[]): Promise<void> {
  if (movements.length === 0) return;
  await tx.rows('select refresh_medication_catalog($1::int[])', [movements.map((m) => m.medicationId)]);
}
