const ApiError = require("../../core/ApiError");
const gateways = require("../payments/gateways");
const WalletTopup = require("./walletTopup.model");
const walletService = require("./wallet.service");

// Customer "Add money": pay through Razorpay, then the wallet is credited.
const MIN = 10 * 100; // ₹10
const MAX = 10000 * 100; // ₹10,000 per top-up

async function start(user, amount) {
  const razorpay = gateways.razorpay;
  if (!razorpay.configured) throw ApiError.badRequest("Adding money is not available right now.");
  amount = Math.round(Number(amount) || 0);
  if (amount < MIN) throw ApiError.badRequest("Add at least ₹10.");
  if (amount > MAX) throw ApiError.badRequest("You can add up to ₹10,000 at a time.");
  if (amount % 100) throw ApiError.badRequest("Enter a whole rupee amount.");

  const created = await razorpay.call("/orders", {
    body: {
      amount,
      currency: "INR",
      receipt: `WAL-${Date.now().toString(36)}`,
      notes: { purpose: "wallet_topup", user: String(user._id), customerPhone: user.phone || "" },
    },
  });

  const topup = await WalletTopup.create({ user: user._id, amount, providerOrderId: created.id });

  return {
    topup: { id: topup.id, amount },
    checkout: {
      key: razorpay.keyId,
      orderId: created.id,
      amount: created.amount,
      currency: created.currency,
      name: "Hosur Basket",
      description: "Add money to wallet",
      prefill: { contact: user.phone || "", name: user.name || "" },
    },
  };
}

/**
 * Credits the wallet for a paid top-up, exactly once. `paidAmount` is what the
 * gateway says it captured; anything short of the asked amount is refused.
 */
async function settle(topup, { providerPaymentId, paidAmount }) {
  if (paidAmount !== undefined && Number(paidAmount) < topup.amount) {
    throw ApiError.badRequest("Payment amount did not match");
  }
  const won = await WalletTopup.findOneAndUpdate(
    { _id: topup._id, status: "created" },
    { status: "paid", providerPaymentId: providerPaymentId || "", paidAt: new Date() },
    { new: true }
  );
  if (!won) return { alreadyCredited: true }; // the other path got here first
  const result = await walletService.credit(topup.user, topup.amount, {
    reason: "topup",
    note: "Added via Razorpay",
    refType: "WalletTopup",
    refId: topup._id,
  });
  return { alreadyCredited: false, balance: result.balance };
}

/** The customer's browser came back from Razorpay with a signed payment. */
async function confirm(userId, topupId, { providerPaymentId, signature }) {
  const topup = await WalletTopup.findById(topupId);
  if (!topup) throw ApiError.notFound("Top-up not found");
  if (String(topup.user) !== String(userId)) throw ApiError.forbidden("Not your top-up");
  if (topup.status === "paid") return { alreadyCredited: true };

  const check = await gateways.razorpay.verify({
    providerOrderId: topup.providerOrderId,
    providerPaymentId,
    signature,
  });
  if (!check.ok) throw ApiError.badRequest(check.reason || "Payment could not be verified");
  return settle(topup, { providerPaymentId, paidAmount: check.payload?.amount });
}

/** From the signed gateway webhook: covers a customer who closed the tab after paying. */
async function fromWebhook(entity) {
  if (!entity?.order_id || entity.status !== "captured") return false;
  const topup = await WalletTopup.findOne({ providerOrderId: entity.order_id });
  if (!topup) return false;
  if (topup.status !== "paid") await settle(topup, { providerPaymentId: entity.id, paidAmount: entity.amount });
  return true;
}

module.exports = { start, confirm, fromWebhook, MIN, MAX };
