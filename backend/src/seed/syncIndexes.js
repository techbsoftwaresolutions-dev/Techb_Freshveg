/* eslint-disable no-console */
// Builds every index the schemas declare.
//
// Models are compiled with autoIndex: false, so a cold API start never blocks
// on an index build against a large collection — and so a deploy cannot
// quietly lock a collection. That makes index creation a deliberate step:
//
//   npm run sync-indexes
//
// Run it after deploying a schema change. The text indexes that back product
// search do not exist until this has run at least once.

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

// Requiring the models is what registers them on the connection.
const models = [
  require("../modules/catalog/attribute.model"),
  require("../modules/catalog/category.model"),
  require("../modules/catalog/brand.model"),
  require("../modules/catalog/product.model"),
  require("../modules/catalog/variant.model"),
  require("../modules/stores/store.model"),
  require("../modules/stores/deliveryArea.model"),
  require("../modules/inventory/inventory.model"),
  require("../modules/inventory/stockMovement.model"),
  require("../modules/cart/cart.model"),
  require("../modules/orders/order.model"),
  require("../modules/pricing/offer.model"),
  require("../modules/auth/user.model"),
  require("../modules/auth/otp.model"),

  // Added with the full feature build-out.
  require("../modules/settings/settings.model"),
  require("../modules/audit/audit.model"),
  require("../modules/payments/payment.model"),
  require("../modules/payments/refund.model"),
  require("../modules/wallet/walletTransaction.model"),
  require("../modules/loyalty/loyaltyTransaction.model"),
  require("../modules/notifications/notification.model"),
  require("../modules/notifications/notificationTemplate.model"),
  require("../modules/notifications/whatsappMessage.model"),
  require("../modules/reviews/review.model"),
  require("../modules/wishlist/wishlist.model"),
  require("../modules/referrals/referral.model"),
  require("../modules/referrals/coupon.model"),
  require("../modules/delivery/deliveryZone.model"),
  require("../modules/delivery/deliverySlot.model"),
  require("../modules/delivery/deliveryTracking.model"),
  require("../modules/support/supportTicket.model"),
  require("../modules/maintenance/maintenanceAsset.model"),
  require("../modules/maintenance/maintenanceRequest.model"),
  require("../modules/marketing/banner.model"),
  require("../modules/customers/customerGroup.model"),
];

async function syncIndexes({ quiet = false } = {}) {
  let total = 0;

  for (const Model of models) {
    await Model.createIndexes();
    const indexes = await Model.collection.indexes().catch(() => []);
    total += indexes.length;
    if (!quiet) console.log(`  ${Model.modelName.padEnd(16)} ${indexes.length} indexes`);
  }

  return total;
}

async function run() {
  await connectDb();
  console.log("\nBuilding indexes:");
  const total = await syncIndexes();
  console.log(`\n${total} indexes across ${models.length} collections.\n`);
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("Index sync failed:", err.message);
    process.exit(1);
  });
}

module.exports = { syncIndexes };
