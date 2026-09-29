// One place that knows how to talk to the API: base URL, the bearer token,
// refresh-on-401, and turning the envelope the backend sends into either data
// or a thrown ApiError the UI can render.

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

  const response = await fetch(url.pathname + url.search, {
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

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      response.status,
      payload.error?.message || `Request failed (${response.status})`,
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
    const response = await fetch(url.pathname + url.search, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new ApiError(
        response.status,
        payload.error?.message || `Upload failed (${response.status})`,
        payload.error?.details
      );
    }
    return payload;
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

export const api = {
  get: (path, query) => call("GET", path, { query }),
  post: (path, body) => call("POST", path, { body }),
  patch: (path, body) => call("PATCH", path, { body }),
  delete: (path, body) => call("DELETE", path, { body }),
  upload: uploadImage,
};
