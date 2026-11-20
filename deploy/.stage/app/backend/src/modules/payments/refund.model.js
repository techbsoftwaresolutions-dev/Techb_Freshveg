const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// A refund is its own record, not a field on the payment: an order can be
// refunded in parts (one damaged item today, the rest next week), each part
// authorised by a different person for a different reason.

const refundSchema = new mongoose.Schema(
  {
    order: objectId("Order", { required: true, index: true }),
    orderCode: { type: String, default: "", index: true },
    payment: objectId("Payment", { index: true }),
    customer: objectId("User", { required: true, index: true }),

    amount: money(0),
    // Where the money went back to. Wallet is instant and keeps the customer;
    // "source" means back to the card or UPI handle, which takes days.
    destination: {
      type: String,
      enum: ["wallet", "source", "cash"],
      default: "wallet",
    },

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    reason: { type: String, default: "" },
    // Which lines it covers, when it is a partial refund.
    items: {
      type: [
        new mongoose.Schema(
          { orderItem: mongoose.Schema.Types.ObjectId, name: String, quantity: Number, amount: Number },
          { _id: false }
        ),
      ],
      default: [],
    },

    provider: { type: String, default: "" },
    providerRefundId: { type: String, default: "" },
    providerPayload: { type: mongoose.Schema.Types.Mixed, default: {} },

    requestedBy: objectId("User"),
    requestedByName: { type: String, default: "" },
    approvedBy: objectId("User"),
    completedAt: Date,
    failureReason: { type: String, default: "" },
  },
  baseOptions
);

refundSchema.index({ createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Refund", refundSchema);
