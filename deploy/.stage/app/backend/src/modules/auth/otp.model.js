const crypto = require("crypto");
const { mongoose, baseOptions } = require("../../core/schemaBase");

// Codes are stored hashed, the same as passwords: a leaked database dump
// should not hand over live login codes.
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    role: { type: String, default: "customer" },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  baseOptions
);

otpSchema.index({ phone: 1, role: 1, createdAt: -1 });
// Mongo sweeps spent codes on its own an hour after they expire.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

otpSchema.statics.hash = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

module.exports = mongoose.model("Otp", otpSchema);
