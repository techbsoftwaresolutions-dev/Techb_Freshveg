const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// A reward coupon: a fixed amount off, owned by one customer, usable once.
//
// Store-wide promo codes are Offers (pricing/offer.model) — one code, many
// customers. These are the opposite shape: issued by the engine to a single
// account (referral milestones today), so they carry an owner, an expiry and
// a redemption state of their own. Checkout prices both through
// pricing.service; this model only adds ownership and single use.
//
// Lifecycle:
//   available → reserved   (order placed with it; atomic, so two checkouts
//                           cannot both take it)
//   reserved  → redeemed   (the order is confirmed: COD at once, online once
//                           the payment is captured)
//   reserved/redeemed → available   (that order is cancelled or rejected
//                           before delivery; expired instead if past expiry)
//   available → expired    (past expiresAt — the scheduler marks it, and every
//                           read treats it as expired already)
//   available → revoked    (an admin, or the referral purchase it came from
//                           being refunded before it was used)
// A coupon redeemed on a delivered order stays redeemed, refund or not.

const STATUSES = ["available", "reserved", "redeemed", "expired", "revoked"];

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    owner: objectId("User", { required: true }),
    title: { type: String, required: true },
    description: { type: String, default: "" },
    amount: money(0),
    minOrderValue: money(0),

    source: { type: String, enum: ["referral", "referral_welcome"], required: true },
    referral: objectId("Referral"),
    // The friend's purchase count that earned it (referrer coupons), and the
    // order that got them there.
    milestone: { type: Number, default: 0 },
    sourceOrderCode: { type: String, default: "" },
    // `${referral}:${milestone}:${source}` while the coupon stands. Unique, so
    // a milestone can be issued once however many times issuance is retried;
    // removed when the coupon is revoked so the milestone can be earned again.
    issueKey: { type: String },

    status: { type: String, enum: STATUSES, default: "available" },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },

    order: objectId("Order"),
    orderCode: { type: String, default: "" },
    discountApplied: money(0),
    reservedAt: Date,
    redeemedAt: Date,
    revokedAt: Date,
    revokedReason: { type: String, default: "" },
    revokedBy: objectId("User"),
  },
  baseOptions
);

couponSchema.index({ owner: 1, status: 1, expiresAt: 1 });
couponSchema.index({ issueKey: 1 }, { unique: true, partialFilterExpression: { issueKey: { $type: "string" } } });
couponSchema.index({ referral: 1, milestone: 1 });
couponSchema.index({ status: 1, expiresAt: 1 });
couponSchema.index({ order: 1 });

couponSchema.statics.STATUSES = STATUSES;

// An available coupon past its expiry is expired, whether or not the sweep
// has written that down yet.
couponSchema.methods.effectiveStatus = function effectiveStatus(at = new Date()) {
  return this.status === "available" && this.expiresAt <= at ? "expired" : this.status;
};

module.exports = mongoose.model("Coupon", couponSchema);
