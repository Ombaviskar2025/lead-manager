import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    setUser(null); // sign out in the UI immediately, even if the network call fails
    try { await api.logout(); } catch { /* cookie expires on its own */ }
  }, []);

  // A 401 on any data request means the session ended: just drop back to the login page.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  // Restore the session on first load (the browser sends the cookie if there is one)
  useEffect(() => {
    let cancelled = false;
    api.session()
      .then(({ user: u }) => { if (!cancelled) setUser(u); })
      .catch(() => { /* not signed in, or server unreachable: show the login page */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const authenticate = useCallback(async (fn, payload) => {
    const { user: u } = await fn(payload);
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
