const path = require("path");
const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { requireAuth, requireAnyPermission } = require("../../middleware/auth");
const storage = require("./providers");

const router = express.Router();

// Image uploads for products, banners, review photos and proof of delivery.
//
// Where the bytes end up is decided in providers.js — local disk when nothing
// is configured, Cloudinary when its keys are set. Everything in this file is
// about whether to accept the file at all, which is the same either way.

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const PUBLIC_PREFIX = "/uploads";
const MAX_BYTES = storage.MAX_BYTES;

// Allow-list, not a block-list: the set of things a grocery catalogue needs is
// small and known, and anything else is either a mistake or an attack.
const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// The bytes decide the type, not the filename or the client's Content-Type —
// both are trivially forged.
const SIGNATURES = [
  { ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: "webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
];

function sniff(buffer) {
  for (const signature of SIGNATURES) {
    const offset = signature.offset || 0;
    const matches = signature.bytes.every((byte, index) => buffer[offset + index] === byte);
    if (matches) {
      // WEBP also needs "WEBP" at byte 8; RIFF alone is not enough.
      if (signature.ext === "webp" && buffer.slice(8, 12).toString() !== "WEBP") continue;
      return signature.ext;
    }
  }
  return null;
}

router.use(requireAuth);

// Which provider is live, so the admin can see where an upload will land
// instead of inferring it from the shape of the URL that comes back.
router.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const provider = storage.resolve();
    res.json({
      success: true,
      provider: provider.name,
      maxBytes: MAX_BYTES,
      accepts: Object.keys(ALLOWED),
      // Named so a half-configured account is obvious rather than silently
      // falling back to disk and looking like it worked.
      cloudinaryConfigured: storage.cloudinary.configured,
      folder: process.env.CLOUDINARY_FOLDER || null,
    });
  })
);

router.post(
  "/",
  // Staff upload catalogue images; customers upload review photos and proof.
  requireAnyPermission("catalog.manage", "marketing.manage", "delivery.fulfil", "customers.manage"),
  express.raw({ type: Object.keys(ALLOWED), limit: MAX_BYTES }),
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw ApiError.badRequest("Send the image as the raw request body with its Content-Type set");
    }

    const declared = ALLOWED[req.headers["content-type"]?.split(";")[0]];
    if (!declared) throw ApiError.badRequest("Only JPEG, PNG, WebP and GIF images are accepted");

    const actual = sniff(req.body);
    if (!actual) throw ApiError.badRequest("That file is not a valid image");
    // The declared Content-Type comes from the browser's File.type, which it
    // derives from the file's extension, not its bytes — a genuine PNG saved
    // as photo.jpg reports "image/jpeg" even though the content is real and
    // safe. The sniffed bytes are the trustworthy signal, so they decide what
    // gets stored; `declared` above only has to be one of the allowed image
    // types to get this far, which is what stops non-image uploads.

    const result = await storage.resolve().save(req.body, actual, req.query.folder);
    res.status(201).json({ success: true, ...result });
  })
);

module.exports = router;

// Exported so app.js can serve the directory statically without repeating the
// path in two places.
module.exports.UPLOAD_DIR = UPLOAD_DIR;
module.exports.PUBLIC_PREFIX = PUBLIC_PREFIX;
