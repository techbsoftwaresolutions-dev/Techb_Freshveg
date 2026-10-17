const Cart = require("./cart.model");
const Variant = require("../catalog/variant.model");
const Product = require("../catalog/product.model");
const Store = require("../stores/store.model");
const User = require("../auth/user.model");
const Settings = require("../settings/settings.model");
const Order = require("../orders/order.model");
const ApiError = require("../../core/ApiError");
const inventoryService = require("../inventory/inventory.service");
const { priceCart } = require("../pricing/pricing.service");
const couponService = require("../referrals/coupon.service");
const { rulesFrom } = require("../referrals/referral.service");

async function resolveStore(storeId) {
  const store = storeId
    ? await Store.findById(storeId)
    : await Store.findOne({ status: "active" }).sort({ isDefault: -1 });
  if (!store) throw ApiError.badRequest("No active store is configured");
  return store;
}

async function getOrCreateCart({ userId, sessionId, storeId }) {
  const owner = userId ? { customer: userId } : { sessionId, customer: null };
  if (!userId && !sessionId) throw ApiError.badRequest("A session id is required for guest carts");

  // With a store id the store and the cart are looked up side by side — each
  // query is a round trip to the database.
  const [store, found] = storeId
    ? await Promise.all([resolveStore(storeId), Cart.findOne({ ...owner, store: storeId, status: "active" })])
    : [await resolveStore(null), null];

  let cart = found || (await Cart.findOne({ ...owner, store: store._id, status: "active" }));
  if (!cart) cart = await Cart.create({ ...owner, store: store._id });

  cart.$locals.store = store; // summarise() reuses it instead of reading it again
  return cart;
}

// A cart quantity is a count of the variant — packs or pieces, never kilos.
// The variant's min / max / step are whole numbers (see variant.model), and
// anything a client posts is rounded to a whole unit here as well.
function normaliseQuantity(variant, requested) {
  const min = Math.max(1, Math.ceil(variant.minOrderQty || 1));
  const max = variant.maxOrderQty || Infinity;

  if (requested <= 0) return 0;

  const rounded = Math.round(requested);
  if (rounded < min) return min;
  if (rounded > max) {
    throw ApiError.badRequest(`You can order at most ${max} of this item`, { max });
  }
  return rounded;
}

async function addItem(cart, variantId, quantity = null) {
  const [variant, stock] = await Promise.all([
    Variant.findById(variantId),
    inventoryService.availability(cart.store, variantId),
  ]);
  if (!variant || variant.status !== "active") throw ApiError.notFound("This item is not available");

  const existing = cart.findItem(variantId);
  const requested = quantity ?? (existing ? existing.quantity + 1 : 1);
  const finalQty = normaliseQuantity(variant, requested);

  if (stock.available < finalQty) {
    // Whole units only — a stock row can still hold part of a unit reserved
    // by an older order placed by weight.
    const units = Math.floor(stock.available);
    throw ApiError.conflict(units > 0 ? `Only ${units} left` : "Out of stock at your store", { available: units });
  }

  if (existing) {
    existing.quantity = finalQty;
    existing.savedForLater = false;
  } else {
    cart.items.push({ variant: variant._id, product: variant.product, quantity: finalQty });
  }

  cart.touch();
  await cart.save();
  return cart;
}

async function setQuantity(cart, variantId, quantity) {
  const item = cart.findItem(variantId);
  if (!item) throw ApiError.notFound("That item is not in your cart");

  if (quantity <= 0) {
    item.deleteOne();
    cart.touch();
    await cart.save();
    return cart;
  }

  return addItem(cart, variantId, quantity);
}

async function removeItem(cart, variantId) {
  const item = cart.findItem(variantId);
  if (item) {
    item.deleteOne();
    cart.touch();
    await cart.save();
  }
  return cart;
}

// Loads the catalogue data each line needs for pricing. Prices come from the
// variant every time — the cart itself stores only quantities.
async function hydrate(cart, { includeSaved = false } = {}) {
  const items = includeSaved ? cart.items : cart.activeItems;
  if (!items.length) return [];

  // The cart line already records its product, so all three lookups go out
  // together.
  const variantIds = items.map((i) => i.variant);
  const [variants, stock, products] = await Promise.all([
    Variant.find({ _id: { $in: variantIds } }),
    inventoryService.availabilityMap(cart.store, variantIds),
    Product.find({ _id: { $in: items.map((i) => i.product) } }).select(
      "name slug media brand category categoryPath unit taxRatePct"
    ),
  ]);

  const variantById = new Map(variants.map((v) => [v._id.toString(), v]));
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  return items
    .map((item) => {
      const variant = variantById.get(item.variant.toString());
      if (!variant) return null; // variant deleted since it was added
      const product = productById.get(variant.product.toString());
      const availability = stock.get(variant._id.toString()) || { available: 0 };

      return {
        key: item._id.toString(),
        itemId: item._id.toString(),
        variant: variant._id,
        product: variant.product,
        brand: product?.brand,
        // The leaf category decides returnability and the return window once
        // this line becomes an order item; categoryPath is what offers match on.
        category: product?.category,
        categoryPath: product?.categoryPath || [],
        name: product?.name || "",
        variantName: variant.name,
        sku: variant.sku,
        image: variant.media?.[0]?.url || product?.media?.[0]?.url || "",
        unit: product?.unit || variant.packSize?.unit || "pcs",
        packSize: variant.packSize,
        // Per-reference-unit shipping weight, carried onto the order line so
        // a picked/packed order can report a real total weight later —
        // multiplies the same way unitPrice does (weightGrams * quantity).
        weightGrams: variant.weightGrams || 0,
        quantity: item.quantity,
        sellingPrice: variant.sellingPrice,
        mrp: variant.mrp,
        taxRatePct: variant.taxRatePct,
        taxInclusive: variant.taxInclusive,
        stepQty: variant.stepQty,
        minOrderQty: variant.minOrderQty,
        maxOrderQty: variant.maxOrderQty,
        savedForLater: item.savedForLater,
        available: availability.available,
        // The cart screen shows these rather than silently dropping the line,
        // so the customer decides what to do about it.
        inStock: availability.available >= item.quantity,
        isLow: availability.isLow,
      };
    })
    .filter(Boolean);
}

// The cart as the client should render it: lines, live totals, applied and
// rejected offers.
async function summarise(cart, { couponCode, paymentMethod, rewardCouponId } = {}) {
  // One hydrate covers both the live lines and the saved-for-later ones, and
  // everything that doesn't depend on another lookup runs in parallel.
  const [store, all, customer, orderCount, settings] = await Promise.all([
    cart.$locals.store || Store.findById(cart.store),
    hydrate(cart, { includeSaved: true }),
    cart.customer ? User.findById(cart.customer) : null,
    cart.customer ? Order.countDocuments({ customer: cart.customer }) : 0,
    Settings.load(),
  ]);
  const lines = all.filter((l) => !l.savedForLater && l.quantity > 0);
  const saved = all.filter((l) => l.savedForLater);

  const sellable = lines.filter((l) => !l.savedForLater && l.inStock);

  // The reward coupon is re-checked on every read: it may have expired, been
  // used on another order or revoked since it was chosen.
  let rewardCoupon = null;
  let rewardBlocked = null;
  const rewardId = rewardCouponId !== undefined ? rewardCouponId : cart.rewardCoupon;
  if (rewardId) {
    const { coupon, reason } = await couponService.usableForCart(rewardId, cart.customer);
    const rules = rulesFrom(settings);
    if (reason) {
      rewardBlocked = { id: String(rewardId), code: coupon?.code || null, title: coupon?.title || "", amount: coupon?.amount || 0, discount: 0, ok: false, reason };
    } else {
      rewardCoupon = {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,
        amount: coupon.amount,
        minOrderValue: coupon.minOrderValue,
        combinable: rules.combinable,
        excludedCategories: rules.excludedCategories,
      };
    }
  }

  const priced = await priceCart({
    lines: sellable,
    store,
    customer: customer
      ? {
          id: customer.id,
          walletBalance: customer.walletBalance,
          loyaltyPoints: customer.loyaltyPoints,
          orderCount,
        }
      : null,
    couponCode: couponCode ?? cart.couponCode ?? null,
    rewardCoupon,
    paymentMethod,
    // Admin → Settings → Payments can switch wallet / points off at checkout;
    // a cart that asked for them earlier simply stops getting them.
    walletRequested: settings.payment.allowWallet ? cart.walletRequested || 0 : 0,
    loyaltyPointsRequested: settings.payment.allowLoyalty ? cart.loyaltyPointsRequested || 0 : 0,
  });

  if (rewardBlocked) {
    priced.rewardCoupon = rewardBlocked;
    if (rewardBlocked.code) priced.offers.rejected.push({ code: rewardBlocked.code, title: rewardBlocked.title, reason: rewardBlocked.reason });
  }

  // Re-attach display fields the pricing service does not care about.
  const byKey = new Map(priced.lines.map((l) => [l.key, l]));
  const decorated = lines.map((line) => ({ ...line, pricing: byKey.get(line.key) || null }));

  return {
    id: cart.id,
    store: store ? { id: store.id, name: store.name, isOpen: store.isOpenNow() } : null,
    items: decorated.filter((l) => !l.savedForLater),
    savedForLater: saved,
    unavailable: decorated.filter((l) => !l.savedForLater && !l.inStock),
    ...priced,
    // So checkout can hide a credit the admin has switched off.
    credits: { wallet: settings.payment.allowWallet, loyalty: settings.payment.allowLoyalty },
    couponCode: cart.couponCode || null,
    rewardCouponId: cart.rewardCoupon ? String(cart.rewardCoupon) : null,
    deliverySlot: cart.deliverySlot,
  };
}

// Signing in merges whatever the guest had in their cart into the account's.
async function mergeGuestCart(sessionId, userId, storeId) {
  if (!sessionId) return null;

  const guestCart = await Cart.findOne({ sessionId, customer: null, status: "active" });
  if (!guestCart || !guestCart.items.length) return null;

  const userCart = await getOrCreateCart({ userId, storeId: storeId || guestCart.store });

  for (const item of guestCart.items) {
    const existing = userCart.findItem(item.variant);
    // The larger of the two quantities, not the sum — adding them would
    // surprise someone who had the same item in both.
    if (existing) existing.quantity = Math.max(existing.quantity, item.quantity);
    else userCart.items.push({ variant: item.variant, product: item.product, quantity: item.quantity });
  }

  userCart.touch();
  await userCart.save();

  guestCart.status = "converted";
  await guestCart.save();

  return userCart;
}

module.exports = {
  getOrCreateCart,
  addItem,
  setQuantity,
  removeItem,
  hydrate,
  summarise,
  mergeGuestCart,
  normaliseQuantity,
};
