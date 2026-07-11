'use client';

import { fetchApi } from '@/lib/fetch-api';
import { normalizeFrontendRole } from '@/lib/roles';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Rôle côté frontend (aligné avec l’enum Prisma, en snake_case). */
export type FrontendRole =
  | 'admin'
  | 'manager'
  | 'directrice_commerciale'
  | 'pdg'
  | 'directrice_operation'
  | 'agent';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: FrontendRole;
  mfaEnabled?: boolean;
  company?: { id: string; name: string; plan?: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
  hasRole: (roles: FrontendRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_CHANGED_EVENT = 'auth:changed';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetchApi('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      const role = normalizeFrontendRole(data.role);
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        role,
        mfaEnabled: data.mfaEnabled ?? false,
        company: data.company,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const handleAuthChanged = () => {
      setLoading(true);
      void fetchUser();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
      }
    };
  }, [fetchUser]);

  const hasRole = useCallback(
    (roles: FrontendRole[]) => (user ? roles.includes(user.role) : false),
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, refetch: fetchUser, hasRole }),
    [user, loading, fetchUser, hasRole]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return ctx;
}
