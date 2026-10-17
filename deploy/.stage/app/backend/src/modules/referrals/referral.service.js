const mongoose = require("mongoose");

const Referral = require("./referral.model");
const Coupon = require("./coupon.model");
const couponService = require("./coupon.service");
const User = require("../auth/user.model");
const Order = require("../orders/order.model");
const Settings = require("../settings/settings.model");
const ApiError = require("../../core/ApiError");
const notificationService = require("../notifications/notification.service");

/*
 * Referral & Rewards — the rules, in one place.
 *
 * Attribution
 *   - A customer can be referred once (Referral.referee is unique), only
 *     before their first order, never by themselves, and never by someone
 *     they referred. It cannot be changed afterwards except by an admin
 *     voiding it (audited).
 *
 * A qualifying purchase is an order of the referred customer that
 *   - reaches DELIVERED with payment.status "paid" — prepaid orders are paid
 *     before they are packed, COD orders are marked paid at delivery, so a
 *     failed or abandoned payment never gets here;
 *   - is worth at least settings.referral.minQualifyingOrderValue, measured
 *     on qualifyingAmount(): merchandise after catalogue prices and offers,
 *     before delivery, packaging, wallet, points and reward coupons;
 *   - is delivered while the programme is switched on.
 *   Every delivered order is recorded on the referral once; ones that do not
 *   qualify are kept as "ineligible" with the reason, for the admin.
 *
 * Reversal
 *   - A refund lowers the purchase's value rupee for rupee. Once it falls
 *     below the minimum (or the order is fully refunded) the purchase is
 *     reversed: the count drops by one, and coupons that purchase earned are
 *     revoked if they are still unused. Coupons already spent stay spent.
 *
 * Milestones
 *   - The referrer earns a coupon when a friend's count reaches a configured
 *     milestone exactly, and after the last milestone every `repeatEvery`
 *     purchases if a repeat reward is set. The reward is snapshotted on the
 *     purchase when it counts, so rule changes apply from the next purchase
 *     on and never rewrite coupons already issued.
 *   - Each (referral, milestone) can be issued once (Coupon.issueKey is
 *     unique). The friend gets a one-off welcome coupon on their first.
 */

// Gives a customer a referral code if they have none. Random, not derived from
// the phone number, so a code shared publicly reveals nothing about its owner.
async function ensureCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = couponService.randomCode(8);
    try {
      const saved = await User.findOneAndUpdate(
        { _id: user._id, $or: [{ referralCode: null }, { referralCode: "" }] },
        { $set: { referralCode: code } },
        { new: true }
      );
      user.referralCode = saved?.referralCode || (await User.findById(user._id).select("referralCode")).referralCode;
      return user.referralCode;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw new Error("Could not generate a unique referral code");
}

const normaliseCode = (code) => String(code || "").trim().toUpperCase();
const validFormat = (code) => /^[A-Z0-9]{4,16}$/.test(code);

// --------------------------------------------------------------- rules

function rulesFrom(settings) {
  const r = settings.referral || {};
  const milestones = [...(r.milestones || [])]
    .map((m) => ({ purchases: m.purchases, reward: m.reward }))
    .sort((a, b) => a.purchases - b.purchases);
  return {
    enabled: Boolean(r.enabled),
    milestones,
    repeatEvery: r.repeatEvery || 0,
    repeatReward: r.repeatReward || 0,
    refereeReward: r.refereeReward || 0,
    minQualifyingOrderValue: r.minQualifyingOrderValue || 0,
    couponExpiryDays: r.couponExpiryDays || 30,
    couponMinOrderValue: r.couponMinOrderValue || 0,
    combinable: Boolean(r.combinable),
    maxRewardsPerReferrer: r.maxRewardsPerReferrer || 0,
    excludedCategories: (r.excludedCategories || []).map(String),
  };
}

const lastMilestone = (rules) => (rules.milestones.length ? rules.milestones[rules.milestones.length - 1].purchases : 0);
const repeats = (rules) => rules.repeatEvery > 0 && rules.repeatReward > 0;

// What the referrer earns when a friend's count becomes `n`.
function rewardAt(n, rules) {
  const hit = rules.milestones.find((m) => m.purchases === n);
  if (hit) return hit.reward;
  const last = lastMilestone(rules);
  if (repeats(rules) && n > last && (n - last) % rules.repeatEvery === 0) return rules.repeatReward;
  return 0;
}

// The next count above `n` that earns something, or null.
function nextMilestone(n, rules) {
  const fixed = rules.milestones.find((m) => m.purchases > n && m.reward > 0);
  if (fixed) return fixed;
  if (!repeats(rules)) return null;
  const last = lastMilestone(rules);
  const steps = Math.floor(Math.max(0, n - last) / rules.repeatEvery) + 1;
  return { purchases: last + steps * rules.repeatEvery, reward: rules.repeatReward };
}

// --------------------------------------------------------------- attribution

async function claim(userId, rawCode, { source = "manual" } = {}) {
  const settings = await Settings.load();
  if (!settings.referral.enabled) throw ApiError.badRequest("Referrals are not running right now");

  const code = normaliseCode(rawCode);
  if (!validFormat(code)) throw ApiError.badRequest("That referral code is not valid");

  const user = await User.findById(userId);
  if (!user || user.role !== "customer") throw ApiError.notFound("Account not found");
  if (user.referralCode === code) throw ApiError.badRequest("You can't use your own referral code");

  if (await Referral.exists({ referee: userId })) throw ApiError.conflict("You have already used a referral code");

  const referrer = await User.findOne({ referralCode: code, role: "customer" }).select("status referredBy");
  if (!referrer || referrer.status === "blocked") throw ApiError.badRequest("That referral code is not valid");
  if (String(referrer._id) === String(userId)) throw ApiError.badRequest("You can't use your own referral code");
  // A → B → A would let two accounts farm each other.
  if (String(referrer.referredBy || "") === String(userId)) {
    throw ApiError.badRequest("You can't use the code of someone you referred");
  }

  // The reward is for bringing in a *new* customer.
  if (await Order.exists({ customer: userId })) {
    throw ApiError.badRequest("Referral codes can only be used before your first order");
  }

  let referral;
  try {
    referral = await Referral.create({ referrer: referrer._id, referee: userId, code, source });
  } catch (err) {
    // Two claims at once: the unique index lets exactly one through.
    if (err?.code === 11000) throw ApiError.conflict("You have already used a referral code");
    throw err;
  }
  await User.updateOne({ _id: userId, referredBy: null }, { $set: { referredBy: referrer._id } });
  return referral;
}

// Public check for a code in a shared link: says whether it works, nothing
// about whose it is.
async function checkCode(rawCode) {
  const settings = await Settings.load();
  const code = normaliseCode(rawCode);
  const valid =
    settings.referral.enabled &&
    validFormat(code) &&
    Boolean(await User.exists({ referralCode: code, role: "customer", status: { $ne: "blocked" } }));
  return { valid, enabled: settings.referral.enabled, code, welcomeReward: settings.referral.refereeReward || 0 };
}

// --------------------------------------------------------------- purchases

function qualifyingAmount(order) {
  const p = order.pricing || {};
  if (typeof p.qualifyingAmount === "number" && p.qualifyingAmount > 0) return p.qualifyingAmount;
  return Math.max(0, (p.subtotal || 0) - (p.offerDiscount || 0) + (p.rewardDiscount || 0));
}

// The purchase's value after refunds — the partial-refund rule.
const remainingAmount = (order) => Math.max(0, qualifyingAmount(order) - (order.payment?.amountRefunded || 0));

const sameOrder = (order) => (p) => String(p.order) === String(order._id);

// Records a delivered order against the customer's referral. Idempotent: an
// order already on the referral is left alone, and the push + count happen in
// one guarded update, so a retry or a concurrent second call cannot count it
// twice. Returns the referral, or null when the customer was not referred.
async function recordPurchase(order) {
  if (order.status !== "DELIVERED" || order.payment?.status !== "paid") return null;

  let referral = await Referral.findOne({ referee: order.customer });
  if (!referral || referral.status === "void") return null;
  if (referral.purchases.some(sameOrder(order))) return referral;

  const rules = rulesFrom(await Settings.load());
  const amount = qualifyingAmount(order);
  const now = new Date();
  const base = { order: order._id, orderCode: order.code, amount, countedAt: now };

  let ineligible = "";
  if (!rules.enabled) ineligible = "Delivered while the referral programme was off";
  else if (amount < rules.minQualifyingOrderValue) {
    ineligible = `Below the ₹${(rules.minQualifyingOrderValue / 100).toFixed(0)} qualifying minimum`;
  }

  if (ineligible) {
    referral = await Referral.findOneAndUpdate(
      { _id: referral._id, "purchases.order": { $ne: order._id } },
      { $push: { purchases: { ...base, status: "ineligible", note: ineligible, issuedAt: now } } },
      { new: true }
    );
    return referral || Referral.findOne({ referee: order.customer });
  }

  // Optimistic: the count read is part of the filter, so two purchases
  // delivered at the same moment take ordinals one after the other.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt) {
      referral = await Referral.findById(referral._id);
      if (!referral || referral.status === "void") return null;
      if (referral.purchases.some(sameOrder(order))) return referral;
    }
    const ordinal = referral.qualifyingPurchases + 1;
    let referrerReward = rewardAt(ordinal, rules);
    let note = "";
    if (referrerReward && rules.maxRewardsPerReferrer) {
      // ponytail: the cap is read, not locked — two milestones landing in the
      // same instant can overshoot it by one. Lock per referrer if that matters.
      const earned = await Coupon.countDocuments({ owner: referral.referrer, source: "referral", status: { $ne: "revoked" } });
      if (earned >= rules.maxRewardsPerReferrer) {
        referrerReward = 0;
        note = "Referrer has reached the reward cap";
      }
    }
    const refereeReward = ordinal === 1 ? rules.refereeReward : 0;
    const entry = {
      ...base,
      status: "counted",
      note,
      ordinal,
      referrerReward,
      refereeReward,
      ...(referrerReward || refereeReward ? {} : { issuedAt: now }),
    };

    const saved = await Referral.findOneAndUpdate(
      {
        _id: referral._id,
        status: { $ne: "void" },
        qualifyingPurchases: referral.qualifyingPurchases,
        "purchases.order": { $ne: order._id },
      },
      {
        $push: { purchases: entry },
        $inc: { qualifyingPurchases: 1 },
        $set: { status: "active", lastQualifiedAt: now },
      },
      { new: true }
    );
    if (saved) {
      await issueDue(saved, rules);
      return saved;
    }
  }
  throw new Error(`Referral for order ${order.code} is busy — the sweep will pick it up`);
}

// Issues the coupons owed by counted purchases that have none yet. Safe to
// run any number of times: each coupon's issueKey is unique.
async function issueDue(referral, rules = null) {
  rules = rules || rulesFrom(await Settings.load());
  const owed = referral.purchases.filter(
    (p) => p.status === "counted" && !p.issuedAt && (p.referrerReward > 0 || p.refereeReward > 0)
  );
  let issued = 0;

  for (const purchase of owed) {
    const expiresAt = new Date(Date.now() + rules.couponExpiryDays * 24 * 60 * 60 * 1000);
    const common = {
      referral: referral._id,
      milestone: purchase.ordinal,
      sourceOrderCode: purchase.orderCode,
      minOrderValue: rules.couponMinOrderValue,
      expiresAt,
    };
    const rupees = (paise) => `₹${(paise / 100).toFixed(0)}`;

    if (purchase.referrerReward > 0) {
      const coupon = await couponService.issue({
        ...common,
        owner: referral.referrer,
        source: "referral",
        amount: purchase.referrerReward,
        title: `${rupees(purchase.referrerReward)} referral reward`,
        description: `Earned when a friend you referred completed their ${ordinalWord(purchase.ordinal)} qualifying order`,
        issueKey: `${referral._id}:${purchase.ordinal}:referral`,
      });
      if (coupon) {
        issued += 1;
        await notificationService
          .notify(referral.referrer, "CUSTOM", {
            title: "You earned a referral reward",
            body: `A ${rupees(coupon.amount)} coupon is waiting in your Coupons.`,
          })
          .catch(() => {});
      }
    }

    if (purchase.refereeReward > 0) {
      const coupon = await couponService.issue({
        ...common,
        owner: referral.referee,
        source: "referral_welcome",
        amount: purchase.refereeReward,
        title: `${rupees(purchase.refereeReward)} welcome reward`,
        description: "Thanks for joining with a friend's referral code",
        issueKey: `${referral._id}:${purchase.ordinal}:referral_welcome`,
      });
      if (coupon) issued += 1;
    }

    await Referral.updateOne(
      { _id: referral._id, "purchases._id": purchase._id },
      { $set: { "purchases.$.issuedAt": new Date() } }
    );
  }
  return issued;
}

function ordinalWord(n) {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  if (words[n]) return words[n];
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return `${n}${suffix}`;
}

// Re-checks a counted purchase after a refund or cancellation and reverses it
// once it no longer qualifies. Idempotent: the update only matches a purchase
// still marked "counted".
async function reviewOrder(order, reason = "") {
  const referral = await Referral.findOne({ "purchases.order": order._id });
  if (!referral) return null;
  const purchase = referral.purchases.find((p) => sameOrder(order)(p) && p.status === "counted");
  if (!purchase) return null;

  const rules = rulesFrom(await Settings.load());
  const closed = ["CANCELLED", "REJECTED", "REFUNDED"].includes(order.status) || order.payment?.status === "refunded";
  if (!closed && remainingAmount(order) >= rules.minQualifyingOrderValue) return null;

  const note = reason || (closed ? `Order ${String(order.status).toLowerCase()}` : "Refunded below the qualifying minimum");
  const saved = await Referral.findOneAndUpdate(
    { _id: referral._id, purchases: { $elemMatch: { _id: purchase._id, status: "counted" } } },
    {
      $set: {
        "purchases.$.status": "reversed",
        "purchases.$.reversedAt": new Date(),
        "purchases.$.note": note,
        "purchases.$.issuedAt": purchase.issuedAt || new Date(),
      },
      $inc: { qualifyingPurchases: -1 },
    },
    { new: true }
  );
  if (!saved) return null;
  if (saved.qualifyingPurchases <= 0 && saved.status !== "void") {
    await Referral.updateOne({ _id: saved._id, qualifyingPurchases: { $lte: 0 } }, { $set: { status: "pending" } });
  }

  // Unused coupons that this purchase earned are withdrawn; spent ones stay.
  const earned = await Coupon.find({ referral: saved._id, milestone: purchase.ordinal, sourceOrderCode: purchase.orderCode });
  for (const coupon of earned) await couponService.revoke(coupon._id, { reason: `Referral purchase reversed: ${note}` });
  return saved;
}

// Brings one referral back in line with the orders: counts delivered orders
// it missed (an error after delivery, say), reverses ones that no longer
// qualify, and issues any coupons still owed. The admin's "Recalculate" and
// the scheduler's sweep both use it.
async function reconcile(referralId) {
  let referral = await Referral.findById(referralId);
  if (!referral) throw ApiError.notFound("Referral not found");
  if (referral.status === "void") return referral;

  const known = new Set(referral.purchases.map((p) => String(p.order)));
  const missed = await Order.find({
    customer: referral.referee,
    status: "DELIVERED",
    "payment.status": "paid",
    _id: { $nin: [...known].map((id) => new mongoose.Types.ObjectId(id)) },
    placedAt: { $gte: referral.createdAt },
  }).sort({ "delivery.deliveredAt": 1 });
  for (const order of missed) await recordPurchase(order);

  const counted = (await Referral.findById(referralId)).purchases.filter((p) => p.status === "counted");
  const orders = await Order.find({ _id: { $in: counted.map((p) => p.order) } });
  for (const order of orders) await reviewOrder(order);

  referral = await Referral.findById(referralId);
  // The counter must equal the counted rows; repair it if a crash split them.
  const actual = referral.purchases.filter((p) => p.status === "counted").length;
  if (actual !== referral.qualifyingPurchases) {
    await Referral.updateOne({ _id: referral._id }, { $set: { qualifyingPurchases: actual } });
  }
  referral = await Referral.findById(referralId);
  await issueDue(referral);
  return Referral.findById(referralId);
}

// Scheduler: owed coupons first (cheap and the most important), then recent
// deliveries that never got recorded.
async function sweep() {
  const owed = await Referral.find({
    status: { $ne: "void" },
    purchases: {
      $elemMatch: {
        status: "counted",
        issuedAt: null,
        $or: [{ referrerReward: { $gt: 0 } }, { refereeReward: { $gt: 0 } }],
      },
    },
  }).limit(100);
  let issued = 0;
  for (const referral of owed) issued += await issueDue(referral);

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const customers = await Order.distinct("customer", { status: "DELIVERED", "delivery.deliveredAt": { $gte: since } });
  const referrals = await Referral.find({ referee: { $in: customers }, status: { $ne: "void" } }).select("purchases.order referee");
  let recovered = 0;
  for (const referral of referrals) {
    const known = referral.purchases.map((p) => p.order);
    const orders = await Order.find({
      customer: referral.referee,
      status: "DELIVERED",
      "payment.status": "paid",
      "delivery.deliveredAt": { $gte: since },
      _id: { $nin: known },
    });
    for (const order of orders) {
      await recordPurchase(order);
      recovered += 1;
    }
  }

  const coupons = await couponService.sweep();
  return { rewardsIssued: issued, purchasesRecovered: recovered, ...coupons };
}

// --------------------------------------------------------------- customer views

// "Priya S." — enough to recognise a friend, not enough to identify a stranger.
function maskName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A friend";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

function progressFor(referral, rules, earnedMilestones) {
  const count = referral.qualifyingPurchases || 0;
  const next = referral.status === "void" ? null : nextMilestone(count, rules);
  return {
    qualifyingPurchases: count,
    nextMilestone: next ? { purchases: next.purchases, reward: next.reward, remaining: next.purchases - count } : null,
    percent: next ? Math.min(100, Math.round((count / next.purchases) * 100)) : 100,
    milestones: rules.milestones.map((m) => ({
      purchases: m.purchases,
      reward: m.reward,
      state: earnedMilestones.has(m.purchases) ? "earned" : count >= m.purchases ? "passed" : "upcoming",
    })),
    rewardsEarned: earnedMilestones.size,
  };
}

const friendStatus = (referral) =>
  referral.status === "void" ? "void" : (referral.qualifyingPurchases || 0) > 0 ? "active" : "pending";

async function summaryFor(userId) {
  const [user, settings] = await Promise.all([User.findById(userId), Settings.load()]);
  if (!user) throw ApiError.notFound("Account not found");
  const code = await ensureCode(user);
  const rules = rulesFrom(settings);
  const owner = new mongoose.Types.ObjectId(String(userId));

  const [totals, coupons, mine] = await Promise.all([
    Referral.aggregate([
      { $match: { referrer: owner } },
      {
        $group: {
          _id: null,
          referred: { $sum: 1 },
          purchased: { $sum: { $cond: [{ $gt: ["$qualifyingPurchases", 0] }, 1, 0] } },
          purchases: { $sum: "$qualifyingPurchases" },
        },
      },
    ]),
    Coupon.find({ owner: userId, source: "referral" }).select("status expiresAt amount"),
    Referral.findOne({ referee: userId }).select("status createdAt"),
  ]);
  const now = new Date();
  const t = totals[0] || {};
  const base = process.env.PUBLIC_WEBSITE_URL ? process.env.PUBLIC_WEBSITE_URL.replace(/\/$/, "") : "";

  return {
    code,
    shareUrl: base ? `${base}/?ref=${code}` : null,
    enabled: rules.enabled,
    rules: {
      milestones: rules.milestones,
      repeatEvery: rules.repeatEvery,
      repeatReward: rules.repeatReward,
      welcomeReward: rules.refereeReward,
      minQualifyingOrderValue: rules.minQualifyingOrderValue,
      couponExpiryDays: rules.couponExpiryDays,
      couponMinOrderValue: rules.couponMinOrderValue,
    },
    stats: {
      referred: t.referred || 0,
      friendsPurchased: t.purchased || 0,
      qualifyingPurchases: t.purchases || 0,
      couponsEarned: coupons.filter((c) => c.status !== "revoked").length,
      couponsAvailable: coupons.filter((c) => c.effectiveStatus(now) === "available").length,
      earnedValue: coupons.filter((c) => c.status !== "revoked").reduce((sum, c) => sum + c.amount, 0),
    },
    // Whether this customer can still enter a friend's code.
    referredBy: mine ? { since: mine.createdAt } : null,
    canClaim: rules.enabled && !mine && !(await Order.exists({ customer: userId })),
  };
}

async function friendsFor(userId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const filter = { referrer: userId };

  const [rows, total, settings] = await Promise.all([
    Referral.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("referee status qualifyingPurchases createdAt lastQualifiedAt")
      .populate("referee", "name"),
    Referral.countDocuments(filter),
    Settings.load(),
  ]);
  const rules = rulesFrom(settings);
  const coupons = await Coupon.find({
    referral: { $in: rows.map((r) => r._id) },
    source: "referral",
    status: { $ne: "revoked" },
  }).select("referral milestone");
  const earnedBy = new Map();
  for (const c of coupons) {
    const key = String(c.referral);
    if (!earnedBy.has(key)) earnedBy.set(key, new Set());
    earnedBy.get(key).add(c.milestone);
  }

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: maskName(r.referee?.name),
      referredAt: r.createdAt,
      status: friendStatus(r),
      lastQualifiedAt: r.lastQualifiedAt || null,
      ...progressFor(r, rules, earnedBy.get(String(r._id)) || new Set()),
    })),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

module.exports = {
  ensureCode,
  claim,
  checkCode,
  rulesFrom,
  rewardAt,
  nextMilestone,
  qualifyingAmount,
  recordPurchase,
  issueDue,
  reviewOrder,
  reconcile,
  sweep,
  summaryFor,
  friendsFor,
  maskName,
  progressFor,
  friendStatus,
};
