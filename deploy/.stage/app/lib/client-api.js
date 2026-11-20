"use client";

// Browser-side data access. Everything goes to /api on this origin, which
// next.config rewrites to the backend — so there is no CORS handshake and the
// API host never appears in the shipped HTML.

// Optional, for development: NEXT_PUBLIC_API_PORT=5055 sends browser calls
// straight to the API on the same host (localhost, or the LAN address the
// site was opened on) instead of through the Next dev server's rewrite, which
// adds ~50-100ms to every call. Unset — as in production — keeps the
// same-origin /api route.
const DIRECT_PORT = process.env.NEXT_PUBLIC_API_PORT;
const BASE =
  DIRECT_PORT && typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:${DIRECT_PORT}/api/v1`
    : "/api/v1";
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
  clearCache(); // signing in or out must never show the previous shopper's answers
  hooks.onSession?.();
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

// Where the shopper is (pincode + named area) — the server prices delivery per area.
function deliveryHeaders() {
  try {
    const area = localStorage.getItem("commerce.web.area");
    const pincode = localStorage.getItem("commerce.web.pincode");
    return {
      ...(area ? { "X-Delivery-Area": encodeURIComponent(area) } : {}),
      ...(pincode ? { "X-Delivery-Pincode": pincode } : {}),
    };
  } catch {
    return {};
  }
}

// A GET that failed because the network blinked (not because the server said no) is retried
// twice. Writes are never retried: they might have landed. When it still fails, the shopper
// gets a plain sentence instead of the browser's "Failed to fetch".
async function fetchRetrying(method, href, init) {
  const waits = method === "GET" ? [300, 900] : [];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(href, init);
    } catch {
      if (attempt >= waits.length) {
        throw new ApiError(0, "Can't reach the server. Please check your connection and try again.");
      }
      await new Promise((r) => setTimeout(r, waits[attempt]));
    }
  }
}

async function send(method, path, { body, query, retry = true } = {}) {
  const session = loadSession();

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }

  const response = await fetchRetrying(method, `${BASE}${path}${search.toString() ? `?${search}` : ""}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": guestId(),
      ...deliveryHeaders(),
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && retry && session?.refreshToken) {
    const renewed = await refreshSession();
    if (renewed) return send(method, path, { body, query, retry: false });
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      response.status,
      payload.error?.message || "Something went wrong",
      payload.error?.details
    );
  }

  // Anything may have changed (cart, orders, addresses...): forget every remembered answer.
  if (method !== "GET") { clearCache(); hooks.onWrite?.(); }

  return payload;
}

// ---- Reading: remembered answers, one request per question ----
//
// - A GET answered in the last FRESH_MS is served from memory: no request at all.
// - The same GET asked while it is already on its way shares that one request.
// - Any successful write forgets everything, so a page that reloads after "add to cart" or
//   "save address" always sees the new data.
// - Answers are remembered per shopper (sign-in, guest id, delivery area), never shared.
// - peek() hands back a remembered answer (up to STALE_MS old) so a screen can paint at once
//   and let useApi refresh it in the background.
const FRESH_MS = 10000;
const STALE_MS = 5 * 60000;
const cache = new Map(); // key -> { at, payload }
const inflight = new Map(); // key -> Promise
const LIVE = ["/auth", "/payments"]; // never remembered

function keyOf(path, query) {
  const session = loadSession();
  const q = Object.entries(query || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const who = `${session?.accessToken || ""}|${guestId()}|${JSON.stringify(deliveryHeaders())}`;
  return `${who}|${path}?${q}`;
}
const copy = (payload) => (typeof structuredClone === "function" ? structuredClone(payload) : payload);

// TanStack Query registers here (see query-client.js): after any successful write its cached
// queries are marked stale and refetched; when the shopper signs in or out, they are all dropped.
export const hooks = { onWrite: null, onSession: null };

function clearCache() {
  cache.clear();
  inflight.clear();
}

function call(method, path, opts = {}) {
  if (method !== "GET" || LIVE.some((p) => path.startsWith(p))) return send(method, path, opts);

  const key = keyOf(path, opts.query);
  if (!opts.force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < FRESH_MS) return Promise.resolve(copy(hit.payload));
    if (inflight.has(key)) return inflight.get(key).then(copy);
  }
  const request = send(method, path, opts)
    .then((payload) => {
      cache.set(key, { at: Date.now(), payload });
      return payload;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });
  inflight.set(key, request);
  return request.then(copy);
}

function peek(path, query) {
  const hit = cache.get(keyOf(path, query));
  return hit && Date.now() - hit.at < STALE_MS ? copy(hit.payload) : undefined;
}

// Sends one image as the raw request body (what the upload routes expect).
async function uploadImage(path, blob, retry = true) {
  const session = loadSession();
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "image/jpeg",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    body: blob,
  });
  if (response.status === 401 && retry && session?.refreshToken) {
    const renewed = await refreshSession();
    if (renewed) return uploadImage(path, blob, false);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new ApiError(response.status, payload.error?.message || "Upload failed", payload.error?.details);
  }
  return payload;
}

export const api = {
  upload: uploadImage,
  peek,
  clearCache,
  get: (path, query, opts) => call("GET", path, { query, ...opts }),
  post: (path, body) => call("POST", path, { body }),
  patch: (path, body) => call("PATCH", path, { body }),
  del: (path, body) => call("DELETE", path, { body }),
};
