import { describe, expect, it } from 'vitest';
import { InvalidStateTransitionError } from './errors.js';
import { assertTransition, canTransition } from './order.js';
import { validatePrescription } from './prescription.js';

describe('Máquina de estados de la orden', () => {
  it('permite el flujo feliz PENDING_APPROVAL → APPROVED → DISPATCHED', () => {
    expect(canTransition('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'DISPATCHED')).toBe(true);
  });

  it('permite cancelar antes del despacho', () => {
    expect(canTransition('PENDING_APPROVAL', 'CANCELLED')).toBe(true);
    expect(canTransition('APPROVED', 'CANCELLED')).toBe(true);
  });

  it('rechaza despachar sin aprobación y cualquier cambio tras un estado final', () => {
    expect(() => assertTransition('PENDING_APPROVAL', 'DISPATCHED')).toThrow(InvalidStateTransitionError);
    expect(() => assertTransition('DISPATCHED', 'CANCELLED')).toThrow(InvalidStateTransitionError);
    expect(() => assertTransition('CANCELLED', 'APPROVED')).toThrow(InvalidStateTransitionError);
  });
});

describe('Validación de la fórmula médica', () => {
  const today = new Date('2026-09-23T12:00:00Z');
  const valid = {
    doctorName: 'Dra. Ana Ruiz',
    doctorLicense: 'RM-12345',
    patientDocument: '1000000001',
    issuedAt: '2026-09-20',
  };

  it('acepta una fórmula vigente del mismo paciente', () => {
    expect(validatePrescription(valid, '1000000001', today)).toEqual([]);
  });

  it('rechaza fórmulas futuras o vencidas', () => {
    expect(validatePrescription({ ...valid, issuedAt: '2026-09-24' }, '1000000001', today)[0].field).toBe(
      'prescription.issuedAt',
    );
    expect(validatePrescription({ ...valid, issuedAt: '2026-08-01' }, '1000000001', today)[0].message).toMatch(
      /vencida/,
    );
  });

  it('rechaza fórmulas de otro paciente y registros médicos inválidos', () => {
    const errors = validatePrescription({ ...valid, doctorLicense: '!!' }, '999', today);
    expect(errors.map((e) => e.field).sort()).toEqual(['prescription.doctorLicense', 'prescription.patientDocument']);
  });
});
