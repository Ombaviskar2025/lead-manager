import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Restore the session on first load
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    api.me()
      .then(({ user: u }) => { if (!cancelled) setUser(u); })
      .catch((err) => { if (!cancelled && !err.network) logout(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [logout]);

  const authenticate = useCallback(async (fn, payload) => {
    const { user: u, token } = await fn(payload);
    tokenStore.set(token);
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: (payload) => authenticate(api.login, payload),
      signup: (payload) => authenticate(api.signup, payload),
      logout,
    }),
    [user, loading, authenticate, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
