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

// UPI here is manual collection (a VPA shown to the customer, no gateway
// round-trip) — same as cash on delivery, never routed through an online
// provider even if one happens to be configured. Everything else is online.
const isOnline = (method) => !["cod", "upi"].includes(method);

// Razorpay will not take less than ₹1.
const MIN_ONLINE_AMOUNT = 100;

/**
 * Why online payment cannot be offered right now, or null when it can. With no
 * gateway keys `providerFor` falls back to the manual provider, which must
 * never stand in for an online payment — it "verifies" anything.
 */
async function onlineUnavailableReason(total) {
  if ((await providerFor()) === gateways.manual) return "Online payment is not available right now";
  if (total < MIN_ONLINE_AMOUNT) return "Online payment needs an order of at least ₹1";
  return null;
}

/**
 * Opens a payment attempt for an order. For cash on delivery this just records
 * the intent; for an online method it asks the gateway to create its own order
 * and returns whatever the client needs to open a checkout sheet.
 *
 * A retry (sheet closed, page refreshed, a second tap) reuses the open gateway
 * order for the same amount rather than making another — Razorpay refuses a
 * second payment on a paid order, so one gateway order means one payment.
 */
async function initiate(order, { method, customer, idempotencyKey } = {}) {
  if (order.payment.status === "paid") {
    throw ApiError.conflict("This order is already paid");
  }

  // A retried request with the same key must not create a second attempt.
  if (idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) return { payment: existing, checkout: null };
  }

  const online = isOnline(method);
  if (online) {
    const reason = await onlineUnavailableReason(order.pricing.total);
    if (reason) throw ApiError.badRequest(reason);
  }
  const provider = online ? await providerFor() : gateways.manual;
  const brand = online ? (await Settings.load()).company?.name : undefined;

  if (online && provider.checkout) {
    const open = await Payment.findOne({
      order: order._id,
      provider: provider.name,
      status: { $in: ["created", "pending", "failed"] },
      amount: order.pricing.total,
      providerOrderId: { $ne: "" },
    }).sort({ createdAt: -1 });
    if (open) {
      const checkout = provider.checkout({
        providerOrderId: open.providerOrderId,
        amount: open.amount,
        orderCode: order.code,
        customer,
        brand,
      });
      return { payment: open, checkout };
    }
  }

  const attempts = await Payment.countDocuments({ order: order._id });

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
        brand,
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
 * Flips an attempt to captured — atomically, so when the customer's confirm,
 * the webhook and the reconciliation sweep all learn of the same payment at
 * once, exactly one of them gets the row back and goes on to settle the order.
 * The others get null.
 */
function markCaptured(paymentId, entity) {
  return Payment.findOneAndUpdate(
    { _id: paymentId, status: { $nin: ["captured", "refunded", "partially_refunded"] } },
    {
      $set: {
        status: "captured",
        providerPaymentId: entity.id,
        amountCaptured: entity.amount,
        capturedAt: new Date(),
        providerPayload: entity,
        failureReason: "",
      },
    },
    { new: true }
  );
}

/**
 * Confirms an online payment from what the checkout sheet handed the client.
 * The signature is checked against the gateway's secret, then the payment is
 * read back from the gateway — see gateways.razorpay.verify.
 *
 * Returns `{ payment, captured, pending }`: `captured` is true only for the one
 * call that moved the payment to captured (and so must settle the order);
 * `pending` means the gateway has not finished with it yet.
 */
async function confirm(paymentId, { providerPaymentId, signature, providerOrderId }) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status === "captured") return { payment, captured: false }; // already done; idempotent

  // Cash and UPI-to-VPA are confirmed by the store when the money is seen.
  // The manual provider "verifies" anything, so letting a customer reach it
  // here would hand out free orders.
  const provider = gateways.providers[payment.provider];
  if (!provider || provider === gateways.manual || !provider.configured) {
    throw ApiError.badRequest("This payment is confirmed by the store, not online");
  }
  if (providerOrderId && providerOrderId !== payment.providerOrderId) {
    throw ApiError.badRequest("This payment belongs to a different order");
  }

  const result = await provider.verify({
    providerOrderId: payment.providerOrderId,
    providerPaymentId,
    signature,
    amount: payment.amount,
  });

  if (!result.ok) {
    payment.failureReason = result.reason || "Verification failed";
    // Only the gateway saying "failed" fails the attempt. A bad signature is a
    // refused request, and the attempt stays open for a genuine payment.
    if (result.failed) {
      payment.status = "failed";
      payment.failedAt = new Date();
      payment.failureCode = result.payload?.error_code || "";
    }
    await payment.save();
    if (result.pending) return { payment, captured: false, pending: true };
    throw ApiError.badRequest(payment.failureReason);
  }

  const claimed = await markCaptured(payment._id, result.payload);
  return claimed
    ? { payment: claimed, captured: true }
    : { payment: await Payment.findById(payment._id), captured: false };
}

/**
 * Applies a verified gateway webhook. Returns the attempt it moved to captured
 * (the caller then settles the order), or null when there is nothing new —
 * which is also what a redelivered event gets.
 */
async function handleWebhook(event) {
  const entity = event?.payload?.payment?.entity;
  if (!entity?.order_id) return null;

  const payment = await Payment.findOne({ providerOrderId: entity.order_id });
  if (!payment) return null;

  if (["payment.captured", "order.paid"].includes(event.event) && entity.status === "captured") {
    if (entity.amount !== payment.amount || entity.currency !== "INR") {
      console.warn(`[payments] webhook amount mismatch on ${payment.orderCode}`);
      return null;
    }
    return markCaptured(payment._id, entity);
  }

  if (event.event === "payment.failed" && ["created", "pending"].includes(payment.status)) {
    // The customer may still retry inside the same sheet; a later capture
    // overrides this.
    payment.status = "failed";
    payment.failedAt = new Date();
    payment.failureCode = entity.error_code || "";
    payment.failureReason = entity.error_description || "Payment failed";
    await payment.save();
  }
  return null;
}

/**
 * Asks the gateway whether an order still awaiting payment was in fact paid —
 * for when the customer closed the tab before confirming and no webhook came.
 * Returns the captured attempt that should settle the order, or null.
 */
async function reconcile(order) {
  const attempts = await Payment.find({ order: order._id, providerOrderId: { $ne: "" } }).sort({ createdAt: -1 });

  // Captured already, but the order was never moved on (a crash in between).
  const done = attempts.find((attempt) => attempt.status === "captured");
  if (done) return done;

  for (const attempt of attempts) {
    const provider = gateways.providers[attempt.provider];
    if (!provider?.orderPayments || !provider.configured) continue;

    for (const entity of await provider.orderPayments(attempt.providerOrderId)) {
      if (!["captured", "authorized"].includes(entity.status)) continue;
      const result = await provider.settled(entity, {
        providerOrderId: attempt.providerOrderId,
        amount: attempt.amount,
      });
      if (result.ok) return markCaptured(attempt._id, result.payload);
    }
  }
  return null;
}

/**
 * Sends back money an order cannot take: it was cancelled while the customer
 * was paying, or another attempt had already paid it. The order's own payment
 * summary is left alone — this money was never counted against it.
 */
async function refundUnapplied(payment, reason) {
  const record = await Refund.create({
    order: payment.order,
    orderCode: payment.orderCode,
    payment: payment._id,
    customer: payment.customer,
    amount: payment.amountCaptured,
    destination: "source",
    reason,
    status: "processing",
  });

  try {
    const result = await gateways.providers[payment.provider].refund({
      providerPaymentId: payment.providerPaymentId,
      amount: payment.amountCaptured,
      notes: { orderCode: payment.orderCode, reason },
    });
    record.provider = payment.provider;
    record.providerRefundId = result.providerRefundId;
    record.providerPayload = result.payload || {};
    record.status = "completed";
    record.completedAt = new Date();
    payment.amountRefunded = payment.amountCaptured;
    payment.status = "refunded";
    await payment.save();
  } catch (err) {
    // Left as a failed refund row for the support desk to retry by hand.
    record.status = "failed";
    record.failureReason = err.message;
    console.warn(`[payments] refund of unapplied payment on ${payment.orderCode} failed:`, err.message);
  }
  await record.save();
  return record;
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

  // UPI is manual collection, not a gateway integration: a store sets its own
  // VPA in Admin → Stores, and it shows up here the moment that's saved. No
  // online provider needs to be configured for this to work.
  const upi = store?.settings?.upi;
  if (upi?.enabled && upi?.vpa) {
    methods.push({
      key: "upi",
      label: "UPI",
      available: true,
      vpa: upi.vpa,
      payeeName: upi.payeeName || store.name,
      reason: null,
    });
  }

  // The gateway, once the admin has switched it on and its keys are set.
  // Whatever the Razorpay account has enabled (UPI, cards, netbanking,
  // wallets) is offered inside its own sheet.
  if ((await providerFor()) !== gateways.manual) {
    const reason = await onlineUnavailableReason(total);
    methods.push({ key: "online", label: "Online payment (UPI / Razorpay)", available: !reason, reason });
  }

  return { methods };
}

module.exports = {
  isOnline,
  onlineUnavailableReason,
  initiate,
  confirm,
  handleWebhook,
  reconcile,
  refundUnapplied,
  collectCod,
  settleCod,
  refund,
  availableMethods,
  providerFor,
};
