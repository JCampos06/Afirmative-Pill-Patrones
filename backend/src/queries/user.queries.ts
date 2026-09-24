import { db } from '../infra/db.js';
import type { AuthUser } from '../auth/jwt.js';

export async function getUserById(id: string): Promise<AuthUser | null> {
  const row = await db.one<{ id: string; email: string; full_name: string; document_number: string; role: AuthUser['role'] }>(
    'select id, email, full_name, document_number, role from users where id = $1',
    [id],
  );
  return row
    ? { id: row.id, email: row.email, fullName: row.full_name, documentNumber: row.document_number, role: row.role }
    : null;
}
