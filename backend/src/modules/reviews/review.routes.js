const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission, optionalAuth } = require("../../middleware/auth");

const Review = require("./review.model");
const Order = require("../orders/order.model");
const Product = require("../catalog/product.model");
const Settings = require("../settings/settings.model");
const audit = require("../audit/audit.service");

const router = express.Router();

// Recomputes a product's rating from its published reviews. Called after any
// change to moderation state, so the number on a product card always reflects
// what a shopper can actually read.
async function refreshRating(productId) {
  if (!productId) return null;

  const [stats] = await Review.aggregate([
    { $match: { product: productId, status: "published", productRating: { $gte: 1 } } },
    { $group: { _id: null, average: { $avg: "$productRating" }, count: { $sum: 1 } } },
  ]);

  const rating = {
    average: stats ? Math.round(stats.average * 10) / 10 : 0,
    count: stats?.count || 0,
  };

  await Product.findByIdAndUpdate(productId, { rating });
  return rating;
}

// ---------------------------------------------------------------- public

router.get(
  "/product/:productId",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const result = await paginate(
      Review,
      { product: req.params.productId, status: "published" },
      req.query,
      { defaultSort: { helpfulCount: -1, createdAt: -1 }, select: "-moderationNote -moderatedBy" }
    );

    // The star breakdown a product page shows next to the average.
    const breakdown = await Review.aggregate([
      { $match: { product: new (require("mongoose").Types.ObjectId)(String(req.params.productId)), status: "published" } },
      { $group: { _id: "$productRating", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      ...result,
      breakdown: [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        count: breakdown.find((b) => b._id === stars)?.count || 0,
      })),
    });
  })
);

router.use(requireAuth);

// ---------------------------------------------------------------- customer

// What this customer still has to review — the prompt after a delivery.
router.get(
  "/pending",
  asyncHandler(async (req, res) => {
    const delivered = await Order.find({ customer: req.user.id, status: "DELIVERED" })
      .sort({ "delivery.deliveredAt": -1 })
      .limit(10);

    const reviewed = await Review.find({ customer: req.user.id }).select("order product");
    const done = new Set(reviewed.map((r) => `${r.order}:${r.product}`));

    const pending = [];
    for (const order of delivered) {
      const items = order.items.filter((item) => !done.has(`${order._id}:${item.product}`));
      if (items.length) {
        pending.push({
          order: { id: order.id, code: order.code, deliveredAt: order.delivery.deliveredAt },
          items: items.map((item) => ({
            product: item.product,
            variant: item.variant,
            name: item.name,
            variantName: item.variantName,
            image: item.image,
          })),
        });
      }
    }

    res.json({ success: true, pending });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const settings = await Settings.load();
    if (!settings.app.reviewsEnabled) throw ApiError.badRequest("Reviews are turned off");

    const order = await Order.findById(req.body.order);
    if (!order) throw ApiError.notFound("Order not found");
    if (String(order.customer) !== req.user.id) throw ApiError.forbidden("Not your order");
    // No review without a completed purchase — this is what "verified" means.
    if (order.status !== "DELIVERED") {
      throw ApiError.badRequest("You can review an order once it has been delivered");
    }
    if (req.body.product && !order.items.some((i) => String(i.product) === String(req.body.product))) {
      throw ApiError.badRequest("That product was not in this order");
    }

    const review = await Review.create({
      customer: req.user.id,
      customerName: req.user.name,
      order: order._id,
      orderCode: order.code,
      product: req.body.product,
      variant: req.body.variant,
      productRating: req.body.productRating,
      deliveryRating: req.body.deliveryRating,
      packagingRating: req.body.packagingRating,
      title: req.body.title,
      comment: req.body.comment,
      images: req.body.images || [],
      status: settings.app.reviewsNeedApproval ? "pending" : "published",
    });

    if (review.status === "published") await refreshRating(review.product);

    // The delivery and packaging scores belong to the order, so the delivery
    // report can rank partners without joining reviews.
    if (req.body.deliveryRating || req.body.packagingRating) {
      order.rating = {
        ...(order.rating || {}),
        delivery: req.body.deliveryRating,
        packaging: req.body.packagingRating,
        order: req.body.productRating,
        ratedAt: new Date(),
      };
      await order.save();
    }

    res.status(201).json({ success: true, review });
  })
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const result = await paginate(Review, { customer: req.user.id }, req.query, {
      defaultSort: { createdAt: -1 },
    });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/:id/helpful",
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpfulCount: 1 } },
      { new: true }
    );
    if (!review) throw ApiError.notFound("Review not found");
    res.json({ success: true, helpfulCount: review.helpfulCount });
  })
);

// ---------------------------------------------------------------- moderation

router.get(
  "/",
  requirePermission("catalog.view"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.product) filter.product = req.query.product;
    if (req.query.rating) filter.productRating = Number(req.query.rating);

    const result = await paginate(Review, filter, req.query, {
      defaultSort: { createdAt: -1 },
      populate: { path: "product", select: "name slug media" },
    });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/:id/moderate",
  requirePermission("catalog.manage"),
  asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);
    if (!review) throw ApiError.notFound("Review not found");

    const decision = req.body.status;
    if (!["published", "rejected", "pending"].includes(decision)) {
      throw ApiError.badRequest("Status must be published, rejected or pending");
    }

    review.status = decision;
    review.moderatedBy = req.user.id;
    review.moderatedAt = new Date();
    review.moderationNote = req.body.note || "";
    await review.save();

    // Rejecting a published review has to pull it back out of the average.
    const rating = await refreshRating(review.product);

    await audit.record({
      req,
      action: "moderate",
      entity: "Review",
      entityId: review._id,
      summary: `Review ${decision}${req.body.note ? ` — ${req.body.note}` : ""}`,
    });

    res.json({ success: true, review, rating });
  })
);

module.exports = router;
