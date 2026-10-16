const { mongoose, baseOptions, subdocOptions, money, objectId } = require("../../core/schemaBase");

// One row per customer who joined with someone's code. `referee` is unique, so
// a customer can have one referrer and the database — not a read-then-write —
// is what makes a second claim fail.
//
// Purchases are embedded rather than a collection of their own so that
// counting one is a single atomic update of this document: the order is
// pushed and the counter bumped together, guarded by "this order is not here
// yet", so a retried webhook or a re-run status change can never count twice.
// A referee's delivered orders number in the hundreds at most.

const PURCHASE_STATUSES = ["counted", "reversed", "ineligible"];

const purchaseSchema = new mongoose.Schema(
  {
    order: objectId("Order", { required: true }),
    orderCode: { type: String, default: "" },
    // Merchandise after catalogue prices and offers; before delivery, tax
    // credits and reward coupons. See referral.service qualifyingAmount().
    amount: money(0),
    status: { type: String, enum: PURCHASE_STATUSES, default: "counted" },
    // Why an ineligible purchase did not count, or why a counted one was
    // reversed — shown to admins only.
    note: { type: String, default: "" },
    // The friend's qualifying-purchase count this purchase made (1 = first).
    ordinal: { type: Number, default: 0 },
    // The reward this purchase earned, snapshotted from the settings at the
    // time it counted — later rule changes never rewrite it. 0 = none.
    referrerReward: money(0),
    refereeReward: money(0),
    // Set once the coupons exist. A purchase with a reward and no `issuedAt`
    // is owed coupons, which the scheduler's sweep issues on retry.
    issuedAt: Date,
    countedAt: { type: Date, default: Date.now },
    reversedAt: Date,
  },
  subdocOptions
);

const referralSchema = new mongoose.Schema(
  {
    referrer: objectId("User", { required: true, index: true }),
    referee: objectId("User", { required: true, unique: true }),
    code: { type: String, required: true, uppercase: true, index: true },
    // How the code arrived: "signup" (with the OTP login), "link" or "manual".
    source: { type: String, default: "manual" },

    // pending: no qualifying purchase yet · active: at least one ·
    // void: cancelled by an admin (nothing more is counted or earned).
    // "rewarded" is the pre-milestone status, kept so old rows still load.
    status: {
      type: String,
      enum: ["pending", "active", "void", "rewarded"],
      default: "pending",
      index: true,
    },

    qualifyingPurchases: { type: Number, default: 0, min: 0 },
    lastQualifiedAt: Date,
    purchases: { type: [purchaseSchema], default: [] },

    voidReason: { type: String, default: "" },
    // Left over from the wallet-credit version; read by the migration only.
    referrerReward: money(0),
    refereeReward: money(0),
    qualifyingOrderCode: { type: String, default: "" },
    rewardedAt: Date,
  },
  baseOptions
);

referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ "purchases.order": 1 });
// The retry sweep: purchases that earned something but have no coupons yet.
referralSchema.index({ "purchases.issuedAt": 1, "purchases.status": 1 });

referralSchema.statics.PURCHASE_STATUSES = PURCHASE_STATUSES;

module.exports = mongoose.model("Referral", referralSchema);
