import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, loadSession, saveSession, setSessionEndedHandler } from "../api/client";

const AuthContext = createContext(null);

// Every request from this app carries role "delivery_partner". The API refuses
// to create an account for that role, so a rider who is not on the roster gets
// told so instead of silently becoming a customer.
const ROLE = "delivery_partner";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSessionEndedHandler(() => setUser(null));
    return () => setSessionEndedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await loadSession();
      if (!session?.accessToken) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const { user: fresh } = await api.get("/auth/me");
        await saveSession({ ...(await loadSession()), user: fresh });
        if (!cancelled) setUser(fresh);
      } catch (err) {
        // No signal at start-up is not a sign-out: carry on as the rider who
        // was signed in, and let the screens retry. Anything the API answered
        // (a 401 after a failed refresh, a 403) ends the session.
        if (err.status === 0 && session.user) {
          if (!cancelled) setUser(session.user);
        } else {
          await saveSession(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const requestOtp = useCallback((phone) => api.post("/auth/otp/request", { phone, role: ROLE }), []);

  const verifyOtp = useCallback(async (phone, code) => {
    const data = await api.post("/auth/otp/verify", { phone, code, role: ROLE });
    await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    setUser(data.user);
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await saveSession(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signedIn: Boolean(user), requestOtp, verifyOtp, signOut }),
    [user, ready, requestOtp, verifyOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
