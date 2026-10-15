const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Offer = require("./offer.model");

const router = express.Router();
router.use(requireAuth);

const canView = requirePermission("marketing.view");
const canManage = requirePermission("marketing.manage");

// The offer types and the condition/reward keys the engine understands, so the
// admin builds its form from the engine rather than from a duplicated list.
router.get(
  "/meta",
  canView,
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      types: [
        { value: "percentage", label: "Percentage off", rewards: ["discountPct", "maxDiscount"] },
        { value: "fixed", label: "Fixed amount off", rewards: ["discountAmount"] },
        { value: "free_delivery", label: "Free delivery", rewards: [] },
        { value: "bogo", label: "Buy X get Y free", rewards: ["buyQuantity", "getQuantity"] },
        { value: "cashback", label: "Wallet cashback", rewards: ["cashbackPct", "cashbackMax"] },
      ],
      conditions: [
        { key: "minCartValue", label: "Minimum cart value", type: "money" },
        { key: "minQuantity", label: "Minimum quantity", type: "number" },
        { key: "categories", label: "Limited to categories", type: "categories" },
        { key: "firstOrderOnly", label: "First order only", type: "boolean" },
      ],
    });
  })
);

router.get(
  "/",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.kind === "coupon") filter.requiresCode = true;
    if (req.query.kind === "offer") filter.requiresCode = false;

    const result = await paginate(Offer, filter, req.query, {
      defaultSort: { priority: -1, createdAt: -1 },
      populate: { path: "conditions.categories", select: "name slug" },
    });

    // `isLive` is a method, so it has to be computed before the documents are
    // serialised — the admin list shows "active but not running right now"
    // (a weekend-only coupon on a Tuesday) as its own state.
    res.json({
      success: true,
      ...result,
      items: result.items.map((offer) => ({ ...offer.toJSON(), isLive: offer.isLive() })),
    });
  })
);

router.post(
  "/",
  canManage,
  asyncHandler(async (req, res) => {
    if (req.body.requiresCode && !req.body.code) {
      throw ApiError.badRequest("A coupon needs a code");
    }
    const offer = await Offer.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, offer });
  })
);

router.patch(
  "/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const offer = await Offer.findById(req.params.id);
    if (!offer) throw ApiError.notFound("Offer not found");

    // usedCount is a running total the checkout increments; letting it be
    // patched would let someone reset a limited coupon by editing it.
    delete req.body.limits?.usedCount;

    Object.assign(offer, req.body);
    await offer.save();
    res.json({ success: true, offer: { ...offer.toJSON(), isLive: offer.isLive() } });
  })
);

router.delete(
  "/:id",
  canManage,
  asyncHandler(async (req, res) => {
    // Paused, not deleted — past orders reference the offer that discounted them.
    const offer = await Offer.findByIdAndUpdate(req.params.id, { status: "paused" }, { new: true });
    if (!offer) throw ApiError.notFound("Offer not found");
    res.json({ success: true, offer });
  })
);

module.exports = router;
