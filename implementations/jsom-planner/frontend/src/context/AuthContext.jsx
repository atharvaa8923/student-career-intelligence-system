import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    const token = localStorage.getItem('jsom_token');
    if (!token) { setLoading(false); return; }
    authAPI.me()
      .then(res => setUser(res.data))
      .catch(() => { localStorage.removeItem('jsom_token'); localStorage.removeItem('jsom_user'); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem('jsom_token', res.data.token);
    localStorage.setItem('jsom_refresh_token', res.data.refreshToken);
    localStorage.setItem('jsom_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* Clear the local session even if already expired. */ }
    localStorage.removeItem('jsom_token');
    localStorage.removeItem('jsom_refresh_token');
    localStorage.removeItem('jsom_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
