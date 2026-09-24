import { GraphQLError } from 'graphql';
import { extractToken, verifyToken, type AuthUser } from '../auth/jwt.js';
import { createLoaders, type Loaders } from '../dataloaders/index.js';
import type { RequestStats } from '../infra/db.js';
import type { Role } from '../domain/order.js';

export interface GraphQLContext {
  user: AuthUser | null;
  /** DataLoaders nuevos por request → caché aislada por usuario/petición. */
  loaders: Loaders;
  stats: RequestStats;
}

export function buildContext(authorization: unknown, stats?: RequestStats): GraphQLContext {
  return {
    user: verifyToken(extractToken(authorization)),
    loaders: createLoaders(),
    stats: stats ?? { queries: 0, loaderBatches: 0 },
  };
}

export function requireUser(ctx: GraphQLContext): AuthUser {
  if (!ctx.user) {
    throw new GraphQLError('Debes iniciar sesión para realizar esta operación.', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.user;
}

export function requireRole(ctx: GraphQLContext, role: Role): AuthUser {
  const user = requireUser(ctx);
  if (user.role !== role) {
    throw new GraphQLError('No tienes permisos para realizar esta operación.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}
