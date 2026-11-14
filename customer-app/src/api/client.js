import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Where the API is.
//
// In development the phone loads this app from Expo running on your computer,
// so Expo already knows the computer's current address (hostUri, e.g.
// "192.168.1.36:8081"). The API runs on that same computer, so we use that
// address with the API port — it stays right when the router hands the
// computer a new IP, with nothing to edit in .env.
//
// API_BASE_URL in .env still wins when it points somewhere real (a hosted
// server); a LAN/localhost value there is treated as "this computer" and
// replaced by the live address. Release builds use API_BASE_URL as is.
const configured = (Constants.expoConfig?.extra?.apiBaseUrl || "").replace(/\/+$/, "");

function devMachineHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    "";
  const host = hostUri.split(":")[0];
  // An IP or localhost — not a tunnel host (expo start --tunnel), which can't reach the API.
  return /^(localhost|\d{1,3}(\.\d{1,3}){3})$/.test(host) ? host : null;
}

const isLocal = (url) =>
  !url || /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);

function resolveApiBase() {
  const host = __DEV__ ? devMachineHost() : null;
  if (host && isLocal(configured)) {
    const port = configured.match(/:(\d+)$/)?.[1] || "5055";
    return `http://${host}:${port}`;
  }
  return configured || "http://localhost:5055";
}

export const API_BASE_URL = resolveApiBase();
if (__DEV__) console.log(`[api] ${API_BASE_URL}`);

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

// Where the shopper is (pincode + named area) — the server prices delivery per area.
async function deliveryHeaders() {
  try {
    const [area, pincode] = await Promise.all([
      AsyncStorage.getItem("commerce.area"),
      AsyncStorage.getItem("commerce.pincode"),
    ]);
    return {
      ...(area ? { "X-Delivery-Area": encodeURIComponent(area) } : {}),
      ...(pincode ? { "X-Delivery-Pincode": pincode } : {}),
    };
  } catch {
    return {};
  }
}

async function request(method, path, { body, query, retry = true } = {}) {
  const session = await loadSession();
  const guest = await guestId();
  const where = await deliveryHeaders();

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
        ...where,
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
