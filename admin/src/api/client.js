// One place that knows how to talk to the API: base URL, the bearer token,
// refresh-on-401, and turning the envelope the backend sends into either data
// or a thrown ApiError the UI can render.

import { toast } from "../components/toast";

const BASE = (import.meta.env.VITE_API_BASE_URL || "") + "/api/v1";

const STORAGE_KEY = "commerce.admin.session";

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveSession(session) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    // Per-field messages from a 422, so a form can show them inline.
    this.details = details || null;
  }
}

let refreshing = null;
// The access token already re-checked after a 403 (see call()).
let permChecked = null;

async function refreshSession() {
  const session = loadSession();
  if (!session?.refreshToken) return null;

  // Collapse concurrent 401s into one refresh — otherwise a page that fires
  // four requests on mount would fire four refreshes and race.
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

  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  // The whole URL, not just its path: in production the API lives on another
  // host (VITE_API_BASE_URL), and a bare path would be sent to the admin's own
  // static site instead.
  const response = await fetch(url.href, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  // An expired access token is retried once behind a refresh; a second 401
  // means the session is genuinely gone.
  if (response.status === 401 && retry && session?.refreshToken) {
    const renewed = await refreshSession();
    if (renewed) return call(method, path, { body, query, retry: false });
  }

  // A 403 may only mean the token is stale: permissions are baked into the
  // access token when it is issued (it lives for days), so a role that gained
  // a permission since — or a new feature's permission — is refused until the
  // next refresh. Renew once per token and retry; a 403 after that is real.
  if (response.status === 403 && retry && session?.refreshToken && permChecked !== session.accessToken) {
    permChecked = session.accessToken;
    const renewed = await refreshSession();
    if (renewed) {
      permChecked = renewed.accessToken;
      window.dispatchEvent(new CustomEvent("app:session-refreshed", { detail: renewed }));
      return call(method, path, { body, query, retry: false });
    }
  }

  const payload = await readPayload(response, "Request failed");

  // Every successful change confirms itself with a toast. The server's own
  // message wins; a page's more specific notice replaces this one (see Toaster).
  // Sign-in, background notification traffic and the POS import preview stay quiet.
  const quiet = path.startsWith("/auth") || path.startsWith("/notifications") || body?.dryRun === true;
  if (method !== "GET" && !quiet) {
    toast(payload.message || (method === "DELETE" ? "Deleted successfully" : method === "PATCH" ? "Saved successfully" : "Done"), "ok", true);
  }
  return payload;
}

// Every API reply is a JSON envelope. Anything else — an HTML page from a
// misrouted request, a proxy's error page — is a failure, never data: treating
// it as success is how a wrong password could look like a sign-in.
async function readPayload(response, failure) {
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!payload) {
    throw new ApiError(
      response.ok ? 502 : response.status,
      response.ok ? "The server sent an unexpected reply. Please try again." : `${failure} (${response.status})`
    );
  }
  if (!response.ok || payload.success === false) {
    throw new ApiError(
      response.status,
      payload.error?.message || `${failure} (${response.status})`,
      payload.error?.details
    );
  }
  return payload;
}

// Image uploads bypass call() — the body is the raw file, not JSON — but
// share its session/refresh handling so an expired token does not surface as
// a confusing upload failure.
async function uploadImage(file, folder = "products") {
  const url = new URL(`${BASE}/uploads`, window.location.origin);
  if (folder) url.searchParams.set("folder", folder);

  const attempt = async (token) => {
    const response = await fetch(url.href, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    return readPayload(response, "Upload failed");
  };

  const session = loadSession();
  try {
    return await attempt(session?.accessToken);
  } catch (err) {
    if (err.status === 401 && session?.refreshToken) {
      const renewed = await refreshSession();
      if (renewed) return attempt(renewed.accessToken);
    }
    throw err;
  }
}

// Renews the session now (used at start-up when the token's permissions are
// out of date) and tells the app about the new session.
export async function renewSession() {
  const renewed = await refreshSession();
  if (renewed) window.dispatchEvent(new CustomEvent("app:session-refreshed", { detail: renewed }));
  return renewed;
}

// The permissions baked into an access token (it is a JWT; only read, not trusted).
export function tokenPermissions(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part)).perms || [];
  } catch {
    return null;
  }
}

export const api = {
  get: (path, query) => call("GET", path, { query }),
  post: (path, body) => call("POST", path, { body }),
  patch: (path, body) => call("PATCH", path, { body }),
  delete: (path, body) => call("DELETE", path, { body }),
  upload: uploadImage,
};
