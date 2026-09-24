import { useApolloClient, useQuery, useReactiveVar } from '@apollo/client/react';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { restartSubscriptions, setSessionExpiredHandler } from '../apollo/client';
import { authTokenVar, clearPendingOrders, setAuthToken } from '../apollo/state';
import type { MeQuery as MeQueryResult } from '../gql/graphql';
import { MeQuery } from '../graphql/operations';

type CurrentUser = NonNullable<MeQueryResult['me']>;

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const token = useReactiveVar(authTokenVar);
  const { data, loading } = useQuery(MeQuery, { skip: !token, fetchPolicy: 'cache-first' });

  const signIn = useCallback(
    async (newToken: string) => {
      setAuthToken(newToken);
      restartSubscriptions();
      // Vuelve a ejecutar las queries activas ya autenticado.
      await client.resetStore();
    },
    [client],
  );

  const signOut = useCallback(async () => {
    setAuthToken(null);
    clearPendingOrders();
    restartSubscriptions();
    await client.resetStore();
  }, [client]);

  useEffect(() => {
    setSessionExpiredHandler(() => void signOut());
  }, [signOut]);

  // Token vencido o inválido: el backend responde me = null.
  useEffect(() => {
    if (token && data && data.me === null) void signOut();
  }, [token, data, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: token ? (data?.me ?? null) : null,
      isAuthenticated: Boolean(token && data?.me),
      loading: Boolean(token) && loading && !data,
      signIn,
      signOut,
    }),
    [token, data, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
