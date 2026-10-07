const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// One row per person who signed up with someone's code. It stays `pending`
// until the new customer's first order is actually delivered — a referral that
// pays out at signup is an invitation to invent friends.

const referralSchema = new mongoose.Schema(
  {
    referrer: objectId("User", { required: true, index: true }),
    referee: objectId("User", { required: true, unique: true }),
    code: { type: String, required: true, uppercase: true, index: true },

    status: {
      type: String,
      enum: ["pending", "rewarded", "void"],
      default: "pending",
      index: true,
    },

    qualifyingOrder: objectId("Order"),
    qualifyingOrderCode: { type: String, default: "" },

    referrerReward: money(0),
    refereeReward: money(0),
    rewardedAt: Date,
    voidReason: { type: String, default: "" },
  },
  baseOptions
);

referralSchema.index({ referrer: 1, status: 1 });

module.exports = mongoose.model("Referral", referralSchema);
