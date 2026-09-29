import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, loadSession, saveSession } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await loadSession();
      if (!session?.accessToken) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        // Revalidate rather than trusting the stored copy — wallet balance and
        // loyalty points change server-side between launches.
        const { user: fresh } = await api.get("/auth/me");
        if (!cancelled) setUser(fresh);
      } catch {
        await saveSession(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const requestOtp = useCallback(async (phone) => {
    const data = await api.post("/auth/otp/request", { phone });
    // devCode is only present outside production; the login screen shows it so
    // the app is testable without an SMS provider wired up.
    return data;
  }, []);

  const verifyOtp = useCallback(async (phone, code, name) => {
    const data = await api.post("/auth/otp/verify", { phone, code, name });
    await saveSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    setUser(data.user);
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await saveSession(null);
    setUser(null);
  }, []);

  // Called after anything that changes wallet, points or addresses.
  const refreshUser = useCallback(async () => {
    try {
      const { user: fresh } = await api.get("/auth/me");
      setUser(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ user, ready, signedIn: Boolean(user), requestOtp, verifyOtp, signOut, refreshUser, setUser }),
    [user, ready, requestOtp, verifyOtp, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
