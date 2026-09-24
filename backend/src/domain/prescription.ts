import type { FieldError } from './errors.js';

/** Vigencia máxima (en días) de una fórmula médica para dispensar. */
export const PRESCRIPTION_VALIDITY_DAYS = 30;

export interface PrescriptionData {
  doctorName: string;
  doctorLicense: string;
  patientDocument: string;
  issuedAt: string; // YYYY-MM-DD
  documentUrl?: string | null;
  notes?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDay(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Reglas de negocio del soporte de prescripción:
 *  1. La fecha de expedición no puede ser futura.
 *  2. La fórmula no puede tener más de PRESCRIPTION_VALIDITY_DAYS días.
 *  3. El documento de la fórmula debe coincidir con el del paciente.
 *  4. El registro médico debe tener un formato plausible.
 */
export function validatePrescription(
  data: PrescriptionData,
  patientDocument: string,
  today: Date = new Date(),
): FieldError[] {
  const errors: FieldError[] = [];
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const issued = toUtcDay(data.issuedAt);

  if (issued > todayUtc) {
    errors.push({ field: 'prescription.issuedAt', message: 'La fecha de la fórmula no puede ser futura.' });
  } else if ((todayUtc - issued) / DAY_MS > PRESCRIPTION_VALIDITY_DAYS) {
    errors.push({
      field: 'prescription.issuedAt',
      message: `La fórmula está vencida: tiene más de ${PRESCRIPTION_VALIDITY_DAYS} días.`,
    });
  }

  if (data.patientDocument.trim() !== patientDocument.trim()) {
    errors.push({
      field: 'prescription.patientDocument',
      message: 'El documento de la fórmula no coincide con el del paciente autenticado.',
    });
  }

  if (!/^[A-Za-z0-9-]{4,20}$/.test(data.doctorLicense.trim())) {
    errors.push({
      field: 'prescription.doctorLicense',
      message: 'El registro médico debe tener entre 4 y 20 caracteres alfanuméricos.',
    });
  }

  return errors;
}
