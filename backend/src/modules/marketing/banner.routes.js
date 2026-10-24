const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission, optionalAuth } = require("../../middleware/auth");

const Banner = require("./banner.model");
const audit = require("../audit/audit.service");

const router = express.Router();

// Public: what to show in a given slot right now. Scheduling is applied here
// so a client never has to reason about start and end dates.
router.get(
  "/live",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const filter = { status: "active" };
    if (req.query.placement) filter.placement = req.query.placement;
    if (req.query.category) filter.category = req.query.category;

    const banners = (await Banner.find(filter).sort({ seq: 1 })).filter((b) => b.isLive());

    res.json({
      success: true,
      banners: banners.map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        image: b.image,
        mobileImage: b.mobileImage,
        focalX: b.focalX,
        focalY: b.focalY,
        imageScale: b.imageScale,
        fade: b.fade,
        fadeOpacity: b.fadeOpacity,
        height: b.height,
        backgroundColor: b.backgroundColor,
        fadeColor: b.fadeColor,
        points: b.points,
        placement: b.placement,
        target: b.target,
      })),
    });
  })
);

// Fire-and-forget counters. Deliberately not awaited on the client side, and
// deliberately not authenticated — an impression is not worth a token check.
router.post(
  "/:id/track",
  asyncHandler(async (req, res) => {
    const field = req.body.event === "click" ? "clicks" : "impressions";
    await Banner.findByIdAndUpdate(req.params.id, { $inc: { [field]: 1 } });
    res.json({ success: true });
  })
);

router.use(requireAuth);

router.get(
  "/",
  requirePermission("marketing.view"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.placement) filter.placement = req.query.placement;
    if (req.query.status) filter.status = req.query.status;

    const result = await paginate(Banner, filter, req.query, { defaultSort: { placement: 1, seq: 1 } });
    res.json({
      success: true,
      ...result,
      placements: ["home_hero", "home_story", "home_strip", "category_top", "cart", "app_launch"],
    });
  })
);

router.post(
  "/",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    const banner = await Banner.create(req.body);
    await audit.record({ req, action: "create", entity: "Banner", entityId: banner._id, label: banner.title });
    res.status(201).json({ success: true, banner });
  })
);

router.patch(
  "/:id",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw ApiError.notFound("Banner not found");

    const before = audit.snapshot(banner);
    // Counters are earned, not editable.
    delete req.body.impressions;
    delete req.body.clicks;
    Object.assign(banner, req.body);
    await banner.save();

    await audit.record({
      req, action: "update", entity: "Banner", entityId: banner._id,
      label: banner.title, before, after: audit.snapshot(banner),
    });

    res.json({ success: true, banner });
  })
);

// A real delete. Nothing else points at a banner (orders and offers never
// reference one), so there is no history to protect by keeping it — and
// "take it off the site but keep it" is what pausing, via PATCH status, is
// for. The audit log keeps a snapshot of what was removed.
router.delete(
  "/:id",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw ApiError.notFound("Banner not found");

    const before = audit.snapshot(banner);
    await banner.deleteOne();

    await audit.record({
      req, action: "delete", entity: "Banner", entityId: banner._id,
      label: banner.title, before, after: null,
    });

    res.json({ success: true, deleted: banner.id });
  })
);

module.exports = router;
