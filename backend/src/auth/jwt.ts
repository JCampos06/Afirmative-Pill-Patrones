import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../domain/order.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  documentNumber: string;
  role: Role;
}

interface TokenClaims {
  sub: string;
  email: string;
  name: string;
  doc: string;
  role: Role;
}

export function signToken(user: AuthUser): string {
  const claims: TokenClaims = {
    sub: user.id,
    email: user.email,
    name: user.fullName,
    doc: user.documentNumber,
    role: user.role,
  };
  return jwt.sign(claims, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/** Devuelve el usuario del token o null si falta, expiró o es inválido. */
export function verifyToken(token: string | null | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const claims = jwt.verify(token, env.jwtSecret) as TokenClaims;
    return {
      id: claims.sub,
      email: claims.email,
      fullName: claims.name,
      documentNumber: claims.doc,
      role: claims.role,
    };
  } catch {
    return null;
  }
}

/** Extrae el token de "Bearer <token>" (o del valor crudo). */
export function extractToken(header: unknown): string | null {
  if (typeof header !== 'string' || header.trim() === '') return null;
  return header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
}
