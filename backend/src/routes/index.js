const express = require("express");

const router = express.Router();

// Remembered answers (storefront pages, the till's product list) are dropped the moment
// anything that could change them is written: catalogue, offers, stock, stores, settings, sales.
// Cart and wishlist traffic is deliberately not in this list, so shoppers never empty the cache.
const cache = require("../core/cache");
router.use(["/catalog", "/marketing", "/inventory", "/stores", "/settings", "/pos", "/orders", "/payments", "/returns"], (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.on("finish", () => {
      if (res.statusCode < 400) { cache.del("sf:*"); cache.del("pos:*"); }
    });
  }
  next();
});

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
router.use("/notifications", require("../modules/notifications/notification.routes"));
router.use("/support", require("../modules/support/support.routes"));

// --- Operations -----------------------------------------------------------
router.use("/catalog", require("../modules/catalog/catalog.routes"));
router.use("/inventory", require("../modules/inventory/inventory.routes"));
router.use("/stores", require("../modules/stores/store.routes"));
router.use("/delivery", require("../modules/delivery/delivery.routes"));
router.use("/customers", require("../modules/customers/customer.routes"));
router.use("/staff", require("../modules/staff/staff.routes"));
router.use("/marketing/offers", require("../modules/pricing/offer.routes"));
router.use("/pos", require("../modules/pos/pos.routes"));
router.use("/maintenance", require("../modules/maintenance/maintenance.routes"));

// --- Oversight ------------------------------------------------------------
router.use("/reports", require("../modules/reports/report.routes"));
router.use("/audit", require("../modules/audit/audit.routes"));
router.use("/uploads", require("../modules/storage/storage.routes"));

module.exports = router;
