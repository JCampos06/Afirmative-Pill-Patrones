import { z } from 'zod';
import { ValidationError } from '../domain/errors.js';

/** Valida la entrada de un comando; si falla lanza un ValidationError tipado. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw ValidationError.fromZod(result.error);
  return result.data;
}

/** Los IDs GraphQL llegan como string; los medicamentos usan ids numéricos. */
export const medicationIdSchema = z.coerce
  .number({ error: 'El id del medicamento debe ser numérico.' })
  .int()
  .positive('El id del medicamento no es válido.');

export const uuidSchema = (label: string) => z.uuid({ error: `${label} no tiene un formato válido.` });

/** Date (graphql-scalars) llega como objeto Date → se normaliza a YYYY-MM-DD. */
export const isoDateSchema = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD.'),
);

/** Texto opcional: cadenas vacías se tratan como null. */
export const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullish(),
  );
