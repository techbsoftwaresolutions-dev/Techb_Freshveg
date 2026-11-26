const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// The wallet balance on the user is a running total; this is the history that
// explains it. Same discipline as stock: the number is derived, the ledger is
// the truth, and a disputed balance can be rebuilt by replaying these rows.

const REASONS = [
  "refund",          // order cancelled or returned
  "cashback",        // an offer paid out after delivery
  "referral",        // referral reward
  "topup",           // customer added money
  "order_payment",   // spent at checkout
  "adjustment",      // manual correction by staff
  "expiry",          // unused balance written off
];

const walletTransactionSchema = new mongoose.Schema(
  {
    user: objectId("User", { required: true, index: true }),

    // Signed in paise: positive credits the customer, negative spends.
    amount: { type: Number, required: true },
    balanceAfter: money(0),

    reason: { type: String, enum: REASONS, required: true, index: true },
    note: { type: String, default: "" },

    order: objectId("Order"),
    orderCode: { type: String, default: "" },
    refType: { type: String, default: "" },
    refId: { type: mongoose.Schema.Types.ObjectId },

    actor: objectId("User"),      // staff member, for adjustments
    actorName: { type: String, default: "" },
  },
  baseOptions
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });

walletTransactionSchema.statics.REASONS = REASONS;

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
