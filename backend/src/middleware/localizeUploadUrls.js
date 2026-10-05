// Every uploaded image (category tile, product photo, banner, offer art) is
// saved under this server's own PUBLIC_URL at the moment it's uploaded (see
// modules/storage/providers.js) — and that value changes every time this
// machine's network does: office WiFi, mobile hotspot, a different hotel
// WiFi next week. A URL frozen with yesterday's host breaks the moment the
// network changes, for every app and every viewer, forever — that's exactly
// what made every image on the storefront site show broken.
//
// The fix doesn't touch what's stored. Instead, every outgoing JSON response
// is rewritten here, on the way out, so any "/uploads/..." URL always uses
// the HOST THE CLIENT JUST USED TO REACH THIS API — the one host guaranteed
// to work for that client right now, no matter what was recorded at upload
// time. A Cloudinary URL (a different domain, no "/uploads/" segment) is
// left untouched.
const MARKER = "/uploads/";

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function localize(value, origin) {
  if (typeof value === "string") {
    const idx = value.indexOf(MARKER);
    return idx === -1 ? value : `${origin}${value.slice(idx)}`;
  }
  if (Array.isArray(value)) return value.map((item) => localize(item, origin));
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) out[key] = localize(value[key], origin);
    return out;
  }
  // Dates, ObjectIds, Buffers, Mongoose documents and anything else with its
  // own shape are left exactly as they are — only genuine plain
  // objects/arrays (what this codebase's routes actually hand to res.json)
  // are worth walking, and guessing at anything else risks corrupting it.
  return value;
}

module.exports = function localizeUploadUrls(req, res, next) {
  const origin = `${req.protocol}://${req.get("host")}`;
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(localize(body, origin));
  next();
};
