import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// A rider's phone is never on your dev machine: on a real device API_BASE_URL
// has to be a host that phone can reach (your LAN IP in development).
// localhost only works on a simulator or the `expo start --web` build.
//
// In development the API runs on the same computer Metro serves the app from,
// so without API_BASE_URL the app uses that computer's address (Expo Go knows
// it) — it follows the PC when its Wi-Fi IP changes. Set API_BASE_URL only to
// point at a different server: a teammate's PC, or production.
const devHost = __DEV__ ? Constants.expoConfig?.hostUri?.split(":")[0] : null;
export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || (devHost ? `http://${devHost}:5055` : "http://localhost:5055");

const BASE = `${API_BASE_URL}/api/v1`;

const SESSION_KEY = "commerce.partner.session";

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

// --- requests ------------------------------------------------------------

// Set by AuthContext: the API has ended this session (the rider was
// deactivated, or the refresh token expired), so the app returns to sign-in
// instead of failing every request from then on.
let onSessionEnded = null;
export function setSessionEndedHandler(handler) {
  onSessionEnded = handler;
}

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
          onSessionEnded?.();
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
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // A phone loses signal constantly; say so plainly rather than surfacing
    // "Network request failed".
    // Riders lose signal constantly, mid-delivery. Say so plainly so they
    // know to retry rather than assuming the handover failed.
    throw new ApiError(0, "No connection. Your last action was not saved — try again.");
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

// A camera photo as the raw request body (the API checks the bytes, not the
// name). XHR rather than fetch: fetch cannot report upload progress.
async function uploadImage(path, { uri, type }, onProgress, retry = true) {
  const session = await loadSession();
  const blob = await (await fetch(uri)).blob();

  const result = await new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}${path}`);
    xhr.setRequestHeader("Content-Type", type || "image/jpeg");
    if (session?.accessToken) xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`);
    xhr.timeout = 90000;
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total);
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = xhr.ontimeout = () => resolve({ status: 0 });
    xhr.send(blob);
  });

  if (result.status === 0) throw new ApiError(0, "No connection. The photo was not saved — try again.");
  if (result.status === 401 && retry && session?.refreshToken && (await refreshSession())) {
    return uploadImage(path, { uri, type }, onProgress, false);
  }

  let payload = {};
  try {
    payload = JSON.parse(result.text);
  } catch {
    // not JSON — a proxy error page; the status below says what happened
  }
  if (result.status < 200 || result.status >= 300 || payload.success === false) {
    throw new ApiError(result.status, payload.error?.message || "The photo was not saved — try again.");
  }
  return payload;
}

export const api = {
  get: (path, query) => request("GET", path, { query }),
  post: (path, body) => request("POST", path, { body }),
  patch: (path, body) => request("PATCH", path, { body }),
  del: (path, body) => request("DELETE", path, { body }),
  uploadImage,
};
