const ApiError = require("../../core/ApiError");

// The brand images managed in Admin → Settings → Branding, and what each one
// must be. One list, read by the upload route (which checks the bytes before
// they reach Cloudinary) and by the settings route (which only accepts URLs
// from this store's Cloudinary account).
//
// Runtime assets are read from /settings/public by the website, both apps and
// the admin, so a change shows without a release. Build-time assets are baked
// into the native apps by `npm run brand:sync` in each app before a build; an
// installed app keeps its launcher icon and splash screen until it is updated.
// Each app has its own launcher icon (`app` names which one reads it); the
// splash artwork is shared by both.
const ASSETS = {
  logo: { label: "Primary logo", formats: ["png", "webp", "jpg"], minWidth: 200, minHeight: 60 },
  symbol: { label: "Symbol", formats: ["png", "webp", "jpg"], minWidth: 96, minHeight: 96, square: "near" },
  favicon: { label: "Favicon", formats: ["png", "webp", "jpg"], minWidth: 48, minHeight: 48, square: "near" },
  shareImage: { label: "Social share image", formats: ["png", "webp", "jpg"], minWidth: 600, minHeight: 315 },
  customerAppIcon: {
    label: "Customer app icon", formats: ["png", "webp", "jpg"], minWidth: 1024, minHeight: 1024, maxWidth: 4096, maxHeight: 4096,
    square: "exact", buildTime: true, app: "customer",
  },
  deliveryAppIcon: {
    label: "Delivery app icon", formats: ["png", "webp", "jpg"], minWidth: 1024, minHeight: 1024, maxWidth: 4096, maxHeight: 4096,
    square: "exact", buildTime: true, app: "delivery",
  },
  splash: { label: "Splash artwork", formats: ["png", "webp"], minWidth: 512, minHeight: 512, buildTime: true },
};

const KEYS = Object.keys(ASSETS);

// Width and height read from the file's own header, so a wrong-sized image is
// turned away before it is stored rather than after.
function imageSize(buffer, ext) {
  try {
    if (ext === "png") return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    if (ext === "gif") return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    if (ext === "webp") {
      const chunk = buffer.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
      return null;
    }
    if (ext === "jpg") {
      // Walk the segments to the frame header (SOF0–SOF15, bar DHT/JPG/DAC).
      let i = 2;
      while (i + 9 < buffer.length) {
        if (buffer[i] !== 0xff) return null;
        const marker = buffer[i + 1];
        if (marker === 0xff) { i += 1; continue; }
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5) };
        }
        i += 2 + buffer.readUInt16BE(i + 2);
      }
    }
  } catch {
    // A truncated header falls through to "unreadable".
  }
  return null;
}

// Throws a 400 naming what is wrong with an upload for `kind`.
function checkUpload(kind, buffer, ext) {
  const rule = ASSETS[kind];
  if (!rule) throw ApiError.badRequest(`Unknown branding asset. Try one of: ${KEYS.join(", ")}`);
  if (!rule.formats.includes(ext)) {
    throw ApiError.badRequest(`The ${rule.label.toLowerCase()} must be ${rule.formats.map((f) => f.toUpperCase()).join(", ")}`);
  }
  const size = imageSize(buffer, ext);
  if (!size || !size.width || !size.height) throw ApiError.badRequest("Couldn't read the image's dimensions");
  const { width, height } = size;
  if (width < rule.minWidth || height < rule.minHeight) {
    throw ApiError.badRequest(
      `The ${rule.label.toLowerCase()} must be at least ${rule.minWidth}×${rule.minHeight}px (this one is ${width}×${height})`
    );
  }
  if ((rule.maxWidth && width > rule.maxWidth) || (rule.maxHeight && height > rule.maxHeight)) {
    throw ApiError.badRequest(
      `The ${rule.label.toLowerCase()} can be at most ${rule.maxWidth}×${rule.maxHeight}px (this one is ${width}×${height})`
    );
  }
  if (rule.square === "exact" && width !== height) {
    throw ApiError.badRequest(`The ${rule.label.toLowerCase()} must be square (this one is ${width}×${height})`);
  }
  if (rule.square === "near" && Math.max(width, height) / Math.min(width, height) > 1.25) {
    throw ApiError.badRequest(`The ${rule.label.toLowerCase()} should be square or close to it (this one is ${width}×${height})`);
  }
  return size;
}

// What the public endpoint returns. `company.logo` was the original logo
// field; a value there still counts until a branding logo is uploaded, so
// nothing set before this change is lost.
function publicBranding(settings) {
  const saved = settings.branding?.toObject?.() ?? settings.branding ?? {};
  const out = {};
  for (const key of KEYS) out[key] = saved[key] || "";
  out.logo = out.logo || settings.company?.logo || "";
  return out;
}

// Before the apps had an icon each, one `branding.appIcon` served both (and
// the website's install icon). It becomes both new icons, so builds look the
// same as before until an admin changes one; then the old field is removed.
// Runs on every boot and does nothing once done. Raw collection access: the
// schema no longer knows the old field.
async function migrateLegacyAppIcon(db) {
  const settings = db.collection("settings");
  const doc = await settings.findOne({ key: "global", "branding.appIcon": { $exists: true } });
  if (!doc) return false;
  const legacy = doc.branding.appIcon || "";
  const set = {};
  if (legacy && !doc.branding.customerAppIcon) set["branding.customerAppIcon"] = legacy;
  if (legacy && !doc.branding.deliveryAppIcon) set["branding.deliveryAppIcon"] = legacy;
  await settings.updateOne(
    { _id: doc._id },
    { ...(Object.keys(set).length ? { $set: set } : {}), $unset: { "branding.appIcon": "" } }
  );
  return true;
}

module.exports = { ASSETS, KEYS, imageSize, checkUpload, publicBranding, migrateLegacyAppIcon };
