const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, paging, escapeRegex } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Inventory = require("./inventory.model");
const StockMovement = require("./stockMovement.model");
const Variant = require("../catalog/variant.model");
const Product = require("../catalog/product.model");
const Store = require("../stores/store.model");
const inventoryService = require("./inventory.service");

const router = express.Router();
router.use(requireAuth);

const canView = requirePermission("inventory.view");
const canAdjust = requirePermission("inventory.adjust");

const actorOf = (req) => ({ id: req.user.id, name: req.user.name, role: req.user.role });
const searchOf = (query) => {
  const q = String(query.q || "").trim();
  return q ? new RegExp(escapeRegex(q), "i") : null;
};

// ?category= narrows any inventory view to the variants anywhere under that
// category (categoryPath carries every ancestor, so a department tab covers
// all its aisles). null when there is no category filter.
// ponytail: ids pulled into memory; fine for a grocery catalogue, swap for a
// $lookup on categoryPath if one department ever holds tens of thousands.
async function variantsIn(query) {
  if (!query.category) return null;
  if (!mongoose.isValidObjectId(query.category)) throw ApiError.badRequest("Unknown category");
  return Variant.find({ categoryPath: query.category }).distinct("_id");
}

router.get(
  "/",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.store) filter.store = req.query.store;
    if (req.query.product) filter.product = req.query.product;
    if (req.query.category) filter.category = req.query.category;

    const result = await paginate(Inventory, filter, req.query, {
      defaultSort: { updatedAt: -1 },
      populate: [
        { path: "variant", select: "sku name sellingPrice packSize lowStockThreshold" },
        { path: "product", select: "name slug media unit" },
      ],
    });
    res.json({ success: true, ...result });
  })
);

// Low stock is "available at or below the threshold", so stock already promised
// to open orders counts as gone — which is what a reorder decision needs.
router.get(
  "/low-stock",
  canView,
  asyncHandler(async (req, res) => {
    const filter = req.query.store ? { store: req.query.store } : {};
    const ids = await variantsIn(req.query);
    if (ids) filter.variant = { $in: ids };
    const rows = await Inventory.find(filter)
      .populate("variant", "sku name sellingPrice lowStockThreshold")
      .populate("product", "name slug media")
      .limit(500);

    const search = searchOf(req.query);
    const low = rows.filter(
      (r) => r.isLow && (!search || [r.product?.name, r.variant?.name, r.variant?.sku].some((s) => search.test(s || "")))
    );
    res.json({ success: true, items: low, meta: { total: low.length } });
  })
);

// One row per (store, variant), starting from the variants rather than the
// stock rows, so a pack the store has never stocked shows as 0 instead of not
// at all, and a product's variants are never summed together. ?q= matches the
// product name, variant name ("500 ML") or SKU. Without ?store= it covers
// every active store.
//
// outOnly is the Out of stock report — exactly what the storefront means: a
// pack on sale (active variant of an active product) of which not one whole
// unit can be bought, counting never-stocked packs and products marked sold
// out. Otherwise it is the full stock list: every pack on sale, plus any
// hidden or draft one that still has a stock row.
async function variantStock(query, { outOnly = false } = {}) {
  const { page, limit, skip } = paging(query);
  const stores = await Store.find(query.store ? { _id: query.store } : { status: "active" }).select("name");
  const search = searchOf(query);
  const ids = await variantsIn(query);
  const onSale = { status: "active", "product.status": "active" };

  const [result] = await Variant.aggregate([
    ...(ids ? [{ $match: { _id: { $in: ids } } }] : []),
    ...(outOnly ? [{ $match: { status: "active" } }] : []),
    {
      $lookup: {
        from: Product.collection.name,
        localField: "product",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, slug: 1, media: 1, unit: 1, status: 1, soldOut: 1 } }],
        as: "product",
      },
    },
    { $unwind: "$product" },
    ...(outOnly ? [{ $match: { "product.status": "active" } }] : []),
    ...(search ? [{ $match: { $or: [{ "product.name": search }, { name: search }, { sku: search }] } }] : []),
    { $set: { store: stores.map((s) => s._id) } },
    { $unwind: "$store" },
    {
      $lookup: {
        from: Inventory.collection.name,
        let: { v: "$_id", s: "$store" },
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$variant", "$$v"] }, { $eq: ["$store", "$$s"] }] } } }],
        as: "row",
      },
    },
    { $set: { row: { $first: "$row" } } },
    ...(outOnly ? [] : [{ $match: { $or: [{ row: { $ne: null } }, onSale] } }]),
    { $set: { onHand: { $ifNull: ["$row.onHand", 0] }, reserved: { $ifNull: ["$row.reserved", 0] } } },
    {
      $set: {
        available: {
          $cond: ["$product.soldOut", 0, { $max: [0, { $subtract: ["$onHand", "$reserved"] }] }],
        },
      },
    },
    ...(outOnly ? [{ $match: { available: { $lt: 1 } } }] : []),
    { $sort: { "product.name": 1, name: 1, _id: 1 } },
    { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: "n" }] } },
  ]);

  const storeName = new Map(stores.map((s) => [String(s._id), s.name]));
  const items = result.items.map((v) => ({
    id: v.row ? String(v.row._id) : `${v.store}:${v._id}`,
    store: { id: String(v.store), name: storeName.get(String(v.store)) },
    variant: { id: String(v._id), sku: v.sku, name: v.name, sellingPrice: v.sellingPrice, packSize: v.packSize },
    product: { id: String(v.product._id), name: v.product.name, slug: v.product.slug, media: v.product.media, unit: v.product.unit },
    onHand: v.onHand,
    reserved: v.reserved,
    available: v.available,
    // Same rule as the Inventory model's isLow virtual.
    isLow: v.available <= (v.row?.lowStockThreshold ?? 5),
    neverStocked: !v.row,
    soldOut: Boolean(v.product.soldOut),
  }));
  const total = result.total[0]?.n || 0;
  return {
    success: true,
    items,
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), hasNext: skip + items.length < total },
  };
}

router.get("/variants", canView, asyncHandler(async (req, res) => res.json(await variantStock(req.query))));

router.get(
  "/out-of-stock",
  canView,
  asyncHandler(async (req, res) => res.json(await variantStock(req.query, { outOnly: true })))
);

router.get(
  "/expiring",
  canView,
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days) || 3;
    const filter = { "batches.expiresOn": { $lte: new Date(Date.now() + days * 86400000) } };
    if (req.query.store) filter.store = req.query.store;
    const ids = await variantsIn(req.query);
    if (ids) filter.variant = { $in: ids };

    const rows = await Inventory.find(filter)
      .populate("variant", "sku name sellingPrice")
      .populate("product", "name slug media");

    const items = rows
      .map((row) => ({
        id: row.id,
        store: row.store,
        product: row.product,
        variant: row.variant,
        batches: row.nearExpiry(days),
      }))
      .filter((r) => r.batches.length);

    res.json({ success: true, items, meta: { total: items.length, days } });
  })
);

router.get(
  "/movements",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    for (const key of ["store", "variant", "product", "type"]) {
      if (req.query[key]) filter[key] = req.query[key];
    }
    const ids = await variantsIn(req.query);
    // In $and so it narrows, rather than replaces, a ?variant= filter.
    if (ids) filter.$and = [{ variant: { $in: ids } }];
    const result = await paginate(StockMovement, filter, req.query, { defaultSort: { createdAt: -1 } });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/receive",
  canAdjust,
  asyncHandler(async (req, res) => {
    const { store, variant, quantity } = req.body;
    if (!store || !variant || !quantity) throw ApiError.badRequest("store, variant and quantity are required");

    const row = await inventoryService.receive(store, variant, Number(quantity), {
      ...req.body,
      actor: actorOf(req),
      reason: req.body.reason || "Goods received",
    });
    res.json({ success: true, inventory: row });
  })
);

router.post(
  "/adjust",
  canAdjust,
  asyncHandler(async (req, res) => {
    const { store, variant, quantity } = req.body;
    if (quantity === undefined) throw ApiError.badRequest("quantity (the counted total) is required");

    const row = await inventoryService.adjust(store, variant, Number(quantity), {
      actor: actorOf(req),
      reason: req.body.reason || "Manual adjustment",
      note: req.body.note,
    });
    res.json({ success: true, inventory: row });
  })
);

router.post(
  "/damage",
  canAdjust,
  asyncHandler(async (req, res) => {
    const row = await inventoryService.writeOffDamage(
      req.body.store,
      req.body.variant,
      Number(req.body.quantity),
      { actor: actorOf(req), reason: req.body.reason || "Damaged / spoiled" }
    );
    res.json({ success: true, inventory: row });
  })
);

router.post(
  "/transfer",
  canAdjust,
  asyncHandler(async (req, res) => {
    const { fromStore, toStore, variant, quantity } = req.body;
    const result = await inventoryService.transfer(fromStore, toStore, variant, Number(quantity), {
      actor: actorOf(req),
      reason: req.body.reason || "Stock transfer",
    });
    res.json({ success: true, ...result });
  })
);

module.exports = router;
