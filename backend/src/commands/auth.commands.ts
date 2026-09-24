import { z } from 'zod';
import { signToken, type AuthUser } from '../auth/jwt.js';
import { db } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from '../domain/errors.js';
import type { Role } from '../domain/order.js';
import { parseInput } from './validation.js';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  document_number: string;
  role: Role;
}

export interface AuthResultData {
  token: string;
  user: AuthUser;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    documentNumber: row.document_number,
    role: row.role,
  };
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .regex(/\d/, 'La contraseña debe incluir al menos un número.'),
  fullName: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres.').max(120),
  documentNumber: z
    .string()
    .trim()
    .regex(/^\d{5,15}$/, 'El documento debe tener entre 5 y 15 dígitos.'),
});

/** La contraseña se compara con bcrypt dentro de PostgreSQL (pgcrypto). */
export async function login(input: unknown): Promise<AuthResultData> {
  const { email, password } = parseInput(loginSchema, input);
  const row = await db.one<UserRow>(
    `select id, email, full_name, document_number, role
       from users
      where email = $1 and password_hash = extensions.crypt($2, password_hash)`,
    [email, password],
  );
  if (!row) throw new InvalidCredentialsError();
  const user = toAuthUser(row);
  logger.command(`Login → ${user.email} (${user.role})`);
  return { token: signToken(user), user };
}

export async function register(input: unknown): Promise<AuthResultData> {
  const data = parseInput(registerSchema, input);
  const row = await db.one<UserRow>(
    `insert into users (email, full_name, document_number, password_hash, role)
     values ($1, $2, $3, extensions.crypt($4, extensions.gen_salt('bf', 10)), 'PATIENT')
     on conflict (email) do nothing
     returning id, email, full_name, document_number, role`,
    [data.email, data.fullName, data.documentNumber, data.password],
  );
  if (!row) throw new EmailAlreadyRegisteredError(data.email);
  const user = toAuthUser(row);
  logger.command(`RegisterPatient → ${user.email}`);
  return { token: signToken(user), user };
}
