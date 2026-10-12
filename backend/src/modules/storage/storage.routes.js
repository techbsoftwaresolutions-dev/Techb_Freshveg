const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { requireAuth, requireAnyPermission, requirePermission } = require("../../middleware/auth");
const storage = require("./providers");

const router = express.Router();

// Image uploads for products, banners, review photos and proof of delivery.
//
// The bytes always go to Cloudinary (see providers.js); this file decides
// whether to accept the file at all. Nothing is written to or served from this
// server's disk.

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

// Whether uploads will work, and if not, which variables are missing — so a
// half-configured account is visible before someone tries to upload.
router.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const missing = storage.missingConfig();
    res.json({
      success: true,
      provider: "cloudinary",
      configured: missing.length === 0,
      missing,
      maxBytes: MAX_BYTES,
      accepts: Object.keys(ALLOWED),
      folder: process.env.CLOUDINARY_FOLDER || null,
    });
  })
);

// Hero videos (Admin → Settings → Website). The browser uploads straight to
// Cloudinary with this signature; the library lists what is already there, so
// a video is picked again rather than uploaded twice.
router.get(
  "/video-signature",
  requirePermission("settings.manage"),
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      ...storage.resolve().signVideoUpload(),
      maxBytes: storage.MAX_VIDEO_BYTES,
      formats: storage.VIDEO_FORMATS,
    });
  })
);

router.get(
  "/videos",
  requirePermission("settings.manage"),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, videos: await storage.resolve().listVideos() });
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
