import type { z } from 'zod';

/**
 * Errores de dominio. Los comandos los LANZAN (provocando ROLLBACK de la
 * transacción) y la capa GraphQL los convierte en miembros tipados de las
 * uniones de resultado (PlaceOrderResult, CartResult, ...).
 */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'PRESCRIPTION_REQUIRED'
  | 'INVALID_STATE_TRANSITION'
  | 'EMPTY_CART'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED';

export interface FieldError {
  field: string;
  message: string;
}

export abstract class DomainError extends Error {
  abstract readonly typename: string;
  abstract readonly code: ErrorCode;

  /** Objeto listo para GraphQL (el __typename resuelve la unión). */
  toGraphQL(): Record<string, unknown> {
    return { __typename: this.typename, code: this.code, message: this.message, ...this.details() };
  }

  protected details(): Record<string, unknown> {
    return {};
  }
}

export class ValidationError extends DomainError {
  readonly typename = 'ValidationError';
  readonly code = 'VALIDATION_FAILED' as const;

  constructor(
    message: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
  }

  static fromZod(error: z.ZodError): ValidationError {
    const fieldErrors = error.issues.map((issue) => ({
      field: issue.path.join('.') || 'input',
      message: issue.message,
    }));
    return new ValidationError('Los datos enviados no son válidos.', fieldErrors);
  }

  static field(field: string, message: string): ValidationError {
    return new ValidationError(message, [{ field, message }]);
  }

  protected override details() {
    return { fieldErrors: this.fieldErrors };
  }
}

export class NotFoundError extends DomainError {
  readonly typename = 'NotFoundError';
  readonly code = 'NOT_FOUND' as const;

  constructor(
    readonly resource: string,
    readonly resourceId: string | number | null = null,
  ) {
    super(`${resource} no encontrado${resourceId !== null ? ` (${resourceId})` : ''}.`);
  }

  protected override details() {
    return { resource: this.resource, resourceId: this.resourceId };
  }
}

export interface Shortage {
  medicationId: number;
  requested: number;
  available: number;
}

export class InsufficientStockError extends DomainError {
  readonly typename = 'InsufficientStockError';
  readonly code = 'INSUFFICIENT_STOCK' as const;

  constructor(readonly shortages: Shortage[]) {
    super(
      shortages.length === 1
        ? 'No hay unidades suficientes en bodega para uno de los medicamentos.'
        : `No hay unidades suficientes en bodega para ${shortages.length} medicamentos.`,
    );
  }

  protected override details() {
    return { shortages: this.shortages };
  }
}

export class PrescriptionRequiredError extends DomainError {
  readonly typename = 'PrescriptionRequiredError';
  readonly code = 'PRESCRIPTION_REQUIRED' as const;

  constructor(readonly medicationIds: number[]) {
    super('El pedido contiene medicamentos que exigen fórmula médica. Adjunta el soporte de la prescripción.');
  }

  protected override details() {
    return { medicationIds: this.medicationIds };
  }
}

export class InvalidStateTransitionError extends DomainError {
  readonly typename = 'InvalidStateTransitionError';
  readonly code = 'INVALID_STATE_TRANSITION' as const;

  constructor(
    readonly currentStatus: string,
    readonly attemptedStatus: string,
    message?: string,
  ) {
    super(message ?? `No es posible pasar de ${currentStatus} a ${attemptedStatus}.`);
  }

  protected override details() {
    return { currentStatus: this.currentStatus, attemptedStatus: this.attemptedStatus };
  }
}

export class EmptyCartError extends DomainError {
  readonly typename = 'EmptyCartError';
  readonly code = 'EMPTY_CART' as const;

  constructor() {
    super('El carrito está vacío.');
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly typename = 'InvalidCredentialsError';
  readonly code = 'INVALID_CREDENTIALS' as const;

  constructor() {
    super('Correo o contraseña incorrectos.');
  }
}

export class EmailAlreadyRegisteredError extends DomainError {
  readonly typename = 'EmailAlreadyRegisteredError';
  readonly code = 'EMAIL_ALREADY_REGISTERED' as const;

  constructor(readonly email: string) {
    super('Ya existe una cuenta con ese correo.');
  }

  protected override details() {
    return { email: this.email };
  }
}
