const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// One "Add money" attempt. The wallet is credited only when this row moves
// from "created" to "paid" — an atomic flip, so the browser's confirm and the
// gateway webhook racing each other can never credit the same payment twice.
const walletTopupSchema = new mongoose.Schema(
  {
    user: objectId("User", { required: true, index: true }),
    amount: { type: Number, required: true }, // paise
    provider: { type: String, default: "razorpay" },
    providerOrderId: { type: String, required: true, unique: true },
    providerPaymentId: { type: String, default: "" },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },
    paidAt: Date,
  },
  baseOptions
);

module.exports = mongoose.models.WalletTopup || mongoose.model("WalletTopup", walletTopupSchema);
