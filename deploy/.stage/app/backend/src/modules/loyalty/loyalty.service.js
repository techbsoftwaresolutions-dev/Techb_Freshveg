const User = require("../auth/user.model");
const Settings = require("../settings/settings.model");
const LoyaltyTransaction = require("./loyaltyTransaction.model");
const ApiError = require("../../core/ApiError");

// Points are configurable from the admin: how fast they are earned, what they
// are worth, how much of an order they may cover, and when they lapse. Nothing
// here hardcodes the rate.

async function rules() {
  const settings = await Settings.load();
  return settings.loyalty;
}

async function apply(userId, points, { reason, note, order, orderCode, expiresOn, actor } = {}) {
  if (!Number.isInteger(points) || points === 0) {
    throw ApiError.badRequest("Points must be a non-zero integer");
  }

  const filter = { _id: userId };
  if (points < 0) filter.loyaltyPoints = { $gte: Math.abs(points) };

  const user = await User.findOneAndUpdate(
    filter,
    { $inc: { loyaltyPoints: points } },
    { new: true }
  );

  if (!user) {
    const exists = await User.exists({ _id: userId });
    if (!exists) throw ApiError.notFound("Customer not found");
    throw ApiError.badRequest("Not enough loyalty points");
  }

  await LoyaltyTransaction.create({
    user: userId,
    points,
    balanceAfter: user.loyaltyPoints,
    reason: reason || "adjustment",
    note: note || "",
    order,
    orderCode: orderCode || "",
    expiresOn,
    actor: actor?.id,
    actorName: actor?.name || "",
  });

  return { balance: user.loyaltyPoints, points };
}

/** Points a given order value earns, at the configured rate. */
async function pointsFor(amountPaise) {
  const config = await rules();
  if (!config.enabled) return 0;
  const rupees = amountPaise / 100;
  return Math.floor(rupees / (config.rupeesPerPoint || 100));
}

async function earn(userId, amountPaise, { order, orderCode } = {}) {
  const config = await rules();
  const points = await pointsFor(amountPaise);
  if (points <= 0) return { balance: null, points: 0 };

  const expiresOn = config.expiryDays
    ? new Date(Date.now() + config.expiryDays * 86400000)
    : undefined;

  return apply(userId, points, {
    reason: "earned",
    note: `Earned on order ${orderCode || ""}`.trim(),
    order,
    orderCode,
    expiresOn,
  });
}

/**
 * How many points this customer may actually put against an order, and what
 * they are worth. Capped three ways: what they hold, the per-order ceiling,
 * and the order value itself.
 */
async function redeemable(userId, orderTotalPaise) {
  const config = await rules();
  if (!config.enabled) return { points: 0, value: 0, reason: "Loyalty is turned off" };

  const user = await User.findById(userId).select("loyaltyPoints");
  const held = user?.loyaltyPoints || 0;

  if (held < (config.minPointsToRedeem || 0)) {
    return {
      points: 0,
      value: 0,
      reason: `Collect ${config.minPointsToRedeem} points to start redeeming`,
      held,
    };
  }

  const ceiling = Math.floor((orderTotalPaise * (config.maxRedeemPctOfOrder || 100)) / 100);
  const worthPerPoint = config.pointValuePaise || 10;
  const affordable = Math.floor(ceiling / worthPerPoint);
  const points = Math.max(0, Math.min(held, affordable));

  return { points, value: points * worthPerPoint, held, maxPctOfOrder: config.maxRedeemPctOfOrder };
}

async function redeem(userId, points, { order, orderCode } = {}) {
  if (points <= 0) return { balance: null, points: 0, value: 0 };
  const config = await rules();
  const result = await apply(userId, -Math.abs(points), {
    reason: "redeemed",
    note: `Redeemed on order ${orderCode || ""}`.trim(),
    order,
    orderCode,
  });
  return { ...result, value: Math.abs(points) * (config.pointValuePaise || 10) };
}

/** Puts points back when the order they were spent on is cancelled. */
async function reverse(userId, points, { order, orderCode } = {}) {
  if (points <= 0) return null;
  return apply(userId, Math.abs(points), {
    reason: "reversed",
    note: `Returned from cancelled order ${orderCode || ""}`.trim(),
    order,
    orderCode,
  });
}

/**
 * Expires points past their date. Run from the scheduler.
 *
 * Deliberately conservative: it only expires points a customer still holds, so
 * someone who already spent them is never pushed negative by a late sweep.
 */
async function expirePoints(now = new Date()) {
  const due = await LoyaltyTransaction.find({
    reason: "earned",
    expiresOn: { $lte: now },
    expiredAt: null,
  }).limit(500);

  let expired = 0;

  for (const entry of due) {
    const user = await User.findById(entry.user).select("loyaltyPoints");
    const take = Math.min(entry.points, user?.loyaltyPoints || 0);

    if (take > 0) {
      await apply(entry.user, -take, {
        reason: "expired",
        note: `Points from ${entry.createdAt.toDateString()} expired`,
      });
      expired += take;
    }

    entry.expiredAt = now;
    await entry.save();
  }

  return { entries: due.length, pointsExpired: expired };
}

async function history(userId, { limit = 50 } = {}) {
  return LoyaltyTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
}

module.exports = { apply, earn, redeem, redeemable, reverse, expirePoints, pointsFor, history, rules };
