'use client';

import SplashScreen, {
  ONBOARDING_STORAGE_KEY,
} from '@/components/SplashScreen';
import { hideBootSplash } from '@/lib/boot-splash';
import { fetchApi } from '@/lib/fetch-api';
import { normalizeFrontendRole } from '@/lib/roles';
import { usePathname, useRouter } from 'next/navigation';
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

function readOnboardingDone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markOnboardingDone(): void {
  try {
    sessionStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const skipOnboardingPath =
    pathname.startsWith('/legal') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/login/mfa');

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
    setOnboardingDone(readOnboardingDone());
    setSessionReady(true);
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

  const shouldShowOnboarding =
    sessionReady &&
    !loading &&
    !user &&
    !onboardingDone &&
    !skipOnboardingPath;

  useEffect(() => {
    if (!sessionReady || loading) return;
    if (user || onboardingDone || skipOnboardingPath || shouldShowOnboarding) {
      hideBootSplash();
    }
  }, [
    sessionReady,
    loading,
    user,
    onboardingDone,
    skipOnboardingPath,
    shouldShowOnboarding,
  ]);

  const handleContinue = useCallback(() => {
    markOnboardingDone();
    setOnboardingDone(true);
    hideBootSplash();
    if (pathname !== '/login') {
      router.push('/login');
    }
  }, [pathname, router]);

  const hasRole = useCallback(
    (roles: FrontendRole[]) => (user ? roles.includes(user.role) : false),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, refetch: fetchUser, hasRole }),
    [user, loading, fetchUser, hasRole],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {shouldShowOnboarding ? (
        <SplashScreen onContinue={handleContinue} />
      ) : null}
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
