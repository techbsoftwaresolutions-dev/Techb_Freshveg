const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const SupportTicket = require("./supportTicket.model");
const Order = require("../orders/order.model");
const User = require("../auth/user.model");
const paymentService = require("../payments/payment.service");
const notificationService = require("../notifications/notification.service");
const audit = require("../audit/audit.service");

const router = express.Router();
router.use(requireAuth);

const isStaff = (req) => req.user.permissions.includes("customers.view");

// Internal notes are staff-only, even on your own ticket.
function forCustomer(ticket) {
  const plain = ticket.toJSON();
  plain.messages = plain.messages.filter((m) => !m.internal);
  return plain;
}

// ---------------------------------------------------------------- customer

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      categories: SupportTicket.CATEGORIES.map((key) => ({
        key,
        label: key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      })),
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const customer = await User.findById(req.user.id);

    let order = null;
    if (req.body.order) {
      order = await Order.findById(req.body.order);
      if (!order) throw ApiError.notFound("Order not found");
      if (String(order.customer) !== req.user.id) throw ApiError.forbidden("Not your order");
    }

    const ticket = await SupportTicket.create({
      code: await SupportTicket.nextCode(),
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      order: order?._id,
      orderCode: order?.code || "",
      items: req.body.items || [],
      category: req.body.category,
      subject: req.body.subject,
      // Damaged or missing goods hold up a refund, so they jump the queue.
      priority: ["missing_product", "damaged_product", "payment_issue"].includes(req.body.category)
        ? "high"
        : "normal",
      messages: [
        {
          author: customer._id,
          authorName: customer.name,
          authorRole: "customer",
          body: req.body.message || req.body.subject,
          images: req.body.images || [],
        },
      ],
    });

    res.status(201).json({ success: true, ticket });
  })
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const result = await paginate(SupportTicket, { customer: req.user.id }, req.query, {
      defaultSort: { createdAt: -1 },
    });
    result.items = result.items.map(forCustomer);
    res.json({ success: true, ...result });
  })
);

router.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound("Ticket not found");

    const staff = isStaff(req);
    if (!staff && String(ticket.customer) !== req.user.id) throw ApiError.forbidden("Not your ticket");
    if (["resolved", "closed"].includes(ticket.status) && !staff) {
      throw ApiError.badRequest("This ticket is closed. Raise a new one if you still need help.");
    }

    ticket.messages.push({
      author: req.user.id,
      authorName: req.user.name,
      authorRole: staff ? req.user.role : "customer",
      body: req.body.body,
      images: req.body.images || [],
      internal: staff ? Boolean(req.body.internal) : false,
    });

    if (staff) {
      if (!ticket.firstResponseAt && !req.body.internal) ticket.firstResponseAt = new Date();
      if (ticket.status === "open") ticket.status = "in_progress";
      if (!req.body.internal) ticket.status = "waiting_customer";
    } else if (ticket.status === "waiting_customer") {
      ticket.status = "in_progress";
    }

    await ticket.save();

    if (staff && !req.body.internal) {
      await notificationService.notify(ticket.customer, "CUSTOM", {
        title: `Update on ${ticket.code}`,
        body: req.body.body.slice(0, 120),
      });
    }

    res.json({ success: true, ticket: staff ? ticket : forCustomer(ticket) });
  })
);

// ---------------------------------------------------------------- staff

const canView = requirePermission("customers.view");
const canManage = requirePermission("customers.manage");

router.get(
  "/",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.open === "true") filter.status = { $in: ["open", "in_progress", "waiting_customer"] };

    const result = await paginate(SupportTicket, filter, req.query, {
      defaultSort: { priority: -1, createdAt: -1 },
    });

    const counts = await SupportTicket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

    res.json({
      success: true,
      ...result,
      counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    });
  })
);

router.get(
  "/:id",
  canView,
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id).populate("order", "code status pricing items");
    if (!ticket) throw ApiError.notFound("Ticket not found");
    res.json({ success: true, ticket });
  })
);

router.patch(
  "/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound("Ticket not found");

    const before = audit.snapshot(ticket);

    for (const field of ["status", "priority", "assignedTo"]) {
      if (req.body[field] !== undefined) ticket[field] = req.body[field];
    }

    if (req.body.assignedTo) {
      const agent = await User.findById(req.body.assignedTo).select("name");
      ticket.assignedToName = agent?.name || "";
    }

    if (["resolved", "closed"].includes(ticket.status) && !ticket.closedAt) {
      ticket.closedAt = new Date();
      ticket.resolvedInMinutes = Math.round((ticket.closedAt - ticket.createdAt) / 60000);
    }

    await ticket.save();

    await audit.record({
      req, action: "update", entity: "SupportTicket", entityId: ticket._id,
      label: ticket.code, before, after: audit.snapshot(ticket),
    });

    res.json({ success: true, ticket });
  })
);

// Closing a ticket with money attached: the refund and the resolution are
// recorded together, so "what did we do about it" always has an amount next
// to it.
router.post(
  "/:id/resolve",
  canManage,
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound("Ticket not found");

    const { type = "explained", amount = 0, note = "" } = req.body;
    let refund = null;

    if (type === "refund" && amount > 0) {
      const order = await Order.findById(ticket.order);
      if (!order) throw ApiError.badRequest("This ticket has no order to refund");

      refund = await paymentService.refund(order, {
        amount,
        reason: note || `Support ticket ${ticket.code}`,
        items: ticket.items,
        actor: req.user,
      });
    }

    ticket.resolution = {
      type,
      amount: refund?.amount || amount || 0,
      note,
      refund: refund?._id,
      at: new Date(),
      by: req.user.id,
    };
    ticket.status = "resolved";
    ticket.closedAt = new Date();
    ticket.resolvedInMinutes = Math.round((ticket.closedAt - ticket.createdAt) / 60000);
    await ticket.save();

    await notificationService.notify(ticket.customer, "CUSTOM", {
      title: `${ticket.code} resolved`,
      body: refund
        ? `We've refunded ₹${(refund.amount / 100).toFixed(0)} to your wallet.`
        : note || "Your issue has been resolved.",
    });

    await audit.record({
      req, action: "resolve", entity: "SupportTicket", entityId: ticket._id,
      label: ticket.code,
      summary: `Resolved as ${type}${refund ? ` — refunded ₹${(refund.amount / 100).toFixed(2)}` : ""}`,
    });

    res.json({ success: true, ticket, refund });
  })
);

module.exports = router;
