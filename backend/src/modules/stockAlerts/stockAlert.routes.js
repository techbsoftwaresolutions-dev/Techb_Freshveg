const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { requireAuth } = require("../../middleware/auth");
const Variant = require("../catalog/variant.model");
const Product = require("../catalog/product.model");
const StockAlert = require("./stockAlert.model");
const { sweep } = require("./stockAlert.service");

const router = express.Router();
router.use(requireAuth);

// What the signed-in customer is waiting for, and what has come back.
// Their own waiting alerts are re-checked here, so the website hears about a
// restock straight away instead of waiting for the next background sweep.
router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    await sweep({ customer: req.user.id }, { limit: 100 });
    const alerts = await StockAlert.find({ customer: req.user.id, status: { $in: ["waiting", "ready"] } })
      .sort({ createdAt: -1 })
      .limit(200);
    const ready = alerts.filter((a) => a.status === "ready");
    const products = ready.length
      ? await Product.find({ _id: { $in: ready.map((a) => a.product) } }).select("name slug media")
      : [];
    const byId = new Map(products.map((p) => [String(p._id), p]));
    res.json({
      success: true,
      waiting: alerts.filter((a) => a.status === "waiting").map((a) => String(a.variant)),
      ready: ready.map((a) => {
        const p = byId.get(String(a.product));
        return {
          id: a.id,
          variant: String(a.variant),
          product: p ? { name: p.name, slug: p.slug, image: p.primaryImage || "" } : null,
        };
      }),
    });
  })
);

// "Notify me" for one variant.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const variant = await Variant.findById(req.body.variant).select("product inStock");
    if (!variant) throw ApiError.notFound("Product not found");
    if (variant.inStock) throw ApiError.badRequest("This item is in stock — add it to your cart.");
    await StockAlert.updateOne(
      { customer: req.user.id, variant: variant._id, status: "waiting" },
      { $setOnInsert: { customer: req.user.id, variant: variant._id, product: variant.product, status: "waiting" } },
      { upsert: true }
    );
    res.status(201).json({ success: true, message: "We'll let you know when it's back" });
  })
);

// Changed their mind.
router.delete(
  "/:variant",
  asyncHandler(async (req, res) => {
    await StockAlert.deleteMany({ customer: req.user.id, variant: req.params.variant, status: "waiting" });
    res.json({ success: true, message: "Alert removed" });
  })
);

// The website has shown these "back in stock" messages.
router.post(
  "/seen",
  asyncHandler(async (req, res) => {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).slice(0, 100);
    await StockAlert.updateMany({ _id: { $in: ids }, customer: req.user.id, status: "ready" }, { status: "seen" });
    res.json({ success: true });
  })
);

module.exports = router;
