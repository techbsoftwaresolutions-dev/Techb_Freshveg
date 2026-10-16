const crypto = require("crypto");
const mongoose = require("mongoose");

const Coupon = require("./coupon.model");
const ApiError = require("../../core/ApiError");

// Reward coupons: ownership, single use and the reserve → redeem → release
// cycle around an order. What a coupon is *worth* on a cart is decided by
// pricing.service (applyRewardCoupon), the same as every other discount.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const randomCode = (length) =>
  Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

const isDuplicate = (err) => err?.code === 11000;

// Creates a coupon unless one with the same issueKey already stands. Returns
// the new coupon, or null when it already existed — which is how a retried
// issuance stays a no-op.
async function issue(fields) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Coupon.create({ ...fields, code: `RW${randomCode(8)}` });
    } catch (err) {
      if (!isDuplicate(err)) throw err;
      if (fields.issueKey && (await Coupon.exists({ issueKey: fields.issueKey }))) return null;
      // Otherwise the random code collided — draw another.
    }
  }
  throw new Error("Could not generate a unique coupon code");
}

// What a customer sees. Never names the friend whose order earned it.
function view(coupon, at = new Date()) {
  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    description: coupon.description,
    amount: coupon.amount,
    minOrderValue: coupon.minOrderValue,
    source: coupon.source,
    milestone: coupon.milestone || null,
    status: coupon.effectiveStatus(at),
    issuedAt: coupon.issuedAt,
    expiresAt: coupon.expiresAt,
    orderCode: coupon.orderCode || null,
    discountApplied: coupon.discountApplied || 0,
    redeemedAt: coupon.redeemedAt || null,
  };
}

async function listForOwner(ownerId, { status } = {}) {
  const now = new Date();
  const coupons = await Coupon.find({ owner: ownerId }).sort({ issuedAt: -1 }).limit(200);
  const views = coupons.map((c) => view(c, now));
  // Usable first, then the rest by date.
  const rank = { available: 0, reserved: 1, redeemed: 2, expired: 3, revoked: 4 };
  views.sort((a, b) => rank[a.status] - rank[b.status]);
  return status ? views.filter((c) => c.status === status) : views;
}

async function getForOwner(ownerId, id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound("Coupon not found");
  const coupon = await Coupon.findOne({ _id: id, owner: ownerId });
  if (!coupon) throw ApiError.notFound("Coupon not found");
  return view(coupon);
}

// Finds a coupon the cart may use: this customer's, unused, unexpired. Returns
// { coupon } or { reason } — the cart shows the reason rather than dropping
// the coupon silently.
async function usableForCart(couponId, customerId) {
  const coupon = mongoose.isValidObjectId(couponId) ? await Coupon.findById(couponId) : null;
  if (!coupon || !customerId || String(coupon.owner) !== String(customerId)) {
    return { reason: "That coupon is not on your account" };
  }
  const status = coupon.effectiveStatus();
  if (status === "available") return { coupon };
  const reasons = {
    reserved: "This coupon is held by another order",
    redeemed: "This coupon has already been used",
    expired: "This coupon has expired",
    revoked: "This coupon is no longer valid",
  };
  return { coupon, reason: reasons[status] };
}

async function findOwnedByCode(code, customerId) {
  if (!customerId || !/^RW[A-Z0-9]{8}$/.test(code)) return null;
  return Coupon.findOne({ code, owner: customerId });
}

// Takes the coupon for an order — atomically, so of two checkouts racing for
// it exactly one gets it.
async function reserve(couponId, customerId, { orderId, orderCode, discount }) {
  const now = new Date();
  const taken = await Coupon.findOneAndUpdate(
    { _id: couponId, owner: customerId, status: "available", expiresAt: { $gt: now } },
    { $set: { status: "reserved", order: orderId, orderCode, discountApplied: discount, reservedAt: now } },
    { new: true }
  );
  if (!taken) throw ApiError.conflict("Your coupon was used on another order or is no longer valid — remove it and try again");
  return taken;
}

// The order went through (COD confirmed, or online payment captured).
async function redeemForOrder(order) {
  if (!order.rewardCoupon?.coupon) return null;
  return Coupon.findOneAndUpdate(
    { _id: order.rewardCoupon.coupon, order: order._id, status: "reserved" },
    { $set: { status: "redeemed", redeemedAt: new Date() } },
    { new: true }
  );
}

// The order was cancelled or rejected before delivery (including an online
// payment that never arrived): the coupon goes back to the customer, unless
// it has expired meanwhile. Delivered orders keep their coupon used.
async function releaseForOrder(order) {
  const id = order.rewardCoupon?.coupon || null;
  if (!id) return null;
  const coupon = await Coupon.findOne({ _id: id, order: order._id, status: { $in: ["reserved", "redeemed"] } });
  if (!coupon) return null;
  return Coupon.findOneAndUpdate(
    { _id: coupon._id, order: order._id, status: coupon.status },
    {
      $set: { status: coupon.expiresAt > new Date() ? "available" : "expired", orderCode: "", discountApplied: 0 },
      $unset: { order: 1, reservedAt: 1, redeemedAt: 1 },
    },
    { new: true }
  );
}

// Only an unused coupon can be revoked; one already spent on an order is
// history. Removing issueKey lets the milestone be earned again later.
async function revoke(couponId, { reason, actor } = {}) {
  return Coupon.findOneAndUpdate(
    { _id: couponId, status: "available" },
    {
      $set: { status: "revoked", revokedAt: new Date(), revokedReason: reason || "", revokedBy: actor?.id },
      $unset: { issueKey: 1 },
    },
    { new: true }
  );
}

// Housekeeping for the scheduler: write down expiries, and free coupons held
// by a checkout that crashed before its order was saved.
async function sweep() {
  const now = new Date();
  const expired = await Coupon.updateMany({ status: "available", expiresAt: { $lte: now } }, { $set: { status: "expired" } });

  const Order = mongoose.model("Order");
  const stale = await Coupon.find({ status: "reserved", reservedAt: { $lt: new Date(now - 60 * 60 * 1000) } }).limit(100);
  let released = 0;
  for (const coupon of stale) {
    if (await Order.exists({ _id: coupon.order })) continue;
    const freed = await releaseForOrder({ _id: coupon.order, rewardCoupon: { coupon: coupon._id } });
    if (freed) released += 1;
  }
  return { couponsExpired: expired.modifiedCount || 0, couponsReleased: released };
}

module.exports = {
  issue,
  view,
  listForOwner,
  getForOwner,
  usableForCart,
  findOwnedByCode,
  reserve,
  redeemForOrder,
  releaseForOrder,
  revoke,
  sweep,
  randomCode,
};
