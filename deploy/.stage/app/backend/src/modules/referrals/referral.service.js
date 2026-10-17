const Referral = require("./referral.model");
const User = require("../auth/user.model");
const Order = require("../orders/order.model");
const Settings = require("../settings/settings.model");
const ApiError = require("../../core/ApiError");
const walletService = require("../wallet/wallet.service");
const notificationService = require("../notifications/notification.service");

/**
 * Attaches a new customer to whoever referred them.
 *
 * Guards against the obvious abuses: using your own code, claiming a second
 * one, or claiming after you have already ordered.
 */
async function claim(userId, code) {
  const settings = await Settings.load();
  if (!settings.referral.enabled) throw ApiError.badRequest("Referrals are not running right now");

  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("Account not found");

  const existing = await Referral.findOne({ referee: userId });
  if (existing) throw ApiError.conflict("You have already used a referral code");

  const normalised = String(code || "").trim().toUpperCase();
  if (normalised && user.referralCode === normalised) {
    throw ApiError.badRequest("You can't use your own referral code");
  }

  const referrer = await User.findOne({ referralCode: normalised, role: "customer" });
  if (!referrer) throw ApiError.badRequest("That referral code is not valid");

  // The reward is for bringing in a *new* customer.
  const orders = await Order.countDocuments({ customer: userId });
  if (orders > 0) throw ApiError.badRequest("Referral codes can only be used before your first order");

  user.referredBy = referrer._id;
  await user.save();

  return Referral.create({
    referrer: referrer._id,
    referee: userId,
    code: normalised,
    referrerReward: settings.referral.referrerReward,
    refereeReward: settings.referral.refereeReward,
  });
}

/**
 * Pays out a pending referral once the referee's first order is delivered and
 * is worth at least the configured minimum. Called from the order lifecycle.
 */
async function settleForOrder(order) {
  const referral = await Referral.findOne({ referee: order.customer, status: "pending" });
  if (!referral) return null;

  const settings = await Settings.load();
  if (!settings.referral.enabled) return null;

  if (order.pricing.total < (settings.referral.minFirstOrderValue || 0)) {
    // Not void — they might qualify on a later order.
    return null;
  }

  // Only the *first* delivered order counts.
  const delivered = await Order.countDocuments({
    customer: order.customer,
    status: "DELIVERED",
  });
  if (delivered > 1) return null;

  await walletService.credit(referral.referrer, referral.referrerReward, {
    reason: "referral",
    note: "A friend you referred placed their first order",
    order: order._id,
    orderCode: order.code,
  });

  await walletService.credit(referral.referee, referral.refereeReward, {
    reason: "referral",
    note: "Welcome reward for using a referral code",
    order: order._id,
    orderCode: order.code,
  });

  referral.status = "rewarded";
  referral.qualifyingOrder = order._id;
  referral.qualifyingOrderCode = order.code;
  referral.rewardedAt = new Date();
  await referral.save();

  const amount = `₹${(referral.referrerReward / 100).toFixed(0)}`;
  await notificationService.notify(referral.referrer, "CUSTOM", {
    title: "Referral reward credited",
    body: `${amount} has been added to your wallet.`,
  });

  return referral;
}

async function summaryFor(userId) {
  const user = await User.findById(userId).select("referralCode");
  const [referrals, settings] = await Promise.all([
    Referral.find({ referrer: userId }).populate("referee", "name phone createdAt"),
    Settings.load(),
  ]);

  const rewarded = referrals.filter((r) => r.status === "rewarded");

  return {
    code: user?.referralCode || null,
    enabled: settings.referral.enabled,
    reward: settings.referral.referrerReward,
    friendReward: settings.referral.refereeReward,
    minFirstOrderValue: settings.referral.minFirstOrderValue,
    invited: referrals.length,
    rewardedCount: rewarded.length,
    earned: rewarded.reduce((sum, r) => sum + r.referrerReward, 0),
    // Names only — a referrer has no business seeing a friend's order history.
    friends: referrals.map((r) => ({
      name: r.referee?.name || "A friend",
      status: r.status,
      joinedAt: r.referee?.createdAt,
      rewardedAt: r.rewardedAt,
    })),
  };
}

module.exports = { claim, settleForOrder, summaryFor };
