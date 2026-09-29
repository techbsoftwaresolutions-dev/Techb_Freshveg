import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// On a simulator or `expo start --web`, localhost reaches your machine. On a
// physical phone running Expo Go it does not — set API_BASE_URL in .env to
// your computer's LAN IP (e.g. http://192.168.1.20:5055).
export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || "http://localhost:5055";

const BASE = `${API_BASE_URL}/api/v1`;

const SESSION_KEY = "commerce.session";
const GUEST_KEY = "commerce.guestId";

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || null;
  }
}

// --- session -------------------------------------------------------------

let cachedSession = null;

export async function loadSession() {
  if (cachedSession) return cachedSession;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    cachedSession = raw ? JSON.parse(raw) : null;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
}

export async function saveSession(session) {
  cachedSession = session;
  try {
    if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can fail on a wiped device; the in-memory copy still works for
    // this run.
  }
}

// A stable id so an anonymous shopper keeps their cart between launches, and
// so it can be merged into their account when they sign in.
export async function guestId() {
  try {
    let id = await AsyncStorage.getItem(GUEST_KEY);
    if (!id) {
      id = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return `g_ephemeral_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// --- requests ------------------------------------------------------------

let refreshing = null;

async function refreshSession() {
  const session = await loadSession();
  if (!session?.refreshToken) return null;

  // Collapse concurrent 401s into one refresh — a screen that fires three
  // requests on mount should not fire three refreshes.
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        if (!data?.accessToken) {
          await saveSession(null);
          return null;
        }
        const next = { ...session, ...data };
        await saveSession(next);
        return next;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }

  return refreshing;
}

async function request(method, path, { body, query, retry = true } = {}) {
  const session = await loadSession();
  const guest = await guestId();

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const url = `${BASE}${path}${search.toString() ? `?${search}` : ""}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        // The guest id travels on every request so the cart endpoints can
        // find an anonymous cart without the caller passing it each time.
        "X-Session-Id": guest,
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // A phone loses signal constantly; say so plainly rather than surfacing
    // "Network request failed".
    throw new ApiError(0, "Can't reach the store. Check your connection and try again.");
  }

  if (response.status === 401 && retry && session?.refreshToken) {
    const renewed = await refreshSession();
    if (renewed) return request(method, path, { body, query, retry: false });
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
  get: (path, query) => request("GET", path, { query }),
  post: (path, body) => request("POST", path, { body }),
  patch: (path, body) => request("PATCH", path, { body }),
  del: (path, body) => request("DELETE", path, { body }),
};
