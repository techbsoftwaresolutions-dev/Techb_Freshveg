const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const config = require("../../config");

// One interface, several places to put a file. The upload route only ever sees
// `save()` — whether the bytes land on this machine's disk or in Cloudinary is
// an environment choice, and adding S3 later touches this file and nothing
// else.
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
 * Local disk. The default, because a single-store business does not need a CDN
 * on day one, and because `npm run demo` has to work with no accounts at all.
 *
 * Files are served back by app.js from the same directory.
 */
const local = {
  name: "local",
  configured: true,

  get root() {
    return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  },

  async save(buffer, extension, folder) {
    const safeFolder = folderName(folder);
    const directory = path.join(this.root, safeFolder);
    await fs.mkdir(directory, { recursive: true });

    const name = `${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}.${extension}`;
    await fs.writeFile(path.join(directory, name), buffer);

    return {
      provider: "local",
      // Absolute, not "/uploads/...": this URL is stored on the product (or
      // banner, or review) and rendered by the storefront and admin apps, which
      // run on different origins than this API — a relative path would resolve
      // against their origin, not this server's, and 404.
      url: `${config.publicUrl}/uploads/${safeFolder}/${name}`,
      path: `${safeFolder}/${name}`,
      bytes: buffer.length,
    };
  },
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
      error.statusCode = 502;
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

/**
 * Whichever provider is configured, falling back to local disk.
 *
 * Deliberately not an error when Cloudinary is half-configured: the shop
 * keeps working on local disk, and `GET /uploads/config` says which one is
 * actually in use rather than leaving it to be guessed from a URL.
 */
function resolve() {
  if (process.env.STORAGE_PROVIDER === "local") return local;
  return cloudinary.configured ? cloudinary : local;
}

module.exports = { resolve, local, cloudinary, MAX_BYTES, CONTENT_TYPE };
