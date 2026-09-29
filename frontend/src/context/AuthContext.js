import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=none, obj=admin
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("sm41_token");
    if (!token) {
      setUser(false);
      setReady(true);
      return;
    }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("sm41_token");
        setUser(false);
      })
      .finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("sm41_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("sm41_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const adminLogin = async (email, password) => {
    const { data } = await api.post("/auth/admin/login", { email, password });
    localStorage.setItem("sm41_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const adminRegister = async (payload) => {
    const { data } = await api.post("/auth/admin/register", payload);
    localStorage.setItem("sm41_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const forgotPassword = async (email, origin_url) => {
    const { data } = await api.post("/auth/forgot-password", { email, origin_url });
    return data;
  };

  const resetPassword = async (token, password) => {
    const { data } = await api.post("/auth/reset-password", { token, password });
    return data;
  };

  const logout = () => {
    localStorage.removeItem("sm41_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, adminLogin, adminRegister, forgotPassword, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
