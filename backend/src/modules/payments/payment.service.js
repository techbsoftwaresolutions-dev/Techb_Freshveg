const Payment = require("./payment.model");
const Refund = require("./refund.model");
const Order = require("../orders/order.model");
const Settings = require("../settings/settings.model");
const ApiError = require("../../core/ApiError");
const gateways = require("./gateways");
const walletService = require("../wallet/wallet.service");

// Payment is kept at arm's length from the order lifecycle: this module knows
// about money moving, the order state machine knows about fulfilment, and they
// meet at exactly two points — "payment succeeded" and "refund this order".

async function providerFor() {
  const settings = await Settings.load();
  if (!settings.payment.onlineEnabled) return gateways.resolve("none");
  return gateways.resolve(settings.payment.provider);
}

/**
 * Opens a payment attempt for an order. For cash on delivery this just records
 * the intent; for an online method it asks the gateway to create its own order
 * and returns whatever the client needs to open a checkout sheet.
 */
async function initiate(order, { method, customer, idempotencyKey } = {}) {
  if (order.payment.status === "paid") {
    throw ApiError.conflict("This order is already paid");
  }

  // A retried request with the same key must not create a second attempt.
  if (idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) return existing;
  }

  const attempts = await Payment.countDocuments({ order: order._id });
  const provider = method === "cod" ? gateways.manual : await providerFor();

  const payment = new Payment({
    order: order._id,
    orderCode: order.code,
    customer: order.customer,
    store: order.store,
    method,
    amount: order.pricing.total,
    provider: provider.name,
    attempt: attempts + 1,
    idempotencyKey: idempotencyKey || undefined,
    status: method === "cod" ? "pending" : "created",
  });

  if (method !== "cod" && order.pricing.total > 0) {
    try {
      const created = await provider.createOrder({
        amount: order.pricing.total,
        orderCode: order.code,
        customer,
      });
      payment.providerOrderId = created.providerOrderId;
      await payment.save();
      return { payment, checkout: created.checkout };
    } catch (err) {
      payment.status = "failed";
      payment.failureReason = err.message;
      payment.failedAt = new Date();
      await payment.save();
      throw ApiError.badRequest(`Could not start the payment: ${err.message}`);
    }
  }

  await payment.save();
  return { payment, checkout: null };
}

/**
 * Confirms an online payment. The signature is checked against the gateway's
 * secret, so a client cannot invent a payment id — see gateways.razorpay.verify.
 */
async function confirm(paymentId, { providerPaymentId, signature }) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status === "captured") return payment; // already done; idempotent

  const provider = gateways.resolve(payment.provider);
  const result = await provider.verify({
    providerOrderId: payment.providerOrderId,
    providerPaymentId,
    signature,
  });

  if (!result.ok) {
    payment.status = "failed";
    payment.failureReason = result.reason || "Verification failed";
    payment.failedAt = new Date();
    await payment.save();
    throw ApiError.badRequest(payment.failureReason);
  }

  payment.status = "captured";
  payment.providerPaymentId = result.providerPaymentId;
  payment.providerSignature = signature || "";
  payment.providerPayload = result.payload || {};
  payment.amountCaptured = payment.amount;
  payment.capturedAt = new Date();
  await payment.save();

  return payment;
}

/** Records that a delivery partner took cash at the door. */
async function collectCod(order, actor) {
  const payment =
    (await Payment.findOne({ order: order._id, method: "cod" }).sort({ createdAt: -1 })) ||
    new Payment({
      order: order._id,
      orderCode: order.code,
      customer: order.customer,
      store: order.store,
      method: "cod",
      amount: order.pricing.total,
      provider: "none",
    });

  payment.status = "captured";
  payment.amountCaptured = order.pricing.total;
  payment.capturedAt = new Date();
  payment.codCollectedBy = actor?.id;
  payment.codCollectedAt = new Date();
  await payment.save();

  return payment;
}

/** Marks collected cash as handed in at the store, closing the loop. */
async function settleCod(paymentIds, actor) {
  const result = await Payment.updateMany(
    { _id: { $in: paymentIds }, method: "cod", codSettledAt: null },
    { codSettledAt: new Date() }
  );
  return { settled: result.modifiedCount, by: actor?.name };
}

/**
 * Refunds an order, in full or in part.
 *
 * Wallet refunds are instant and keep the money in the business; gateway
 * refunds take days. The destination defaults to whatever the admin configured
 * but can be overridden per refund.
 */
async function refund(order, { amount, reason, destination, items, actor } = {}) {
  const settings = await Settings.load();
  const payment = await Payment.findOne({ order: order._id, status: "captured" }).sort({ createdAt: -1 });

  const alreadyRefunded = order.payment.amountRefunded || 0;
  const paid = order.payment.amountPaid || 0;
  const maximum = paid - alreadyRefunded;

  const value = amount ? Math.min(amount, maximum) : maximum;
  if (value <= 0) throw ApiError.badRequest("There is nothing left to refund on this order");

  const target =
    destination ||
    (payment && payment.method !== "cod" && !settings.payment.autoRefundToWallet ? "source" : "wallet");

  const record = await Refund.create({
    order: order._id,
    orderCode: order.code,
    payment: payment?._id,
    customer: order.customer,
    amount: value,
    destination: target,
    reason: reason || "",
    items: items || [],
    requestedBy: actor?.id,
    requestedByName: actor?.name || "",
    status: "processing",
  });

  try {
    if (target === "wallet") {
      await walletService.credit(order.customer, value, {
        reason: "refund",
        note: reason || `Refund for ${order.code}`,
        order: order._id,
        orderCode: order.code,
        actor,
      });
    } else if (target === "source" && payment?.providerPaymentId) {
      const provider = gateways.resolve(payment.provider);
      const result = await provider.refund({
        providerPaymentId: payment.providerPaymentId,
        amount: value,
        notes: { orderCode: order.code, reason: reason || "" },
      });
      record.providerRefundId = result.providerRefundId;
      record.providerPayload = result.payload || {};
      record.provider = payment.provider;
    }
    // "cash" means the store hands notes back at the door — nothing to move
    // here, the record is the receipt.

    record.status = "completed";
    record.completedAt = new Date();
    await record.save();
  } catch (err) {
    record.status = "failed";
    record.failureReason = err.message;
    await record.save();
    throw ApiError.badRequest(`Refund failed: ${err.message}`);
  }

  // Keep the order's payment summary in step with the refund rows.
  order.payment.amountRefunded = alreadyRefunded + value;
  order.payment.status =
    order.payment.amountRefunded >= paid ? "refunded" : "partially_refunded";
  await order.save();

  if (payment) {
    payment.amountRefunded = (payment.amountRefunded || 0) + value;
    payment.status = payment.amountRefunded >= payment.amountCaptured ? "refunded" : "partially_refunded";
    await payment.save();
  }

  return record;
}

/** What the checkout screen should offer, given the store and the cart. */
async function availableMethods({ store, total, hasPhysicalItems = true }) {
  const settings = await Settings.load();
  const provider = await providerFor();
  const methods = [];

  if (settings.payment.codEnabled && store?.settings?.codEnabled && hasPhysicalItems) {
    const overLimit = total > (store.settings.maxCodValue || Infinity);
    methods.push({
      key: "cod",
      label: "Cash on delivery",
      available: !overLimit,
      reason: overLimit
        ? `Available up to ₹${((store.settings.maxCodValue || 0) / 100).toFixed(0)}`
        : null,
    });
  }

  const online = settings.payment.onlineEnabled && provider.name !== "none";
  for (const [key, label] of [["upi", "UPI"], ["card", "Card"], ["netbanking", "Net banking"]]) {
    methods.push({
      key,
      label,
      available: online,
      reason: online ? null : "Online payment is not set up yet",
    });
  }

  return { methods, provider: provider.name, online };
}

module.exports = {
  initiate,
  confirm,
  collectCod,
  settleCod,
  refund,
  availableMethods,
  providerFor,
};
