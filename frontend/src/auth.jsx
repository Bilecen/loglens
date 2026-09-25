import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, refreshStore, setUnauthorizedHandler } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    const rt = refreshStore.get();
    if (rt) api.logout(rt).catch(() => {});  // sunucuda iptal et (best-effort)
    tokenStore.clear();
    refreshStore.clear();
    setUser(null);
  }, []);

  // 401 gelince otomatik çıkış
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Açılışta token varsa kullanıcıyı doğrula
  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return; }
    api.me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { token, refresh_token, user } = await api.login({ email, password });
    tokenStore.set(token);
    if (refresh_token) refreshStore.set(refresh_token);
    setUser(user);
  };

  const register = async (body) => {
    const { token, refresh_token, user } = await api.register(body);
    tokenStore.set(token);
    if (refresh_token) refreshStore.set(refresh_token);
    setUser(user);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, updateUser: setUser, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
