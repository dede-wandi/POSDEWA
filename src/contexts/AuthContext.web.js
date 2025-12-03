import React, { createContext, useEffect, useMemo, useState } from 'react';
console.log('[web] Using AuthContext.web');
import { loginByPin as loginApi, logout as logoutApi, getMyAccount } from '../api/auth';
import { getItemAsync, setItemAsync, deleteItemAsync } from '../utils/storage';

export const AuthContext = createContext({
  token: null,
  user: null,
  login: async () => {},
  logout: async () => {},
  refreshAccount: async () => {},
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await getItemAsync('authToken');
        if (storedToken) {
          setToken(storedToken);
          await refreshAccountInternal(storedToken);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshAccountInternal = async (activeToken) => {
    try {
      const data = await getMyAccount();
      setUser(data);
    } catch (e) {
      // handle silently for now
    }
  };

  const login = async ({ phone, pin }) => {
    const data = await loginApi({ phone, pin });
    const receivedToken = data?.token || data?.accessToken || data?.bearer || data?.data?.token;
    if (!receivedToken) throw new Error('Token tidak ditemukan di response');
    await setItemAsync('authToken', receivedToken);
    setToken(receivedToken);
    await refreshAccountInternal(receivedToken);
    return data;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch {}
    await deleteItemAsync('authToken');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, login, logout, refreshAccount: refreshAccountInternal }), [token, user]);

  if (loading) return null; // or a splash loader

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}