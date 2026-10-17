const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// One row per account-deletion request: the receipt a customer is given, the
// queue an admin works a delivery employee's request from, and the record
// that the erasure happened. It holds no personal data — a masked number and
// the reference are enough to answer "was my account deleted?".

const accountDeletionSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: objectId("User", { required: true, index: true }),
    role: { type: String, required: true },
    phoneMasked: { type: String, default: "" },

    // app / web: the account holder, signed in. admin: staff acting on a
    // request received another way (email, phone), recorded in `note`.
    source: { type: String, enum: ["app", "web", "admin"], default: "app" },
    // requested: waiting for an admin (delivery employees only) · completed:
    // erased · rejected: an admin declined, with `note` saying why.
    status: { type: String, enum: ["requested", "completed", "rejected"], default: "requested", index: true },
    reason: { type: String, default: "", maxlength: 500 },
    note: { type: String, default: "", maxlength: 500 },

    // What the customer gave up, so a later claim can be honoured.
    forfeited: {
      walletBalance: money(0),
      loyaltyPoints: { type: Number, default: 0 },
      coupons: { type: Number, default: 0 },
    },

    requestedAt: { type: Date, default: Date.now },
    completedAt: Date,
    processedBy: objectId("User"),
    processedByName: { type: String, default: "" },
  },
  baseOptions
);

accountDeletionSchema.index({ role: 1, status: 1, requestedAt: -1 });

module.exports = mongoose.model("AccountDeletion", accountDeletionSchema);
