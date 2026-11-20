import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, loadSession, renewSession, saveSession, tokenPermissions } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  const [loading, setLoading] = useState(Boolean(loadSession()));

  // Revalidate a stored session on boot: the token may have been revoked, or
  // the user's permissions changed since it was minted.
  useEffect(() => {
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    api
      .get("/auth/me")
      .then(({ user }) => {
        if (cancelled) return;
        setSession((current) => {
          const next = { ...current, user };
          saveSession(next);
          return next;
        });
        // The server checks the permissions inside the token, which were fixed
        // when it was issued. If the account has gained any since, renew it now
        // instead of letting those screens fail with "Missing permission".
        const inToken = tokenPermissions(loadSession()?.accessToken || "");
        if (inToken && (user.permissions || []).some((p) => !inToken.includes(p))) renewSession();
      })
      .catch(() => {
        if (!cancelled) signOut();
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // Runs once on mount; a sign-in sets the session directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(phone, password) {
    const data = await api.post("/auth/staff/login", { phone, password });
    // No token, no session — whatever the reply claimed.
    if (!data?.accessToken || !data?.user) throw new Error("Sign-in failed. Please try again.");
    const next = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    };
    saveSession(next);
    setSession(next);
    return next;
  }

  // Keep React's copy in step when the API client renews the session itself.
  useEffect(() => {
    const onRenewed = (e) => setSession(e.detail);
    window.addEventListener("app:session-refreshed", onRenewed);
    return () => window.removeEventListener("app:session-refreshed", onRenewed);
  }, []);

  function signOut() {
    saveSession(null);
    setSession(null);
  }

  const value = useMemo(() => {
    const permissions = new Set(session?.user?.permissions || []);
    return {
      session,
      user: session?.user || null,
      loading,
      signIn,
      signOut,
      // Every screen gates on a permission rather than on a role, so a custom
      // role built in the admin works without a frontend change.
      can: (permission) => permissions.has(permission),
      canAny: (...list) => list.some((p) => permissions.has(p)),
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
