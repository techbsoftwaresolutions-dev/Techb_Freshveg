const express = require("express");

const router = express.Router();

// --- Identity -------------------------------------------------------------
router.use("/auth", require("../modules/auth/auth.routes"));

// --- Storefront (public reads; a token only adds personalisation) ----------
router.use("/storefront", require("../modules/catalog/storefront.routes"));
router.use("/banners", require("../modules/marketing/banner.routes"));
router.use("/settings", require("../modules/settings/settings.routes"));

// --- Shopping -------------------------------------------------------------
router.use("/cart", require("../modules/cart/cart.routes"));
router.use("/wishlist", require("../modules/wishlist/wishlist.routes"));
router.use("/orders", require("../modules/orders/order.routes"));
router.use("/returns", require("../modules/orders/return.routes"));
router.use("/payments", require("../modules/payments/payment.routes"));
router.use("/reviews", require("../modules/reviews/review.routes"));
router.use("/referrals", require("../modules/referrals/referral.routes"));
router.use("/coupons", require("../modules/referrals/coupon.routes"));
router.use("/notifications", require("../modules/notifications/notification.routes"));
// Meta calls this, not a signed-in user: authenticity is its signature.
router.use("/webhooks/whatsapp", require("../modules/notifications/whatsapp.routes"));
router.use("/support", require("../modules/support/support.routes"));

// --- Operations -----------------------------------------------------------
router.use("/catalog", require("../modules/catalog/catalog.routes"));
router.use("/inventory", require("../modules/inventory/inventory.routes"));
router.use("/stores", require("../modules/stores/store.routes"));
router.use("/delivery-areas", require("../modules/stores/deliveryArea.routes"));
router.use("/delivery", require("../modules/delivery/delivery.routes"));
router.use("/customers", require("../modules/customers/customer.routes"));
router.use("/users", require("../modules/users/user.routes"));
router.use("/marketing/offers", require("../modules/pricing/offer.routes"));
router.use("/marketing/landing-sections", require("../modules/marketing/landing.routes"));
router.use("/maintenance", require("../modules/maintenance/maintenance.routes"));

// --- Oversight ------------------------------------------------------------
router.use("/reports", require("../modules/reports/report.routes"));
router.use("/audit", require("../modules/audit/audit.routes"));
router.use("/uploads", require("../modules/storage/storage.routes"));

module.exports = router;
