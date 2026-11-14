const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { requireAuth } = require("../../middleware/auth");
const User = require("../auth/user.model");
const topupService = require("./topup.service");

const router = express.Router();
router.use(requireAuth);

// Start "Add money": returns what the Razorpay checkout window needs.
router.post(
  "/topup",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound("Account not found");
    const result = await topupService.start(user, req.body.amount);
    res.json({ success: true, ...result });
  })
);

// The browser's word that it paid — checked against Razorpay before crediting.
router.post(
  "/topup/:id/confirm",
  asyncHandler(async (req, res) => {
    const result = await topupService.confirm(req.user.id, req.params.id, {
      providerPaymentId: req.body.providerPaymentId,
      signature: req.body.signature,
    });
    const user = await User.findById(req.user.id).select("walletBalance");
    res.json({ success: true, ...result, balance: user?.walletBalance || 0 });
  })
);

module.exports = router;
