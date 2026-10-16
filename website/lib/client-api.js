"use client";

// Browser-side data access. Everything goes to /api on this origin, which
// next.config rewrites to the backend — so there is no CORS handshake and the
// API host never appears in the shipped HTML.

const BASE = "/api/v1";
const SESSION_KEY = "commerce.web.session";
const GUEST_KEY = "commerce.web.guestId";

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || null;
  }
}

export function loadSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveSession(session) {
  if (typeof window === "undefined") return;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Private browsing can refuse storage; the session still works for this tab.
  }
}

// Keeps an anonymous shopper's cart across visits, and lets it be merged into
// their account when they sign in.
export function guestId() {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return `w_ephemeral_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// A friend's referral code from a shared link (?ref=CODE). Kept until the
// visitor signs in — through the login page, OTP and any detour — and then
// sent with the sign-in, where the API decides whether it applies.
const REF_KEY = "commerce.web.ref";
const REF_TTL = 30 * 24 * 60 * 60 * 1000;

export function captureReferral(search) {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(search || window.location.search).get("ref");
  if (!code || !/^[A-Za-z0-9]{4,16}$/.test(code)) return;
  try {
    localStorage.setItem(REF_KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
  } catch {
    // Storage refused — the code can still be typed on Refer & Earn.
  }
}

export function pendingReferral() {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(localStorage.getItem(REF_KEY) || "null");
    if (saved?.code && Date.now() - saved.at < REF_TTL) return saved.code;
  } catch {
    // ignore
  }
  return null;
}

export function clearReferral() {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    // ignore
  }
}

let refreshing = null;

async function refreshSession() {
  const session = loadSession();
  if (!session?.refreshToken) return null;

  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.accessToken) {
          saveSession(null);
          return null;
        }
        const next = { ...session, ...data };
        saveSession(next);
        return next;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }

  return refreshing;
}

async function call(method, path, { body, query, retry = true } = {}) {
  const session = loadSession();

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }

  const response = await fetch(`${BASE}${path}${search.toString() ? `?${search}` : ""}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": guestId(),
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && retry && session?.refreshToken) {
    const renewed = await refreshSession();
    if (renewed) return call(method, path, { body, query, retry: false });
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      response.status,
      payload.error?.message || "Something went wrong",
      payload.error?.details
    );
  }

  return payload;
}

export const api = {
  get: (path, query) => call("GET", path, { query }),
  post: (path, body) => call("POST", path, { body }),
  patch: (path, body) => call("PATCH", path, { body }),
  del: (path, body) => call("DELETE", path, { body }),
};
