const express = require("express");
const QRCode = require("qrcode");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Payment = require("./payment.model");
const Refund = require("./refund.model");
const Order = require("../orders/order.model");
const Store = require("../stores/store.model");
const User = require("../auth/user.model");
const paymentService = require("./payment.service");
const orderService = require("../orders/order.service");
const gateways = require("./gateways");
const audit = require("../audit/audit.service");

const router = express.Router();

// ---------------------------------------------------------------- webhook
//
// Mounted before requireAuth: a gateway has no bearer token. Authenticity is
// established by the signature instead, which is why the raw body matters —
// re-serialised JSON would not hash to the same value. app.js keeps the exact
// bytes on req.rawBody for /webhook paths (the JSON parser has already run by
// the time a route sees the request).

router.post(
  "/webhook/:provider",
  asyncHandler(async (req, res) => {
    const provider = gateways.providers[req.params.provider];
    if (!provider?.verifyWebhook) return res.status(404).json({ success: false });

    const raw = req.rawBody;
    const signature = req.headers["x-razorpay-signature"];

    if (!raw || !provider.verifyWebhook(raw, signature)) {
      // Do not explain why — an attacker probing signatures learns nothing.
      return res.status(400).json({ success: false });
    }

    // The webhook may beat the customer back from the gateway, so this is
    // often what actually advances the order. A redelivered event finds the
    // payment already captured and does nothing.
    const captured = await paymentService.handleWebhook(JSON.parse(raw.toString("utf8")));
    if (captured) await orderService.applyCapturedPayment(captured, "Paid online (gateway webhook)");

    // 200 once handled. A database error above surfaces as a 500 instead, so
    // the gateway retries rather than the event being lost.
    res.json({ success: true });
  })
);

// A UPI payment QR for a store, sized to the order amount — public in the
// same way the store's own VPA already is (returned by GET /stores/public):
// it is meant to be shown to a customer, like a QR taped to a shop counter,
// not a credential that needs a session behind it.
router.get(
  "/upi-qr",
  asyncHandler(async (req, res) => {
    const store = await Store.findById(req.query.store).catch(() => null);
    const upi = store?.settings?.upi;
    if (!upi?.enabled || !upi?.vpa) {
      throw ApiError.notFound("UPI is not set up for this store yet");
    }

    const amountPaise = Math.max(0, Number(req.query.amount) || 0);
    const payee = upi.payeeName || store.name;
    const params = new URLSearchParams({
      pa: upi.vpa,
      pn: payee,
      cu: "INR",
      tn: "Order payment",
    });
    if (amountPaise > 0) params.set("am", (amountPaise / 100).toFixed(2));

    const png = await QRCode.toBuffer(`upi://pay?${params.toString()}`, {
      type: "png",
      width: 320,
      margin: 1,
      color: { dark: "#135c2b", light: "#ffffff" },
    });

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-store");
    res.send(png);
  })
);

router.use(requireAuth);

// ---------------------------------------------------------------- customer

router.get(
  "/methods",
  asyncHandler(async (req, res) => {
    const store = await Store.findById(req.query.store).catch(() => null);
    const result = await paymentService.availableMethods({
      store: store || (await Store.findOne({ status: "active" }).sort({ isDefault: -1 })),
      total: Number(req.query.total) || 0,
    });
    res.json({ success: true, ...result });
  })
);

// Starts (or retries) payment for an order the customer already placed.
router.post(
  "/orders/:orderId/initiate",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);
    if (!order) throw ApiError.notFound("Order not found");
    if (String(order.customer) !== req.user.id) throw ApiError.forbidden("Not your order");

    // Only an order still waiting for its payment can be paid; the method is
    // the one the order was placed with, not whatever the request says.
    if (order.status !== "PAYMENT_PENDING") {
      throw ApiError.conflict(order.payment.status === "paid" ? "This order is already paid" : "This order is no longer awaiting payment");
    }

    const customer = await User.findById(req.user.id);
    const { payment, checkout } = await paymentService.initiate(order, {
      method: order.payment.method,
      customer,
      idempotencyKey: req.body.idempotencyKey,
    });

    res.json({
      success: true,
      payment: { id: payment.id, status: payment.status, amount: payment.amount, currency: payment.currency },
      checkout,
    });
  })
);

// Called by the client when the gateway sheet reports success. The signature
// and a read-back from the gateway are what make this trustworthy — see
// gateways.razorpay.verify. Answers 200 once paid, 202 while the gateway is
// still settling (the webhook or the reconciliation sweep finishes the job).
router.post(
  "/:paymentId/confirm",
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.paymentId).catch(() => null);
    if (!payment) throw ApiError.notFound("Payment not found");
    if (String(payment.customer) !== req.user.id) throw ApiError.forbidden("Not your payment");

    const result = await paymentService.confirm(payment._id, {
      providerPaymentId: req.body.providerPaymentId,
      signature: req.body.signature,
      providerOrderId: req.body.providerOrderId,
    });
    if (result.captured) await orderService.applyCapturedPayment(result.payment, "Paid online");

    const order = await Order.findById(payment.order);
    const paid = order?.payment.status === "paid" && order.payment.transactionId === result.payment.providerPaymentId;
    if (!paid && result.payment.status === "refunded") {
      throw ApiError.conflict("This order could not take your payment, so it is being refunded to you");
    }
    res.status(paid ? 200 : 202).json({
      success: true,
      paid,
      pending: !paid,
      order: order ? { id: order.id, code: order.code, status: order.status, payment: { status: order.payment.status } } : null,
    });
  })
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const result = await paginate(Payment, { customer: req.user.id }, req.query, {
      defaultSort: { createdAt: -1 },
      select: "-providerPayload -providerSignature",
    });
    res.json({ success: true, ...result });
  })
);

// ---------------------------------------------------------------- admin

const canView = requirePermission("orders.view");
const canManage = requirePermission("orders.manage");

router.get(
  "/",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.method) filter.method = { $in: String(req.query.method).split(",") };
    if (req.query.store) filter.store = req.query.store;
    if (req.query.search) filter.orderCode = new RegExp(String(req.query.search), "i");
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const result = await paginate(Payment, filter, req.query, { defaultSort: { createdAt: -1 } });

    // The totals a finance screen needs, over the same filter rather than the
    // current page.
    const [totals] = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          captured: { $sum: "$amountCaptured" },
          refunded: { $sum: "$amountRefunded" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      ...result,
      totals: totals || { captured: 0, refunded: 0, count: 0 },
    });
  })
);

// Cash a partner is holding but has not handed in.
router.get(
  "/cod/outstanding",
  canView,
  asyncHandler(async (req, res) => {
    const outstanding = await Payment.find({
      method: "cod",
      status: "captured",
      codSettledAt: null,
    })
      .populate("codCollectedBy", "name phone")
      .sort({ codCollectedAt: 1 });

    const byPartner = new Map();
    for (const payment of outstanding) {
      const key = payment.codCollectedBy?.id || "unassigned";
      const entry = byPartner.get(key) || {
        partner: payment.codCollectedBy
          ? { id: payment.codCollectedBy.id, name: payment.codCollectedBy.name, phone: payment.codCollectedBy.phone }
          : null,
        orders: 0,
        amount: 0,
        paymentIds: [],
      };
      entry.orders += 1;
      entry.amount += payment.amountCaptured;
      entry.paymentIds.push(payment.id);
      byPartner.set(key, entry);
    }

    res.json({
      success: true,
      partners: [...byPartner.values()],
      total: outstanding.reduce((sum, p) => sum + p.amountCaptured, 0),
    });
  })
);

router.post(
  "/cod/settle",
  canManage,
  asyncHandler(async (req, res) => {
    const result = await paymentService.settleCod(req.body.paymentIds || [], req.user);
    await audit.record({
      req,
      action: "settle",
      entity: "Payment",
      summary: `Settled ${result.settled} cash payment(s)`,
    });
    res.json({ success: true, ...result });
  })
);

router.get(
  "/refunds",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const result = await paginate(Refund, filter, req.query, { defaultSort: { createdAt: -1 } });
    res.json({ success: true, ...result });
  })
);

// Manual refund, in full or in part — the support desk's main lever.
router.post(
  "/orders/:orderId/refund",
  canManage,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);
    if (!order) throw ApiError.notFound("Order not found");

    const refund = await paymentService.refund(order, {
      amount: req.body.amount,
      reason: req.body.reason,
      destination: req.body.destination,
      items: req.body.items,
      actor: req.user,
    });

    await audit.record({
      req,
      action: "refund",
      entity: "Order",
      entityId: order._id,
      label: order.code,
      summary: `Refunded ₹${(refund.amount / 100).toFixed(2)} to ${refund.destination}${
        req.body.reason ? ` — ${req.body.reason}` : ""
      }`,
    });

    res.json({ success: true, refund, order });
  })
);

module.exports = router;
