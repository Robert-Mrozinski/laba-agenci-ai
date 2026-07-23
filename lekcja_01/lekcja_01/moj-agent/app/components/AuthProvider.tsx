'use client';

import type { Session } from '@supabase/supabase-js';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
};

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  session: null,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      setSession(currentSession);
      setIsLoading(false);
    }

    void loadSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, currentSession) => {
        setSession(currentSession);
        setIsLoading(false);
      }) ?? { data: { subscription: null } };

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!session && !isLoginPage) {
      const query = searchParams.toString();
      const redirectTo = query ? `${pathname}?${query}` : pathname;
      router.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
      return;
    }

    if (session && isLoginPage) {
      router.replace(searchParams.get('redirectTo') || '/');
    }
  }, [isLoading, isLoginPage, pathname, router, searchParams, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
    }),
    [isLoading, session],
  );

  if (!isLoginPage && (isLoading || !session)) {
    return (
      <AuthContext.Provider value={value}>
        <main className="auth-shell">
          <section className="auth-card">
            <h1>Costa Broker</h1>
            <p>Sprawdzam logowanie...</p>
          </section>
        </main>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
