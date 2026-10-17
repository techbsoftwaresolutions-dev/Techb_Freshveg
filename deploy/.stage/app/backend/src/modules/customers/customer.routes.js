const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, escapeRegex } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const User = require("../auth/user.model");
const Order = require("../orders/order.model");
const CustomerGroup = require("./customerGroup.model");
const walletService = require("../wallet/wallet.service");
const loyaltyService = require("../loyalty/loyalty.service");
const audit = require("../audit/audit.service");
const deletionService = require("../auth/accountDeletion.service");

const router = express.Router();
router.use(requireAuth);

const canView = requirePermission("customers.view");
const canManage = requirePermission("customers.manage");

// ---------------------------------------------------------------- customers

router.get(
  "/",
  canView,
  asyncHandler(async (req, res) => {
    // Erased accounts are tombstones for the order history, not customers.
    const filter = { role: "customer", status: { $ne: "deleted" } };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.group) {
      const group = await CustomerGroup.findById(req.query.group).select("members");
      filter._id = { $in: group?.members || [] };
    }
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
    }

    const result = await paginate(User, filter, req.query, {
      defaultSort: { createdAt: -1 },
      select: "name phone email status walletBalance loyaltyPoints referralCode createdAt lastLoginAt addresses",
    });

    // Order counts for the page being shown, rather than a lookup per row in
    // the client.
    const stats = await Order.aggregate([
      { $match: { customer: { $in: result.items.map((u) => u._id) } } },
      {
        $group: {
          _id: "$customer",
          orders: { $sum: 1 },
          spend: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, "$pricing.total", 0] } },
          lastOrderAt: { $max: "$placedAt" },
        },
      },
    ]);
    const byCustomer = new Map(stats.map((s) => [String(s._id), s]));

    res.json({
      success: true,
      ...result,
      items: result.items.map((user) => ({
        ...user.toJSON(),
        orders: byCustomer.get(user.id)?.orders || 0,
        totalSpend: byCustomer.get(user.id)?.spend || 0,
        lastOrderAt: byCustomer.get(user.id)?.lastOrderAt || null,
      })),
    });
  })
);

router.get(
  "/:id",
  canView,
  asyncHandler(async (req, res) => {
    const customer = await User.findOne({ _id: req.params.id, role: "customer" });
    if (!customer) throw ApiError.notFound("Customer not found");

    const [orders, wallet, loyalty] = await Promise.all([
      Order.find({ customer: customer._id }).sort({ placedAt: -1 }).limit(20),
      walletService.history(customer._id, { limit: 20 }),
      loyaltyService.history(customer._id, { limit: 20 }),
    ]);

    const delivered = orders.filter((o) => o.status === "DELIVERED");

    res.json({
      success: true,
      customer,
      orders,
      wallet,
      loyalty,
      stats: {
        orders: orders.length,
        delivered: delivered.length,
        cancelled: orders.filter((o) => ["CANCELLED", "REJECTED"].includes(o.status)).length,
        totalSpend: delivered.reduce((sum, o) => sum + (o.pricing?.total || 0), 0),
        averageOrder: delivered.length
          ? Math.round(delivered.reduce((sum, o) => sum + (o.pricing?.total || 0), 0) / delivered.length)
          : 0,
      },
    });
  })
);

router.patch(
  "/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const customer = await User.findOne({ _id: req.params.id, role: "customer" });
    if (!customer) throw ApiError.notFound("Customer not found");

    if (customer.status === "deleted") throw ApiError.conflict("This account has been deleted and can't be changed");
    const before = audit.snapshot(customer);

    // Balances are ledger-owned; blocking is the one thing staff set directly.
    for (const field of ["name", "email", "status"]) {
      if (req.body[field] !== undefined) customer[field] = req.body[field];
    }
    await customer.save();

    await audit.record({
      req, action: "update", entity: "Customer", entityId: customer._id,
      label: customer.name || customer.phone, before, after: audit.snapshot(customer),
    });

    res.json({ success: true, customer });
  })
);

// Deletion on a customer's behalf, for a request that arrived by email or
// phone (they lost the number, say). The same checks and the same erasure as
// the in-app route; account managers only, never routine support staff.
router.post(
  "/:id/erase",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const customer = await User.findOne({ _id: req.params.id, role: "customer" });
    if (!customer) throw ApiError.notFound("Customer not found");
    if (String(req.body.confirm || "").trim().toUpperCase() !== "DELETE") throw ApiError.badRequest("Type DELETE to confirm");
    if (!String(req.body.note || "").trim()) {
      throw ApiError.unprocessable("Record the request", { note: "Say how the customer asked (email, call) and how you checked it was them" });
    }

    const deletion = await deletionService.eraseCustomer(customer, {
      source: "admin", reason: req.body.note, acknowledge: req.body.acknowledge === true, actor: req.user,
    });
    await audit.record({
      req, action: "erase", entity: "Customer", entityId: customer._id, label: deletion.reference,
      summary: `Customer account erased on request (${deletion.reference})`,
    });
    res.json({ success: true, message: `Customer erased. Reference ${deletion.reference}.`, deletion });
  })
);

// Manual wallet and points adjustments — goodwill, corrections, promotions.
// Both go through their ledgers, so an adjustment is as explainable as a refund.
router.post(
  "/:id/wallet",
  canManage,
  asyncHandler(async (req, res) => {
    const amount = Math.round(Number(req.body.amount));
    if (!amount) throw ApiError.badRequest("An amount in paise is required");
    if (!req.body.note) throw ApiError.badRequest("A note is required for a manual adjustment");

    const result = await walletService.apply(req.params.id, amount, {
      reason: "adjustment",
      note: req.body.note,
      actor: req.user,
    });

    await audit.record({
      req, action: "adjust", entity: "Customer", entityId: req.params.id,
      summary: `Wallet ${amount > 0 ? "credited" : "debited"} ₹${Math.abs(amount / 100).toFixed(2)} — ${req.body.note}`,
    });

    res.json({ success: true, ...result });
  })
);

router.post(
  "/:id/loyalty",
  canManage,
  asyncHandler(async (req, res) => {
    const points = Math.round(Number(req.body.points));
    if (!points) throw ApiError.badRequest("A number of points is required");
    if (!req.body.note) throw ApiError.badRequest("A note is required for a manual adjustment");

    const result = await loyaltyService.apply(req.params.id, points, {
      reason: "adjustment",
      note: req.body.note,
      actor: req.user,
    });

    await audit.record({
      req, action: "adjust", entity: "Customer", entityId: req.params.id,
      summary: `Loyalty ${points > 0 ? "credited" : "debited"} ${Math.abs(points)} points — ${req.body.note}`,
    });

    res.json({ success: true, ...result });
  })
);

// ---------------------------------------------------------------- groups

router.get(
  "/groups/all",
  canView,
  asyncHandler(async (req, res) => {
    const groups = await CustomerGroup.find({ status: "active" }).sort({ name: 1 });
    res.json({ success: true, groups });
  })
);

router.post(
  "/groups",
  canManage,
  asyncHandler(async (req, res) => {
    const group = await CustomerGroup.create(req.body);
    await audit.record({ req, action: "create", entity: "CustomerGroup", entityId: group._id, label: group.name });
    res.status(201).json({ success: true, group });
  })
);

/**
 * Recomputes a dynamic group from its rules.
 *
 * Done on demand rather than on every read: "customers who spent over ₹5,000"
 * is an aggregation over the whole order history, not something to run when
 * someone opens a dropdown.
 */
router.post(
  "/groups/:id/recompute",
  canManage,
  asyncHandler(async (req, res) => {
    const group = await CustomerGroup.findById(req.params.id);
    if (!group) throw ApiError.notFound("Group not found");
    if (group.kind !== "dynamic") throw ApiError.badRequest("This group is hand-picked, not rule-based");

    const { minOrders, minSpend, lastOrderWithinDays, inactiveForDays, pincodes } = group.rules;

    const stats = await Order.aggregate([
      { $match: { status: "DELIVERED" } },
      {
        $group: {
          _id: "$customer",
          orders: { $sum: 1 },
          spend: { $sum: "$pricing.total" },
          lastOrderAt: { $max: "$placedAt" },
        },
      },
    ]);

    const now = Date.now();
    let members = stats.filter((row) => {
      if (minOrders && row.orders < minOrders) return false;
      if (minSpend && row.spend < minSpend) return false;
      if (lastOrderWithinDays) {
        const days = (now - new Date(row.lastOrderAt)) / 86400000;
        if (days > lastOrderWithinDays) return false;
      }
      if (inactiveForDays) {
        const days = (now - new Date(row.lastOrderAt)) / 86400000;
        if (days < inactiveForDays) return false;
      }
      return true;
    });

    if (pincodes?.length) {
      const inArea = await User.find({
        _id: { $in: members.map((m) => m._id) },
        "addresses.pincode": { $in: pincodes },
      }).select("_id");
      const allowed = new Set(inArea.map((u) => u.id));
      members = members.filter((m) => allowed.has(String(m._id)));
    }

    group.members = members.map((m) => m._id);
    group.memberCount = group.members.length;
    group.lastComputedAt = new Date();
    await group.save();

    res.json({ success: true, group, matched: group.memberCount });
  })
);

module.exports = router;
