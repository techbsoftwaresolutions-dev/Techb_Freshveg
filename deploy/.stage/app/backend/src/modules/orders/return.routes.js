const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Order = require("./order.model");
const Product = require("../catalog/product.model");
const orderService = require("./order.service");
const paymentService = require("../payments/payment.service");
const { resolveCategorySchema } = require("../catalog/schema.service");
const audit = require("../audit/audit.service");

const router = express.Router();
router.use(requireAuth);

// Returns ride on the same state machine as everything else — RETURN_REQUESTED
// through REFUNDED are states an order moves into, not a parallel workflow.

// Used only when no category can be consulted. Every seeded department sets
// its own window, so reaching this is a signal, not the normal path.
const DEFAULT_RETURN_WINDOW_DAYS = 7;

/**
 * Whether an order can still be returned, and which of its lines qualify.
 *
 * The window and the right to return at all come from each item's category:
 * a bag of rice is returnable for a week, fresh milk is not returnable at all.
 * Nothing here names a category.
 */
async function returnability(order) {
  if (order.status !== "DELIVERED") {
    return { eligible: false, reason: "Only delivered orders can be returned", items: [] };
  }

  const deliveredAt = order.delivery?.deliveredAt;
  const items = [];

  for (const item of order.items) {
    if (item.itemStatus === "returned") continue;

    let features = {};
    let windowDays = null;
    // True when no category could be consulted, so the answer below is a
    // fallback rather than this item's actual policy. Worth carrying in the
    // response: a screen that shows "7 days" should not imply a category said
    // so when nothing did.
    let usedFallback = false;

    try {
      const schema = await resolveCategorySchema(item.category);
      features = schema.features;
      windowDays = schema.defaults.returnWindowDays;
    } catch {
      // A category that has since been removed, or an order placed before the
      // category was snapshotted onto its lines, should not block a return.
      features = { returnable: true };
      usedFallback = true;
    }

    if (!features.returnable) {
      items.push({
        orderItem: item.id, name: item.name, eligible: false,
        reason: "This item cannot be returned",
      });
      continue;
    }

    const days = windowDays ?? DEFAULT_RETURN_WINDOW_DAYS;
    const elapsed = deliveredAt ? (Date.now() - new Date(deliveredAt)) / 86400000 : 0;

    items.push({
      orderItem: item.id,
      name: item.name,
      variantName: item.variantName,
      quantity: item.quantity,
      amount: item.payable,
      eligible: elapsed <= days,
      windowDays: days,
      byDefault: usedFallback || windowDays == null,
      daysLeft: Math.max(0, Math.ceil(days - elapsed)),
      reason: elapsed > days ? `The ${days}-day return window has passed` : null,
    });
  }

  return {
    eligible: items.some((i) => i.eligible),
    items,
    reason: items.some((i) => i.eligible) ? null : "Nothing on this order is still returnable",
  };
}

// ---------------------------------------------------------------- customer

router.get(
  "/orders/:id/returnable",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    if (String(order.customer) !== req.user.id) throw ApiError.forbidden("Not your order");

    res.json({ success: true, ...(await returnability(order)) });
  })
);

router.post(
  "/orders/:id/request",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    if (String(order.customer) !== req.user.id) throw ApiError.forbidden("Not your order");

    const check = await returnability(order);
    if (!check.eligible) throw ApiError.badRequest(check.reason || "This order cannot be returned");

    const requested = req.body.items || [];
    if (!requested.length) throw ApiError.badRequest("Choose at least one item to return");

    const eligibleIds = new Set(check.items.filter((i) => i.eligible).map((i) => String(i.orderItem)));
    for (const line of requested) {
      if (!eligibleIds.has(String(line.orderItem))) {
        throw ApiError.badRequest("One of those items is not eligible for return");
      }
    }

    // Marked per line so a partial return is visible on the order itself.
    for (const line of requested) {
      const item = order.items.id(line.orderItem);
      if (item) item.itemStatus = "returned";
    }

    order.internalNote = [order.internalNote, `Return requested: ${req.body.reason || "no reason given"}`]
      .filter(Boolean)
      .join("\n");

    await orderService.transition(
      order,
      "RETURN_REQUESTED",
      { id: req.user.id, name: req.user.name, role: "customer" },
      req.body.reason || "Return requested"
    );

    res.json({ success: true, order });
  })
);

// ---------------------------------------------------------------- staff

const canView = requirePermission("orders.view");
const canManage = requirePermission("orders.manage");

router.get(
  "/",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {
      status: { $in: ["RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_PICKED", "REFUNDED"] },
    };
    if (req.query.status) filter.status = req.query.status;

    const result = await paginate(Order, filter, req.query, { defaultSort: { updatedAt: -1 } });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/orders/:id/approve",
  canManage,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    await orderService.transition(order, "RETURN_APPROVED", req.user, req.body.note || "Return approved");
    await audit.record({
      req, action: "approve", entity: "Return", entityId: order._id,
      label: order.code, summary: `Return approved${req.body.note ? ` — ${req.body.note}` : ""}`,
    });

    res.json({ success: true, order });
  })
);

router.post(
  "/orders/:id/decline",
  canManage,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    // The state machine allows RETURN_REQUESTED back to DELIVERED — a declined
    // return leaves the order exactly as it was.
    for (const item of order.items) {
      if (item.itemStatus === "returned") item.itemStatus = "picked";
    }

    await orderService.transition(
      order, "DELIVERED", req.user,
      req.body.reason || "Return declined"
    );

    res.json({ success: true, order });
  })
);

// The goods are back. Stock goes with them, and the refund follows.
router.post(
  "/orders/:id/collected",
  canManage,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    await orderService.transition(order, "RETURN_PICKED", req.user, req.body.note || "Return collected");

    if (req.body.restock !== false) {
      const inventoryService = require("../inventory/inventory.service");
      const returned = order.items.filter((i) => i.itemStatus === "returned");
      for (const item of returned) {
        // Only what is actually resaleable goes back on the shelf; the rest is
        // recorded as damaged so the loss is visible rather than absorbed.
        const damaged = (req.body.damaged || []).some((d) => String(d) === String(item.id));
        const quantity = item.pickedQuantity ?? item.quantity;

        if (damaged) {
          await inventoryService.writeOffDamage(order.store, item.variant, quantity, {
            refType: "return", refId: order._id, refCode: order.code,
            reason: "Returned damaged", actor: req.user,
          });
        } else {
          await inventoryService.receive(order.store, item.variant, quantity, {
            refType: "return", refId: order._id, refCode: order.code,
            reason: "Returned to stock", actor: req.user,
          });
        }
      }
    }

    res.json({ success: true, order });
  })
);

router.post(
  "/orders/:id/refund",
  canManage,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    // Default to the value of the returned lines rather than the whole order —
    // a partial return should not refund everything.
    const returned = order.items.filter((i) => i.itemStatus === "returned");
    const amount = req.body.amount ?? returned.reduce((sum, i) => sum + (i.payable || 0), 0);

    const refund = await paymentService.refund(order, {
      amount,
      reason: req.body.reason || `Return on ${order.code}`,
      destination: req.body.destination,
      items: returned.map((i) => ({
        orderItem: i.id, name: i.name, quantity: i.quantity, amount: i.payable,
      })),
      actor: req.user,
    });

    await orderService.transition(order, "REFUNDED", req.user, req.body.reason || "Return refunded");

    res.json({ success: true, order, refund });
  })
);

module.exports = router;
