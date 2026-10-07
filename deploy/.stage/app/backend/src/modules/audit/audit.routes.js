const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const { paginate, escapeRegex } = require("../../core/query");
const { requireAuth, requireAnyPermission } = require("../../middleware/auth");

const AuditLog = require("./audit.model");
const Banner = require("../marketing/banner.model");
const Category = require("../catalog/category.model");
const Product = require("../catalog/product.model");

const router = express.Router();

// Entities the activity feed can put a real photo next to. Each entry's own
// diff already carries the new value when the change *was* the image
// ("image: old.png -> new.png"); this is only for the entries that changed
// something else on a record that happens to have a photo — showing what the
// thing looks like today beats a generic entity icon.
const THUMB_SOURCES = {
  Banner: { Model: Banner, select: "image", get: (doc) => doc.image },
  Category: { Model: Category, select: "image", get: (doc) => doc.image },
  Product: {
    Model: Product,
    select: "media",
    get: (doc) => doc.media?.find((m) => m.type === "image")?.url,
  },
};

// Attaches a `thumbnail` to each log entry: the image a change referenced
// directly, or failing that the current photo of the record it touched.
async function withThumbnails(items) {
  const plain = items.map((item) => item.toJSON());

  const wanted = {};
  for (const entry of plain) {
    if (entry.changes?.image?.to || !entry.entityId) continue;
    const source = THUMB_SOURCES[entry.entity];
    if (!source) continue;
    (wanted[entry.entity] ||= new Set()).add(String(entry.entityId));
  }

  const found = {};
  await Promise.all(
    Object.entries(wanted).map(async ([entity, ids]) => {
      const { Model, select, get } = THUMB_SOURCES[entity];
      const docs = await Model.find({ _id: { $in: [...ids] } }).select(select).lean();
      found[entity] = Object.fromEntries(docs.map((doc) => [String(doc._id), get(doc) || null]));
    })
  );

  return plain.map((entry) => ({
    ...entry,
    thumbnail: entry.changes?.image?.to || found[entry.entity]?.[entry.entityId] || null,
  }));
}

// Audit logs are read-only by design: there is no endpoint that edits or
// deletes one, because a trail that can be rewritten is not a trail.
//
// Readable by whoever manages staff *or* reads reports. Gating on
// users.manage alone locked out the `admin` role — which deliberately cannot
// manage users, but is exactly who investigates "who changed this price".
router.use(requireAuth, requireAnyPermission("users.manage", "reports.view"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.entityId) filter.entityId = req.query.entityId;
    if (req.query.actor) filter.actor = req.query.actor;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ summary: rx }, { entityLabel: rx }, { actorName: rx }];
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const result = await paginate(AuditLog, filter, req.query, { defaultSort: { createdAt: -1 } });
    const items = await withThumbnails(result.items);
    res.json({ success: true, ...result, items });
  })
);

// The history of one record — "who has touched this product?"
router.get(
  "/:entity/:entityId",
  asyncHandler(async (req, res) => {
    const logs = await AuditLog.find({
      entity: req.params.entity,
      entityId: req.params.entityId,
    })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, logs });
  })
);

module.exports = router;
