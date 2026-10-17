const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const { requireAuth } = require("../../middleware/auth");
const couponService = require("./coupon.service");

// The signed-in customer's own reward coupons. Choosing one for checkout is
// a cart operation (POST /cart/reward-coupon); admins see every coupon under
// /referrals/coupons.
const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await couponService.listForOwner(req.user.id, { status: req.query.status || null });
    res.json({ success: true, items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ success: true, coupon: await couponService.getForOwner(req.user.id, req.params.id) });
  })
);

module.exports = router;
