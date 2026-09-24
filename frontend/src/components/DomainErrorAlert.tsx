import { Link } from 'react-router';
import { Alert } from './ui';

/** Forma común de los miembros de error de las uniones de resultado. */
export interface DomainErrorLike {
  __typename: string;
  code?: string;
  message?: string;
  fieldErrors?: { field: string; message: string }[];
  shortages?: { requested: number; available: number; medication: { id: string; name: string } }[];
  medications?: { id: string; name: string }[];
}

const TITLES: Record<string, string> = {
  ValidationError: 'Revisa los datos',
  NotFoundError: 'No encontrado',
  InsufficientStockError: 'Stock insuficiente',
  PrescriptionRequiredError: 'Fórmula médica requerida',
  InvalidStateTransitionError: 'Operación no permitida',
  EmptyCartError: 'Carrito vacío',
  InvalidCredentialsError: 'No pudimos iniciar sesión',
  EmailAlreadyRegisteredError: 'Correo ya registrado',
};

/** Pinta un error de dominio devuelto por una mutation (no una excepción). */
export function DomainErrorAlert({ error }: { error: DomainErrorLike | null | undefined }) {
  if (!error || !error.code) return null;
  return (
    <Alert tone={error.__typename === 'PrescriptionRequiredError' ? 'warning' : 'error'} title={TITLES[error.__typename] ?? 'Error'}>
      <p>{error.message}</p>
      {error.fieldErrors && error.fieldErrors.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {error.fieldErrors.map((f) => (
            <li key={f.field + f.message}>{f.message}</li>
          ))}
        </ul>
      )}
      {error.shortages && error.shortages.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {error.shortages.map((s) => (
            <li key={s.medication.id}>
              <Link className="font-semibold underline" to={`/medicamentos/${s.medication.id}`}>
                {s.medication.name}
              </Link>
              : pediste {s.requested}, hay {s.available} disponibles.
            </li>
          ))}
        </ul>
      )}
      {error.medications && error.medications.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {error.medications.map((m) => (
            <li key={m.id}>{m.name}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

/** Mensaje de error para un campo concreto del formulario. */
export function fieldError(error: DomainErrorLike | null | undefined, field: string): string | undefined {
  return error?.fieldErrors?.find((f) => f.field === field)?.message;
}
