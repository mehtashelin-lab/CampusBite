import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../api/client.js";

const STORAGE_KEY = "campusbite_auth";
const AuthContext = createContext(null);

function readSavedAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readSavedAuth);

  async function login(credentials) {
    const result = await api.login(credentials);
    const nextAuth = { access_token: result.access_token, user: result.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAuth));
    setAuth(nextAuth);
    return result.user;
  }

  async function register(details) {
    return api.register(details);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  const value = useMemo(
    () => ({ user: auth?.user || null, isAuthenticated: Boolean(auth?.access_token), login, register, logout }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
