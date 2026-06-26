import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppUser, Role } from '@/types';
import { getDb } from '@/lib/db';

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  isMock: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signInDemo: (role: Role) => Promise<AppUser>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = getDb();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    db.getSession()
      .then((u) => alive && setUser(u))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [db]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const u = await db.signIn(email, password);
      setUser(u);
      return u;
    },
    [db],
  );

  const signInDemo = useCallback(
    async (role: Role) => {
      if (!db.signInDemo) throw new Error('Connexion de démo indisponible avec Supabase.');
      const u = await db.signInDemo(role);
      setUser(u);
      return u;
    },
    [db],
  );

  const signOut = useCallback(async () => {
    await db.signOut();
    setUser(null);
  }, [db]);

  return (
    <Ctx.Provider value={{ user, loading, isMock: db.isMock, signIn, signInDemo, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return c;
}
