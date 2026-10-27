const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, escapeRegex } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Referral = require("./referral.model");
const Coupon = require("./coupon.model");
const User = require("../auth/user.model");
const referralService = require("./referral.service");
const couponService = require("./coupon.service");
const audit = require("../audit/audit.service");

const router = express.Router();

// Code checks and claims are the guessable surface — limit them per IP.
const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many attempts. Try again in a few minutes." } },
});

// Public: does the code in a shared link work? Says nothing about its owner.
router.get(
  "/check/:code",
  codeLimiter,
  asyncHandler(async (req, res) => {
    res.json({ success: true, ...(await referralService.checkCode(req.params.code)) });
  })
);

router.use(requireAuth);

// ---------------------------------------------------------------- customer

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ success: true, ...(await referralService.summaryFor(req.user.id)) });
  })
);

router.get(
  "/me/friends",
  asyncHandler(async (req, res) => {
    res.json({ success: true, ...(await referralService.friendsFor(req.user.id, req.query)) });
  })
);

router.post(
  "/claim",
  codeLimiter,
  asyncHandler(async (req, res) => {
    const source = ["link", "signup", "manual"].includes(req.body.source) ? req.body.source : "manual";
    const referral = await referralService.claim(req.user.id, req.body.code, { source });
    res.status(201).json({
      success: true,
      referral: { id: referral.id, code: referral.code, createdAt: referral.createdAt },
      message: "Code applied — your welcome reward arrives after your first qualifying order is delivered.",
    });
  })
);

// ---------------------------------------------------------------- admin

const idsMatching = async (search) => {
  const pattern = new RegExp(escapeRegex(search), "i");
  const users = await User.find({ role: "customer", $or: [{ name: pattern }, { phone: pattern }, { referralCode: pattern }] })
    .select("_id")
    .limit(500);
  return users.map((u) => u._id);
};

function dateRange(query) {
  const range = {};
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) range.$lte = new Date(String(query.to).includes("T") ? query.to : `${query.to}T23:59:59.999Z`);
  return Object.keys(range).length ? range : null;
}

router.get(
  "/stats",
  requirePermission("marketing.view"),
  asyncHandler(async (_req, res) => {
    const [referrals, coupons, owed, recentCoupons, recentReferrals] = await Promise.all([
      Referral.aggregate([
        {
          $group: {
            _id: null,
            referred: { $sum: 1 },
            awaitingFirst: { $sum: { $cond: [{ $and: [{ $eq: ["$qualifyingPurchases", 0] }, { $ne: ["$status", "void"] }] }, 1, 0] } },
            purchasing: { $sum: { $cond: [{ $gt: ["$qualifyingPurchases", 0] }, 1, 0] } },
            qualifyingPurchases: { $sum: "$qualifyingPurchases" },
            void: { $sum: { $cond: [{ $eq: ["$status", "void"] }, 1, 0] } },
          },
        },
      ]),
      Coupon.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$amount" }, applied: { $sum: "$discountApplied" } } },
      ]),
      Referral.aggregate([
        { $unwind: "$purchases" },
        {
          $match: {
            "purchases.status": "counted",
            "purchases.issuedAt": null,
            $or: [{ "purchases.referrerReward": { $gt: 0 } }, { "purchases.refereeReward": { $gt: 0 } }],
          },
        },
        { $count: "owed" },
      ]),
      Coupon.find().sort({ issuedAt: -1 }).limit(8).populate("owner", "name phone"),
      Referral.find().sort({ createdAt: -1 }).limit(8).select("-purchases").populate("referrer referee", "name phone"),
    ]);

    const byStatus = Object.fromEntries(coupons.map((c) => [c._id, c]));
    const sum = (key, statuses) => statuses.reduce((total, s) => total + (byStatus[s]?.[key] || 0), 0);
    const issuedStatuses = ["available", "reserved", "redeemed", "expired", "revoked"];

    res.json({
      success: true,
      stats: {
        ...(referrals[0] || { referred: 0, awaitingFirst: 0, purchasing: 0, qualifyingPurchases: 0, void: 0 }),
        couponsIssued: sum("count", issuedStatuses),
        valueIssued: sum("value", issuedStatuses),
        couponsRedeemed: sum("count", ["redeemed"]),
        valueRedeemed: sum("applied", ["redeemed"]),
        couponsAvailable: sum("count", ["available"]),
        couponsRevoked: sum("count", ["revoked"]),
        rewardsOwed: owed[0]?.owed || 0,
      },
      recentCoupons,
      recentReferrals,
    });
  })
);

router.get(
  "/coupons",
  requirePermission("marketing.view"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.referral && mongoose.isValidObjectId(req.query.referral)) filter.referral = req.query.referral;
    const range = dateRange(req.query);
    if (range) filter.issuedAt = range;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      filter.$or = [{ code: search.toUpperCase() }, { owner: { $in: await idsMatching(search) } }];
    }
    const result = await paginate(Coupon, filter, req.query, {
      defaultSort: { issuedAt: -1 },
      populate: [{ path: "owner", select: "name phone" }],
    });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/coupons/:id/revoke",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (!reason) throw ApiError.badRequest("Give a reason for revoking this coupon");
    const before = mongoose.isValidObjectId(req.params.id) ? await Coupon.findById(req.params.id) : null;
    if (!before) throw ApiError.notFound("Coupon not found");
    const coupon = await couponService.revoke(before._id, { reason, actor: req.user });
    if (!coupon) throw ApiError.conflict(`Only an unused coupon can be revoked — this one is ${before.effectiveStatus()}`);
    await audit.record({
      req, action: "revoke", entity: "Coupon", entityId: coupon._id, label: coupon.code,
      summary: `Revoked ${coupon.code} (₹${(coupon.amount / 100).toFixed(0)}): ${reason}`,
      before: audit.snapshot(before), after: audit.snapshot(coupon),
    });
    res.json({ success: true, coupon });
  })
);

router.get(
  "/",
  requirePermission("marketing.view"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status === "pending") filter.qualifyingPurchases = 0;
    if (req.query.status === "active") filter.qualifyingPurchases = { $gt: 0 };
    if (["pending", "active"].includes(req.query.status)) filter.status = { $ne: "void" };
    if (req.query.status === "void") filter.status = "void";
    if (req.query.minPurchases) filter.qualifyingPurchases = { $gte: Number(req.query.minPurchases) || 0 };
    const range = dateRange(req.query);
    if (range) filter.createdAt = range;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      const ids = await idsMatching(search);
      filter.$or = [{ code: search.toUpperCase() }, { referrer: { $in: ids } }, { referee: { $in: ids } }];
    }

    const result = await paginate(Referral, filter, req.query, {
      defaultSort: { createdAt: -1 },
      select: "-purchases",
      populate: [
        { path: "referrer", select: "name phone referralCode" },
        { path: "referee", select: "name phone" },
      ],
    });
    res.json({ success: true, ...result });
  })
);

router.get(
  "/:id",
  requirePermission("marketing.view"),
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Referral not found");
    const referral = await Referral.findById(req.params.id).populate("referrer referee", "name phone referralCode");
    if (!referral) throw ApiError.notFound("Referral not found");
    const [coupons, settings] = await Promise.all([
      Coupon.find({ referral: referral._id }).sort({ issuedAt: -1 }).populate("owner", "name phone"),
      require("../settings/settings.model").load(),
    ]);
    const rules = referralService.rulesFrom(settings);
    const earned = new Set(coupons.filter((c) => c.source === "referral" && c.status !== "revoked").map((c) => c.milestone));
    res.json({ success: true, referral, coupons, progress: referralService.progressFor(referral, rules, earned) });
  })
);

// Re-derives the referral from the orders: missed purchases, reversals and
// owed coupons. Only ever adds what the rules say is due.
router.post(
  "/:id/recalculate",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Referral not found");
    const before = await Referral.findById(req.params.id);
    if (!before) throw ApiError.notFound("Referral not found");
    const referral = await referralService.reconcile(before._id);
    await audit.record({
      req, action: "recalculate", entity: "Referral", entityId: referral._id, label: referral.code,
      summary: `Recalculated: ${before.qualifyingPurchases} → ${referral.qualifyingPurchases} qualifying purchases`,
      before: { qualifyingPurchases: before.qualifyingPurchases, purchases: before.purchases.length },
      after: { qualifyingPurchases: referral.qualifyingPurchases, purchases: referral.purchases.length },
    });
    res.json({ success: true, referral });
  })
);

// Stops a referral for good (fraud, a mistaken link). Its history and the
// coupons already issued stay; nothing more is counted or earned.
router.post(
  "/:id/void",
  requirePermission("marketing.manage"),
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (!reason) throw ApiError.badRequest("Give a reason for voiding this referral");
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Referral not found");
    const referral = await Referral.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "void" } },
      { $set: { status: "void", voidReason: reason } },
      { new: true }
    );
    if (!referral) throw ApiError.conflict("This referral is already void or does not exist");
    await audit.record({
      req, action: "void", entity: "Referral", entityId: referral._id, label: referral.code,
      summary: `Voided referral: ${reason}`,
    });
    res.json({ success: true, referral });
  })
);

module.exports = router;
