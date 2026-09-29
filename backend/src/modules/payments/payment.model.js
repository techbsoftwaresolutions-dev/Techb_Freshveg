const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// A payment attempt against an order. There can be several per order: a failed
// UPI try, a retry, then a successful card charge. The order's payment block is
// the summary; these rows are what actually happened.

const METHODS = ["cod", "upi", "card", "netbanking", "wallet", "paylater", "store_credit"];
const STATUSES = ["created", "pending", "authorized", "captured", "failed", "cancelled", "refunded", "partially_refunded"];

const paymentSchema = new mongoose.Schema(
  {
    order: objectId("Order", { required: true, index: true }),
    orderCode: { type: String, default: "", index: true },
    customer: objectId("User", { required: true, index: true }),
    store: objectId("Store", { index: true }),

    method: { type: String, enum: METHODS, required: true, index: true },
    status: { type: String, enum: STATUSES, default: "created", index: true },

    amount: money(0),
    amountCaptured: money(0),
    amountRefunded: money(0),
    currency: { type: String, default: "INR" },

    provider: { type: String, default: "none" }, // razorpay | stripe | none (cod/wallet)
    // What the gateway calls it. Kept so a support agent can paste an id from
    // the gateway dashboard into admin search and find the order.
    providerOrderId: { type: String, default: "", index: true },
    providerPaymentId: { type: String, default: "", index: true },
    providerSignature: { type: String, default: "" },

    // Raw gateway payloads, for when the summary above is not enough to explain
    // a dispute. Never rendered directly to a customer.
    providerPayload: { type: mongoose.Schema.Types.Mixed, default: {} },

    failureCode: { type: String, default: "" },
    failureReason: { type: String, default: "" },

    authorizedAt: Date,
    capturedAt: Date,
    failedAt: Date,

    // Cash handed to a delivery partner, and whether it has reached the store.
    codCollectedBy: objectId("User"),
    codCollectedAt: Date,
    codSettledAt: Date,

    attempt: { type: Number, default: 1 },
    idempotencyKey: { type: String, default: "" },
  },
  baseOptions
);

paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

paymentSchema.statics.METHODS = METHODS;
paymentSchema.statics.STATUSES = STATUSES;

paymentSchema.virtual("isSettled").get(function isSettled() {
  return ["captured", "refunded", "partially_refunded"].includes(this.status);
});

module.exports = mongoose.model("Payment", paymentSchema);
