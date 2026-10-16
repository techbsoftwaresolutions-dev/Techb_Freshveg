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

  const announce = method !== "GET" && !path.startsWith("/auth/");
  try {
    const payload = await readPayload(response, "Request failed");
    if (announce) toast("success", payload.message || SUCCESS[method] || "Done");
    return payload;
  } catch (err) {
    if (announce) toast("error", err.message);
    throw err;
  }
}

// What a successful write says when the API sends no message of its own.
const SUCCESS = {
  POST: "Saved successfully",
  PATCH: "Changes saved",
  PUT: "Changes saved",
  DELETE: "Deleted successfully",
};

// Pops a toast (components/Toaster.jsx). Usable from anywhere in the admin:
// toast("success", "Order updated") / toast("error", "Could not save").
export function toast(type, text) {
  window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type, text } }));
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
// `query` carries extra checks, e.g. { kind: "customerAppIcon" } for a brand image.
async function uploadImage(file, folder = "products", query = {}) {
  const url = new URL(`${BASE}/uploads`, window.location.origin);
  if (folder) url.searchParams.set("folder", folder);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

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

// Hero videos go from the browser straight to Cloudinary under a signature
// the API issues — a large file is never buffered through our server, and XHR
// (not fetch) is what reports upload progress. Resolves with the library entry.
async function uploadVideo(file, onProgress) {
  const signed = await call("GET", "/uploads/video-signature");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!signed.formats.includes(extension)) {
    throw new ApiError(400, `Use an ${signed.formats.map((f) => f.toUpperCase()).join(" or ")} video`);
  }
  if (file.size > signed.maxBytes) {
    throw new ApiError(400, `That video is over ${Math.round(signed.maxBytes / 1024 / 1024)} MB — compress it and try again`);
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("signature", signed.signature);
  for (const [key, value] of Object.entries(signed.params)) form.append(key, value);

  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", signed.uploadUrl);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total);
    xhr.onload = () => {
      let payload = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // falls through to the error below
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.secure_url) resolve(payload);
      else reject(new ApiError(xhr.status || 502, `Upload failed: ${payload?.error?.message || `HTTP ${xhr.status}`}`));
    };
    xhr.onerror = () => reject(new ApiError(0, "Upload failed — check the connection and try again"));
    xhr.send(form);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    name: result.display_name || result.original_filename || result.public_id.split("/").pop(),
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    duration: result.duration,
    createdAt: result.created_at,
  };
}

export const api = {
  get: (path, query) => call("GET", path, { query }),
  post: (path, body) => call("POST", path, { body }),
  patch: (path, body) => call("PATCH", path, { body }),
  delete: (path, body) => call("DELETE", path, { body }),
  upload: uploadImage,
  uploadVideo,
};
