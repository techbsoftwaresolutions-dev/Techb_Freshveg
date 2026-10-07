const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Inventory = require("./inventory.model");
const StockMovement = require("./stockMovement.model");
const inventoryService = require("./inventory.service");

const router = express.Router();
router.use(requireAuth);

const canView = requirePermission("inventory.view");
const canAdjust = requirePermission("inventory.adjust");

const actorOf = (req) => ({ id: req.user.id, name: req.user.name, role: req.user.role });

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
    const rows = await Inventory.find(filter)
      .populate("variant", "sku name sellingPrice lowStockThreshold")
      .populate("product", "name slug media")
      .limit(500);

    const low = rows.filter((r) => r.isLow);
    res.json({ success: true, items: low, meta: { total: low.length } });
  })
);

router.get(
  "/expiring",
  canView,
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days) || 3;
    const filter = { "batches.expiresOn": { $lte: new Date(Date.now() + days * 86400000) } };
    if (req.query.store) filter.store = req.query.store;

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
