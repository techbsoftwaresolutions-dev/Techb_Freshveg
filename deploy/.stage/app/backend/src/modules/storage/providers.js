const crypto = require("crypto");

// Every uploaded image goes to Cloudinary and nowhere else. There is no
// local-disk fallback on purpose: a disk URL carries this machine's address
// (localhost, a LAN IP that changes with the network), so it breaks the moment
// the API moves — and order lines snapshot the URL, so it stays broken.
//
// Keys come from the environment, never from the settings document: a settings
// row ends up in backups, logs and admin screens.

const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);

// Homepage hero videos (Admin → Settings → Website → Video Hero). Cloudinary's
// own ceiling for a single (non-chunked) upload is 100 MB.
const MAX_VIDEO_BYTES = Number(process.env.MAX_VIDEO_UPLOAD_BYTES || 100 * 1024 * 1024);
const VIDEO_FORMATS = ["mp4", "webm"];

const CONTENT_TYPE = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Cloudinary, against their REST upload API rather than the SDK — the same
 * choice the payment gateways make, so the request shape is visible here
 * instead of behind a wrapper, and the dependency list stays short.
 *
 * Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to
 * turn it on. CLOUDINARY_FOLDER is the root every upload goes under, so the
 * account can hold more than one project.
 */
const cloudinary = {
  name: "cloudinary",

  get cloudName() {
    return process.env.CLOUDINARY_CLOUD_NAME || "";
  },
  get apiKey() {
    return process.env.CLOUDINARY_API_KEY || "";
  },
  get apiSecret() {
    return process.env.CLOUDINARY_API_SECRET || "";
  },
  get rootFolder() {
    return process.env.CLOUDINARY_FOLDER || "";
  },
  get configured() {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  },

  /**
   * Cloudinary signs the parameters you send, not the file: sort them by name,
   * join as k=v&k=v, append the secret, SHA-1 the lot. Any parameter left out
   * of the signature but sent anyway is rejected, so this list and the form
   * below have to agree.
   */
  sign(params) {
    const canonical = Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== "")
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    return crypto.createHash("sha1").update(canonical + this.apiSecret).digest("hex");
  },

  /** Every hero video sits under one folder, which is also the library. */
  get videoFolder() {
    return [this.rootFolder, "hero-videos"].filter(Boolean).join("/");
  },

  /** Site-wide images (logo, favicon) must come from this account. */
  ownsImage(url) {
    return typeof url === "string" && url.startsWith(`https://res.cloudinary.com/${this.cloudName}/image/upload/`);
  },

  /** Only videos from this account may be put on the homepage. */
  ownsVideo(url) {
    return typeof url === "string" && url.startsWith(`https://res.cloudinary.com/${this.cloudName}/video/upload/`);
  },

  /**
   * Videos go from the admin's browser straight to Cloudinary — a 60 MB file
   * should not be buffered through this API. The server only signs the
   * parameters, so the secret never leaves it, and allowed_formats is inside
   * the signature: a browser cannot swap in another file type.
   */
  signVideoUpload() {
    const params = {
      allowed_formats: VIDEO_FORMATS.join(","),
      folder: this.videoFolder,
      timestamp: String(Math.floor(Date.now() / 1000)),
      unique_filename: "true",
      use_filename: "true",
    };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`,
      apiKey: this.apiKey,
      params,
      signature: this.sign(params),
    };
  },

  /** The video library: what is already uploaded, newest first. */
  async listVideos() {
    // ponytail: first 100 only — follow next_cursor if the library outgrows it.
    const url =
      `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/video/upload` +
      `?max_results=100&prefix=${encodeURIComponent(`${this.videoFolder}/`)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64")}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Cloudinary could not list the videos: ${payload?.error?.message || `HTTP ${response.status}`}`);
      error.status = 502;
      throw error;
    }
    return (payload.resources || [])
      .map((r) => ({
        url: r.secure_url,
        publicId: r.public_id,
        name: r.display_name || r.public_id.split("/").pop(),
        bytes: r.bytes,
        width: r.width,
        height: r.height,
        duration: r.duration,
        createdAt: r.created_at,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  async save(buffer, extension, folder) {
    const timestamp = Math.floor(Date.now() / 1000);
    const target = [this.rootFolder, folderName(folder)].filter(Boolean).join("/");

    const signed = { folder: target, timestamp };
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: CONTENT_TYPE[extension] || "image/jpeg" }));
    form.append("api_key", this.apiKey);
    form.append("timestamp", String(timestamp));
    form.append("folder", target);
    form.append("signature", this.sign(signed));

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      { method: "POST", body: form }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Cloudinary's own message is far more useful than "upload failed" —
      // it names the wrong signature, the bad folder, the exceeded quota.
      const reason = payload?.error?.message || `HTTP ${response.status}`;
      const error = new Error(`Cloudinary rejected the upload: ${reason}`);
      error.status = 502;
      throw error;
    }

    return {
      provider: "cloudinary",
      url: payload.secure_url,
      path: payload.public_id,
      bytes: payload.bytes ?? buffer.length,
      width: payload.width,
      height: payload.height,
    };
  },
};

/** Folder names reach a URL and a filesystem path, so they are kept boring. */
function folderName(folder) {
  return String(folder || "misc").replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "misc";
}

const REQUIRED = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];

/** Names of the Cloudinary variables that are not set — empty when ready. */
const missingConfig = () => REQUIRED.filter((key) => !process.env[key]);

/**
 * The storage provider. Throws (503) rather than falling back when Cloudinary
 * is not fully configured, naming the missing variables — a silent fallback is
 * exactly how images ended up on local disk unnoticed.
 */
function resolve() {
  const missing = missingConfig();
  if (missing.length) {
    const error = new Error(`Image storage is not configured — set ${missing.join(", ")} in the API's .env`);
    error.status = 503;
    throw error;
  }
  return cloudinary;
}

module.exports = { resolve, missingConfig, cloudinary, MAX_BYTES, CONTENT_TYPE, MAX_VIDEO_BYTES, VIDEO_FORMATS };
