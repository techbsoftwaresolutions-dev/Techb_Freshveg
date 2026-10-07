const crypto = require("crypto");

// Every uploaded image goes to Cloudinary and nowhere else. There is no
// local-disk fallback on purpose: a disk URL carries this machine's address
// (localhost, a LAN IP that changes with the network), so it breaks the moment
// the API moves — and order lines snapshot the URL, so it stays broken.
//
// Keys come from the environment, never from the settings document: a settings
// row ends up in backups, logs and admin screens.

const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);

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

module.exports = { resolve, missingConfig, cloudinary, MAX_BYTES, CONTENT_TYPE };
