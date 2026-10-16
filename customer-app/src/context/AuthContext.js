import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";
import { api, captureReferral, clearReferral, loadSession, pendingReferral, saveSession } from "../api/client";

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

  // A referral link can open the app (or the web build) at any point; the
  // code waits for the next sign-in.
  useEffect(() => {
    Linking.getInitialURL().then(captureReferral).catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => captureReferral(url));
    return () => subscription.remove();
  }, []);

  const requestOtp = useCallback(async (phone) => {
    const data = await api.post("/auth/otp/request", { phone });
    // devCode is only present outside production; the login screen shows it so
    // the app is testable without an SMS provider wired up.
    return data;
  }, []);

  // `referralCode` is one typed at sign-in; otherwise a link's code is used.
  const verifyOtp = useCallback(async (phone, code, name, referralCode = "") => {
    const fromLink = await pendingReferral();
    const ref = referralCode.trim() || fromLink || "";
    const data = await api.post("/auth/otp/verify", {
      phone, code, name,
      ...(ref ? { referralCode: ref, referralSource: referralCode.trim() ? "signup" : "link" } : {}),
    });
    await saveSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    setUser(data.user);
    if (ref) {
      // An existing account that has not ordered yet can still be referred.
      if (!data.isNewUser) {
        data.referral = await api
          .post("/referrals/claim", { code: ref, source: referralCode.trim() ? "manual" : "link" })
          .then((r) => ({ applied: true, message: r.message }))
          .catch((err) => ({ applied: false, message: err.message }));
      }
      await clearReferral();
    }
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
