"use client";

import { loginSchema, registerSchema } from "@kranjang/shared";
import type { LoginBody, RegisterBody } from "@kranjang/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, clearAccessToken, setAccessToken } from "@/lib/api";
import type { AuthSession } from "@/lib/api";

type AuthStatus = "loading" | "ready";

type AuthContextValue = {
  session: AuthSession | null;
  status: AuthStatus;
  login: (input: LoginBody) => Promise<AuthSession>;
  register: (input: RegisterBody) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthSession | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: React.ReactNode;
};

function applyJsonHeaders(body: string) {
  return {
    body,
    headers: {
      "content-type": "application/json",
    },
  } satisfies Pick<RequestInit, "body" | "headers">;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const commitSession = useCallback((nextSession: AuthSession | null) => {
    setSession(nextSession);
    setAccessToken(nextSession?.accessToken ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const nextSession = await api<AuthSession>("/auth/refresh", {
        method: "POST",
      });

      commitSession(nextSession);
      return nextSession;
    } catch {
      commitSession(null);
      return null;
    }
  }, [commitSession]);

  useEffect(() => {
    void (async () => {
      await refresh();
      setStatus("ready");
    })();
  }, [refresh]);

  const login = useCallback(
    async (input: LoginBody) => {
      const payload = loginSchema.parse(input);
      const nextSession = await api<AuthSession>("/auth/login", {
        method: "POST",
        ...applyJsonHeaders(JSON.stringify(payload)),
      });

      commitSession(nextSession);
      return nextSession;
    },
    [commitSession],
  );

  const register = useCallback(
    async (input: RegisterBody) => {
      const payload = registerSchema.parse(input);
      const nextSession = await api<AuthSession>("/auth/register", {
        method: "POST",
        ...applyJsonHeaders(JSON.stringify(payload)),
      });

      commitSession(nextSession);
      return nextSession;
    },
    [commitSession],
  );

  const logout = useCallback(async () => {
    try {
      await api<{ success: true }>("/auth/logout", {
        method: "POST",
      });
    } finally {
      clearAccessToken();
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      login,
      register,
      logout,
      refresh,
    }),
    [login, logout, refresh, register, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider.");
  }

  return value;
}
