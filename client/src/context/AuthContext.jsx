import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("smartattend_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() =>
    localStorage.getItem("smartattend_token"),
  );
  const [loading, setLoading] = useState(true);

  // Auto-verify session on mount
  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await api.get("/auth/me");
          setUser(res.user);
          localStorage.setItem("smartattend_user", JSON.stringify(res.user));
        } catch {
          // Token invalid or expired
          logout();
        }
      }
      setLoading(false);
    }

    loadUser();

    const handleAutoLogout = () => {
      logout();
    };
    window.addEventListener("auth:logout", handleAutoLogout);
    return () => window.removeEventListener("auth:logout", handleAutoLogout);
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    if (res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem("smartattend_token", res.token);
      localStorage.setItem("smartattend_user", JSON.stringify(res.user));
    }
    return res;
  };

  const register = async (formData) => {
    const res = await api.post("/auth/register", formData);
    if (res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem("smartattend_token", res.token);
      localStorage.setItem("smartattend_user", JSON.stringify(res.user));
    }
    return res;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("smartattend_token");
    localStorage.removeItem("smartattend_user");
  };

  const updateProfile = async (data) => {
    const res = await api.put("/auth/profile", data);
    if (res.user) {
      setUser(res.user);
      localStorage.setItem("smartattend_user", JSON.stringify(res.user));
    }
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(user && token),
        isStudent: user?.role === "student",
        isTeacher: user?.role === "teacher",
        isAdmin: user?.role === "admin",
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
