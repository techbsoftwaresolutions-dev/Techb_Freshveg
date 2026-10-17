const Cart = require("../modules/cart/cart.model");
const Order = require("../modules/orders/order.model");
const User = require("../modules/auth/user.model");
const Inventory = require("../modules/inventory/inventory.model");
const Wishlist = require("../modules/wishlist/wishlist.model");
const Product = require("../modules/catalog/product.model");
const Variant = require("../modules/catalog/variant.model");
const Settings = require("../modules/settings/settings.model");
const notificationService = require("../modules/notifications/notification.service");
const loyaltyService = require("../modules/loyalty/loyalty.service");
const orderService = require("../modules/orders/order.service");
const paymentService = require("../modules/payments/payment.service");
const storage = require("../modules/storage/providers");

// The "smart notifications" from the spec, as scheduled rules rather than
// hand-sent messages.
//
// Every rule here is idempotent and rate-limited by a marker on the record it
// acts on (remindersSent, lastNotifiedAt). A scheduler that fires twice must
// not send the customer two identical messages.

/**
 * Carts left sitting with something in them.
 *
 * Two nudges, then silence — a third message is spam, and the `remindersSent`
 * counter is what guarantees it never happens.
 */
async function abandonedCarts(now = new Date()) {
  const settings = await Settings.load();
  const rules = settings.notifications.abandonedCart;
  if (!rules.enabled) return { skipped: "disabled" };

  const firstCutoff = new Date(now.getTime() - rules.firstReminderMinutes * 60000);
  const secondCutoff = new Date(now.getTime() - rules.secondReminderHours * 3600000);

  const first = await Cart.find({
    status: "active",
    customer: { $ne: null },
    "items.0": { $exists: true },
    lastActivityAt: { $lte: firstCutoff },
    remindersSent: 0,
  }).limit(200);

  for (const cart of first) {
    await notificationService.notify(cart.customer, "ABANDONED_CART_1", {
      itemCount: cart.activeItems.length,
    });
    cart.remindersSent = 1;
    // Not touch() — that would reset the clock and the second nudge would
    // never fire.
    await cart.save();
  }

  const second = await Cart.find({
    status: "active",
    customer: { $ne: null },
    "items.0": { $exists: true },
    lastActivityAt: { $lte: secondCutoff },
    remindersSent: 1,
  }).limit(200);

  for (const cart of second) {
    await notificationService.notify(cart.customer, "ABANDONED_CART_2", {
      itemCount: cart.activeItems.length,
      coupon: rules.secondReminderCoupon || "",
    });
    cart.remindersSent = 2;
    await cart.save();
  }

  return { firstReminders: first.length, secondReminders: second.length };
}

/** Customers who have not ordered in a while. */
async function winBack(now = new Date()) {
  const settings = await Settings.load();
  if (!settings.notifications.winBack.enabled) return { skipped: "disabled" };

  const cutoff = new Date(now.getTime() - settings.notifications.winBack.inactiveDays * 86400000);

  const recent = await Order.distinct("customer", { placedAt: { $gte: cutoff } });

  // Only people who have actually bought before — someone who never ordered is
  // a different conversation, and "we miss you" would be a lie.
  const everOrdered = await Order.distinct("customer");
  const lapsed = everOrdered.filter((id) => !recent.some((r) => String(r) === String(id)));

  let sent = 0;
  for (const customerId of lapsed.slice(0, 200)) {
    const result = await notificationService.notify(customerId, "WIN_BACK", {
      days: settings.notifications.winBack.inactiveDays,
    });
    if (result) sent += 1;
  }

  return { lapsed: lapsed.length, sent };
}

/** Tells the store what is running out, once per sweep rather than per sale. */
async function lowStockAlerts() {
  const settings = await Settings.load();
  if (!settings.notifications.lowStockAlerts) return { skipped: "disabled" };

  const low = await Inventory.find({
    $expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, "$lowStockThreshold"] },
  })
    .populate("product", "name")
    .limit(100);

  if (!low.length) return { items: 0, notified: 0 };

  const managers = await User.find({
    role: { $in: ["admin", "super_admin", "store_manager"] },
    status: "active",
  }).select("_id");

  for (const manager of managers) {
    await notificationService.notify(
      manager._id,
      "LOW_STOCK_ADMIN",
      {
        count: low.length,
        first: low[0].product?.name || "an item",
      },
      { audience: "admin" }
    );
  }

  return { items: low.length, notified: managers.length };
}

/**
 * Wishlist watches: something saved is back in stock, or has got cheaper.
 *
 * `lastNotifiedAt` keeps a product that hovers around zero stock from
 * generating a message every single sweep.
 */
async function wishlistWatches(now = new Date()) {
  const quietPeriod = new Date(now.getTime() - 3 * 86400000);

  const wishlists = await Wishlist.find({ "items.0": { $exists: true } }).limit(500);
  let restock = 0;
  let priceDrop = 0;

  for (const wishlist of wishlists) {
    let changed = false;

    for (const item of wishlist.items) {
      if (item.lastNotifiedAt && item.lastNotifiedAt > quietPeriod) continue;

      const product = await Product.findById(item.product).select("name inStock priceFrom status");
      if (!product || product.status !== "active") continue;

      const variant = item.variant ? await Variant.findById(item.variant).select("sellingPrice inStock") : null;
      const price = variant?.sellingPrice ?? product.priceFrom;
      const inStock = variant ? variant.inStock : product.inStock;

      if (item.notifyOnRestock && inStock && item.priceWhenAdded > 0 && !item.wasInStock) {
        await notificationService.notify(wishlist.customer, "BACK_IN_STOCK", { product: product.name });
        item.lastNotifiedAt = now;
        changed = true;
        restock += 1;
        continue;
      }

      if (item.notifyOnPriceDrop && item.priceWhenAdded > 0 && price < item.priceWhenAdded) {
        const saving = item.priceWhenAdded - price;
        await notificationService.notify(wishlist.customer, "PRICE_DROP", {
          product: product.name,
          saving: `₹${(saving / 100).toFixed(0)}`,
          price: `₹${(price / 100).toFixed(0)}`,
        });
        // Rebase, so the next alert needs a further drop rather than repeating.
        item.priceWhenAdded = price;
        item.lastNotifiedAt = now;
        changed = true;
        priceDrop += 1;
      }
    }

    if (changed) await wishlist.save();
  }

  return { restock, priceDrop };
}

// How long an online order may wait for its payment. Longer than the checkout
// sheet stays open (gateways.razorpay.checkout timeout), so nobody is still
// paying when their order is released.
const UNPAID_ORDER_MINUTES = 30;

/**
 * Online orders whose customer never finished paying. Stock was reserved at
 * checkout, so an abandoned payment must not hold it forever. Each order is
 * first checked with the gateway: a payment whose confirmation got lost (tab
 * closed, no webhook) is applied, not cancelled. Manual UPI orders are left
 * alone — the store confirms those by hand, on its own time.
 */
async function expireUnpaidOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - UNPAID_ORDER_MINUTES * 60000);
  const stale = await Order.find({
    status: "PAYMENT_PENDING",
    "payment.method": "online",
    placedAt: { $lte: cutoff },
  }).limit(100);

  let paid = 0;
  let cancelled = 0;
  for (const order of stale) {
    try {
      const payment = await paymentService.reconcile(order);
      if (payment) {
        await orderService.applyCapturedPayment(payment, "Paid online (reconciled)");
        paid += 1;
      } else {
        await orderService.transition(order, "CANCELLED", { role: "system" }, "Payment not completed in time");
        cancelled += 1;
      }
    } catch (err) {
      // Gateway unreachable: leave the order for the next sweep rather than
      // cancel something that may have been paid.
      console.warn(`[jobs] expireUnpaidOrders ${order.code}:`, err.message);
    }
  }
  return { paid, cancelled };
}

// Doorstep product photos are kept 90 days — long enough for a missing-item
// or damage complaint — then deleted from Cloudinary and the order. An order
// with a return still open keeps its photo until the return is settled
// (docs/legal/internal-retention-schedule.md).
const PRODUCT_PHOTO_DAYS = 90;

async function expireDeliveryPhotos(now = new Date()) {
  if (!storage.cloudinary.configured) return { skipped: "storage not configured" };
  const orders = await Order.find({
    "delivery.productPhoto.publicId": { $exists: true },
    "delivery.productPhoto.uploadedAt": { $lte: new Date(now.getTime() - PRODUCT_PHOTO_DAYS * 86400000) },
    status: { $nin: ["RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_PICKED"] },
  }).select("delivery.productPhoto").limit(200);

  let deleted = 0;
  for (const order of orders) {
    try {
      await storage.cloudinary.destroy(order.delivery.productPhoto.publicId, "authenticated");
    } catch (err) {
      console.warn(`[jobs] product photo for ${order.id} not deleted, retrying next run: ${err.message}`);
      continue;
    }
    await Order.updateOne({ _id: order._id }, { $unset: { "delivery.productPhoto": "" } });
    deleted += 1;
  }
  return { deleted };
}

/** Marks carts that will never come back, so they stop being counted as live. */
async function expireCarts(now = new Date()) {
  const cutoff = new Date(now.getTime() - 14 * 86400000);
  const result = await Cart.updateMany(
    { status: "active", lastActivityAt: { $lte: cutoff } },
    { status: "abandoned" }
  );
  return { abandoned: result.modifiedCount };
}

module.exports = {
  abandonedCarts,
  winBack,
  lowStockAlerts,
  wishlistWatches,
  expireCarts,
  expireUnpaidOrders,
  expireDeliveryPhotos,
  expireLoyalty: loyaltyService.expirePoints,
};
