const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// Points earned and spent. Kept separate from the wallet because points are
// not money: they expire, they have a conversion rate the admin can change,
// and they cannot be withdrawn.

const REASONS = ["earned", "redeemed", "expired", "adjustment", "reversed"];

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    user: objectId("User", { required: true, index: true }),

    // Signed: positive earns, negative redeems or expires.
    points: { type: Number, required: true },
    balanceAfter: { type: Number, default: 0 },

    reason: { type: String, enum: REASONS, required: true, index: true },
    note: { type: String, default: "" },

    order: objectId("Order"),
    orderCode: { type: String, default: "" },

    // Earned points expire; redeemed ones do not carry a date.
    expiresOn: { type: Date, index: true },
    expiredAt: Date,

    actor: objectId("User"),
    actorName: { type: String, default: "" },
  },
  baseOptions
);

loyaltyTransactionSchema.index({ user: 1, createdAt: -1 });
loyaltyTransactionSchema.statics.REASONS = REASONS;

module.exports = mongoose.model("LoyaltyTransaction", loyaltyTransactionSchema);
