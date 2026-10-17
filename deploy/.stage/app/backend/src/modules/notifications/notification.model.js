const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// One row per notification sent to one person. Doubles as the in-app
// notification feed (the bell icon) and as the delivery log for push/SMS —
// which is what you read when a customer says "I never got told".

const notificationSchema = new mongoose.Schema(
  {
    user: objectId("User", { required: true, index: true }),
    event: { type: String, required: true, index: true },
    category: { type: String, enum: ["transactional", "marketing"], default: "transactional" },

    title: { type: String, default: "" },
    body: { type: String, default: "" },
    deeplink: { type: String, default: "" },
    image: { type: String, default: "" },

    // What was attempted, and how each one went. A push that failed while the
    // SMS landed is a different story from nothing being sent at all.
    channels: {
      type: [
        new mongoose.Schema(
          {
            channel: { type: String, enum: ["push", "sms", "email", "whatsapp", "inapp"] },
            status: { type: String, enum: ["queued", "sent", "failed", "skipped"], default: "queued" },
            sentAt: Date,
            error: String,
            reason: String, // why it was skipped, e.g. "customer opted out"
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    order: objectId("Order"),
    orderCode: { type: String, default: "" },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    readAt: { type: Date, default: null },
  },
  baseOptions
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
