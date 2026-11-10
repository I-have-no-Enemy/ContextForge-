import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from '../services/api';
import type { UserProfile } from '../services/api';

interface Session {
  user: UserProfile | null;
  /** false until the first /auth/me answer, so pages do not flash "sign in". */
  ready: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  /** Opens the sign-in dialog from anywhere (e.g. a guarded page). */
  requestSignIn: () => void;
  signInRequested: boolean;
  closeSignIn: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [signInRequested, setSignInRequested] = useState(false);

  useEffect(() => {
    // The session lives in an HttpOnly cookie; ask the API who we are.
    api
      .fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    api.setUnauthorizedHandler(() => setUser(null));
    return () => api.setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      await api.register(email, password);
      return login(email, password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo<Session>(
    () => ({
      user,
      ready,
      login,
      register,
      logout,
      signInRequested,
      requestSignIn: () => setSignInRequested(true),
      closeSignIn: () => setSignInRequested(false),
    }),
    [user, ready, login, register, logout, signInRequested]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** Owner or admin may edit an item. */
export const canManage = (user: UserProfile | null, submittedBy?: string) =>
  !!user && (user.role === 'admin' || user.user_id === submittedBy);
