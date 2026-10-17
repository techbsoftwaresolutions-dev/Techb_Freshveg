const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Referral = require("./referral.model");
const referralService = require("./referral.service");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ success: true, ...(await referralService.summaryFor(req.user.id)) });
  })
);

router.post(
  "/claim",
  asyncHandler(async (req, res) => {
    const referral = await referralService.claim(req.user.id, req.body.code);
    res.status(201).json({
      success: true,
      referral,
      message: "Code applied — your reward lands once your first order is delivered.",
    });
  })
);

router.get(
  "/",
  requirePermission("marketing.view"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const result = await paginate(Referral, filter, req.query, {
      defaultSort: { createdAt: -1 },
      populate: [
        { path: "referrer", select: "name phone" },
        { path: "referee", select: "name phone" },
      ],
    });
    res.json({ success: true, ...result });
  })
);

module.exports = router;
