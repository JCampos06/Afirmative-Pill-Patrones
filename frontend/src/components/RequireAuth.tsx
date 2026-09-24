import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../gql/graphql';
import { LockIcon } from './icons';
import { EmptyState, PageLoader } from './ui';

export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Verificando sesión…" />;
  if (!user) return <Navigate to={`/ingresar?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (role && user.role !== role) {
    return (
      <EmptyState icon={<LockIcon className="h-7 w-7" />} title="Acceso restringido">
        Esta sección es exclusiva para {role === 'PHARMACIST' ? 'químicos farmacéuticos' : 'pacientes'}.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
