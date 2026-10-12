const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// One row per WhatsApp order update: the delivery log, the retry queue and
// the duplicate guard in one. The unique (order, event) index is what makes
// "the customer hears each stage once" true even when a status is reached
// twice, two processes race, or a retry overlaps a first attempt.
//
// No phone number is stored — it is read from the customer's account at send
// time — only a masked copy, so the log can be read without exposing it.

const whatsappMessageSchema = new mongoose.Schema(
  {
    order: objectId("Order", { required: true }),
    orderCode: { type: String, default: "" },
    customer: objectId("User", { required: true }),
    event: {
      type: String,
      required: true,
      enum: ["order_confirmed", "order_packed", "out_for_delivery", "order_delivered", "order_cancelled"],
    },
    template: { type: String, required: true },
    toMasked: { type: String, default: "" },

    // pending: waiting to be sent (or retried); sent: Meta accepted it;
    // delivered / read: Meta's receipts; failed: given up; skipped: not sent
    // on purpose (no number, customer opted out).
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    messageId: { type: String },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    // Held while one worker is sending, so a retry sweep cannot send it twice.
    lockedUntil: { type: Date, default: null },
    lastError: { code: Number, message: String },
    reason: { type: String, default: "" },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failedAt: Date,
  },
  baseOptions
);

whatsappMessageSchema.index({ order: 1, event: 1 }, { unique: true });
whatsappMessageSchema.index({ messageId: 1 }, { unique: true, sparse: true });
whatsappMessageSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model("WhatsAppMessage", whatsappMessageSchema);
