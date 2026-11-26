const AuditLog = require("./audit.model");

// Fields nobody wants in an audit trail — noise, or actively dangerous to keep.
const IGNORED = new Set([
  "updatedAt",
  "createdAt",
  "__v",
  "_id",
  "id",
  "passwordHash",
  "codeHash",
  "otp",
  "refreshToken",
  "accessToken",
]);

function normalise(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === "object") {
    if (value._bsontype || value.toHexString) return String(value);
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

const same = (a, b) => JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));

// Shallow diff of two documents, one level into plain objects. Deep-diffing a
// whole product would produce an unreadable log; one level is where the
// interesting changes live (price, status, a settings sub-block).
function diff(before = {}, after = {}) {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of keys) {
    if (IGNORED.has(key)) continue;
    const from = before?.[key];
    const to = after?.[key];
    if (same(from, to)) continue;

    const bothPlainObjects =
      from && to && typeof from === "object" && typeof to === "object" &&
      !Array.isArray(from) && !Array.isArray(to) && !from._bsontype && !to._bsontype;

    if (bothPlainObjects) {
      const nested = diff(from, to);
      for (const [nestedKey, value] of Object.entries(nested)) {
        changes[`${key}.${nestedKey}`] = value;
      }
      continue;
    }

    changes[key] = { from: normalise(from), to: normalise(to) };
  }

  return changes;
}

function describe(action, entity, label, changes) {
  const fields = Object.keys(changes);
  if (action === "create") return `Created ${entity}${label ? ` “${label}”` : ""}`;
  if (action === "delete") return `Deleted ${entity}${label ? ` “${label}”` : ""}`;
  if (!fields.length) return `Updated ${entity}${label ? ` “${label}”` : ""}`;

  const shown = fields.slice(0, 3).map((field) => {
    const { from, to } = changes[field];
    return `${field}: ${from ?? "—"} → ${to ?? "—"}`;
  });
  const more = fields.length > 3 ? ` (+${fields.length - 3} more)` : "";
  return `${label ? `${label}: ` : ""}${shown.join(", ")}${more}`;
}

/**
 * Records an admin action. Never throws: an audit write failing must not fail
 * the operation the user actually asked for — a missing log line is bad, a
 * failed price update because of a missing log line is worse.
 */
async function record({ req, action, entity, entityId, label, before, after, summary }) {
  try {
    const changes = action === "update" ? diff(before, after) : {};
    // Nothing actually changed — do not write a line saying so.
    if (action === "update" && Object.keys(changes).length === 0) return null;

    return await AuditLog.create({
      actor: req?.user?.id,
      actorName: req?.user?.name || "",
      actorRole: req?.user?.role || "",
      action,
      entity,
      entityId,
      entityLabel: label || "",
      changes,
      summary: summary || describe(action, entity, label, changes),
      ip: req?.ip || req?.headers?.["x-forwarded-for"] || "",
      userAgent: req?.headers?.["user-agent"] || "",
      method: req?.method || "",
      path: req?.originalUrl || "",
    });
  } catch (err) {
    console.warn("[audit] could not record:", err.message);
    return null;
  }
}

// Plain-object snapshot for diffing, taken before a mutation.
const snapshot = (doc) => (doc?.toObject ? doc.toObject() : doc ? { ...doc } : null);

module.exports = { record, diff, snapshot };
