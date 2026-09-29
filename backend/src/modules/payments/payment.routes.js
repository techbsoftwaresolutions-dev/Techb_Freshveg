const express = require("express");
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
// re-serialised JSON would not hash to the same value.

router.post(
  "/webhook/:provider",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const provider = gateways.providers[req.params.provider];
    if (!provider?.verifyWebhook) return res.status(404).json({ success: false });

    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
    const signature = req.headers["x-razorpay-signature"] || req.headers["stripe-signature"];

    if (!provider.verifyWebhook(raw, signature)) {
      // Do not explain why — an attacker probing signatures learns nothing.
      return res.status(400).json({ success: false });
    }

    const event = JSON.parse(raw);
    const entity = event?.payload?.payment?.entity;

    if (entity?.order_id) {
      const payment = await Payment.findOne({ providerOrderId: entity.order_id });
      if (payment && payment.status !== "captured" && entity.status === "captured") {
        payment.status = "captured";
        payment.providerPaymentId = entity.id;
        payment.amountCaptured = entity.amount;
        payment.capturedAt = new Date();
        payment.providerPayload = entity;
        await payment.save();

        // The webhook may beat the customer back from the gateway, so this is
        // often what actually advances the order.
        const order = await Order.findById(payment.order);
        if (order && order.status === "PAYMENT_PENDING") {
          await orderService.transition(order, "PAYMENT_CONFIRMED", { role: "system" }, "Gateway webhook");
          await orderService.transition(order, "ORDER_CONFIRMED", { role: "system" });
        }
      }
    }

    // Always 200 once the signature is good: a gateway that gets an error
    // retries for hours.
    res.json({ success: true });
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

    const customer = await User.findById(req.user.id);
    const result = await paymentService.initiate(order, {
      method: req.body.method || order.payment.method,
      customer,
      idempotencyKey: req.body.idempotencyKey,
    });

    res.json({ success: true, payment: result.payment, checkout: result.checkout });
  })
);

// Called by the client after the gateway sheet closes. The signature is what
// makes this trustworthy — see gateways.razorpay.verify.
router.post(
  "/:paymentId/confirm",
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) throw ApiError.notFound("Payment not found");
    if (String(payment.customer) !== req.user.id) throw ApiError.forbidden("Not your payment");

    const confirmed = await paymentService.confirm(payment._id, {
      providerPaymentId: req.body.providerPaymentId,
      signature: req.body.signature,
    });

    const order = await Order.findById(confirmed.order);
    if (order && order.status === "PAYMENT_PENDING") {
      await orderService.transition(order, "PAYMENT_CONFIRMED", { role: "system" }, "Paid online");
      await orderService.transition(order, "ORDER_CONFIRMED", { role: "system" });
    }

    res.json({ success: true, payment: confirmed, order });
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
