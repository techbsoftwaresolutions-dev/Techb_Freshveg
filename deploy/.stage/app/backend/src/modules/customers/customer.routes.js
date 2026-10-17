const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, escapeRegex } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const User = require("../auth/user.model");
const Order = require("../orders/order.model");
const CustomerGroup = require("./customerGroup.model");
const Review = require("../reviews/review.model");
const SupportTicket = require("../support/supportTicket.model");
const WalletTransaction = require("../wallet/walletTransaction.model");
const LoyaltyTransaction = require("../loyalty/loyaltyTransaction.model");
const Cart = require("../cart/cart.model");
const Wishlist = require("../wishlist/wishlist.model");
const Notification = require("../notifications/notification.model");
const Otp = require("../auth/otp.model");
const Referral = require("../referrals/referral.model");
const walletService = require("../wallet/wallet.service");
const loyaltyService = require("../loyalty/loyalty.service");
const audit = require("../audit/audit.service");

const router = express.Router();
router.use(requireAuth);

const canView = requirePermission("customers.view");
const canManage = requirePermission("customers.manage");

// ---------------------------------------------------------------- customers

router.get(
  "/",
  canView,
  asyncHandler(async (req, res) => {
    const filter = { role: "customer" };
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

    const before = audit.snapshot(customer);
    const body = req.body || {};

    // Balances are ledger-owned; staff set identity details and blocking.
    if (body.name !== undefined) customer.name = String(body.name).trim();

    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw ApiError.badRequest("Enter a valid email address");
      }
      customer.email = email;
    }

    if (body.phone !== undefined) {
      const phone = String(body.phone).replace(/\D/g, "");
      if (!/^\d{10}$/.test(phone)) throw ApiError.badRequest("Phone must be 10 digits");
      if (phone !== customer.phone) {
        const taken = await User.exists({ phone, role: "customer", _id: { $ne: customer._id } });
        if (taken) throw ApiError.conflict("Another customer already uses this phone number");
        customer.phone = phone;
      }
    }

    if (body.status !== undefined) {
      if (!["active", "blocked"].includes(body.status)) throw ApiError.badRequest("Status must be active or blocked");
      customer.status = body.status;
    }

    await customer.save();

    await audit.record({
      req, action: "update", entity: "Customer", entityId: customer._id,
      label: customer.name || customer.phone, before, after: audit.snapshot(customer),
    });

    res.json({ success: true, customer });
  })
);

// Deleting a customer is only allowed while nothing else points at them.
// Orders, payments, reviews and tickets are business records that must keep
// their customer, so an account with any of those is blocked instead — which
// stops the login and keeps the history intact. What does get removed with the
// account is the account's own clutter: wallet and points ledgers, cart,
// wishlist, notifications and its place in customer groups.
router.delete(
  "/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const customer = await User.findOne({ _id: req.params.id, role: "customer" });
    if (!customer) throw ApiError.notFound("Customer not found");

    const [orders, reviews, tickets] = await Promise.all([
      Order.countDocuments({ customer: customer._id }),
      Review.countDocuments({ customer: customer._id }),
      SupportTicket.countDocuments({ customer: customer._id }),
    ]);
    if (orders || reviews || tickets) {
      const parts = [
        orders ? `${orders} order${orders === 1 ? "" : "s"}` : null,
        reviews ? `${reviews} review${reviews === 1 ? "" : "s"}` : null,
        tickets ? `${tickets} support ticket${tickets === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      throw ApiError.conflict(
        `${customer.name || customer.phone} has ${parts.join(", ")}, so the account can't be deleted. Block it instead to stop sign-ins and keep the history.`
      );
    }

    const snapshot = audit.snapshot(customer);

    await Promise.all([
      WalletTransaction.deleteMany({ user: customer._id }),
      LoyaltyTransaction.deleteMany({ user: customer._id }),
      Cart.deleteMany({ customer: customer._id }),
      Wishlist.deleteMany({ customer: customer._id }),
      Notification.deleteMany({ user: customer._id }),
      Otp.deleteMany({ phone: customer.phone, role: "customer" }),
      CustomerGroup.updateMany({ members: customer._id }, { $pull: { members: customer._id } }),
      Referral.deleteMany({ $or: [{ referrer: customer._id }, { referee: customer._id }] }),
      User.updateMany({ referredBy: customer._id }, { $unset: { referredBy: 1 } }),
    ]);
    await customer.deleteOne();

    await audit.record({
      req, action: "delete", entity: "Customer", entityId: customer._id,
      label: customer.name || customer.phone, before: snapshot,
      summary: `Customer deleted (wallet ₹${((customer.walletBalance || 0) / 100).toFixed(2)}, ${customer.loyaltyPoints || 0} points removed)`,
    });

    res.json({ success: true });
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
