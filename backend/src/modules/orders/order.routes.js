const express = require("express");
const { dateBounds } = require("../../core/dateRange");
const QRCode = require("qrcode");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const {
  requireAuth,
  requirePermission,
  requireAnyPermission,
  requireRole,
} = require("../../middleware/auth");

const Order = require("./order.model");
const User = require("../auth/user.model");
const Store = require("../stores/store.model");
const orderService = require("./order.service");
const audit = require("../audit/audit.service");
const { STATUSES, allowedTransitions, buildTimeline, describeAction } = require("./orderStatus");

const router = express.Router();
router.use(requireAuth);

// Orders keep a snapshot of each item's photo, but ones placed before photos
// were snapshotted (or whose product had none then) come back empty. Fill
// those from the product's current photo so the order list never shows a hole.
async function fillMissingItemImages(orders) {
  const missing = new Set();
  for (const order of orders) {
    for (const line of order.items || []) {
      if (!line.image && line.product) missing.add(String(line.product));
    }
  }
  if (!missing.size) return;

  const Product = require("../catalog/product.model");
  const products = await Product.find({ _id: { $in: [...missing] } })
    .select("media")
    .lean();
  const imageOf = new Map(
    products.map((p) => [
      String(p._id),
      (p.media || []).find((m) => m.type === "image")?.url || p.media?.[0]?.url || "",
    ])
  );

  for (const order of orders) {
    for (const line of order.items || []) {
      if (!line.image && line.product) line.image = imageOf.get(String(line.product)) || "";
    }
  }
}

// What the customer's handover QR encodes. The rider scans it before entering
// the OTP, which proves they are standing at the right order.
const orderQrValue = (order) => `HBORDER:${order.code}`;

// The whole status table, so the admin and delivery apps build their action
// buttons from the engine rather than hardcoding a copy of it.
router.get(
  "/statuses",
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      statuses: Object.entries(STATUSES).map(([key, def]) => ({ key, ...def })),
    });
  })
);

// ---------------------------------------------------------------- customer

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const order = await orderService.placeOrder({
      cartId: req.body.cart,
      userId: req.user.id,
      addressId: req.body.address,
      paymentMethod: req.body.paymentMethod || "cod",
      slot: req.body.slot,
      note: req.body.note,
      source: req.body.source || "app",
    });
    res.status(201).json({ success: true, order, tracking: orderService.trackingView(order) });
  })
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const filter = { customer: req.user.id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.open === "true") {
      filter.status = { $nin: ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"] };
    }

    const result = await paginate(Order, filter, req.query, { defaultSort: { placedAt: -1 } });
    await fillMissingItemImages(result.items);
    res.json({ success: true, ...result });
  })
);

router.get(
  "/:id/track",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    // A customer may only track their own order; staff may track any.
    const isOwner = String(order.customer) === req.user.id;
    if (!isOwner && !req.user.permissions.includes("orders.view")) {
      throw ApiError.forbidden("Not your order");
    }

    const tracking = orderService.trackingView(order);
    // The QR is only handed out while the rider can actually use it (the same
    // window as the OTP), and only to the order's owner.
    if (tracking.otp && isOwner) {
      tracking.qr = await QRCode.toDataURL(orderQrValue(order), { width: 280, margin: 1 });
    }

    res.json({ success: true, tracking });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    if (String(order.customer) !== req.user.id) throw ApiError.forbidden("Not your order");

    await orderService.transition(
      order,
      "CANCELLED",
      { id: req.user.id, name: req.user.name, role: "customer" },
      req.body.reason || "Cancelled by customer"
    );
    res.json({ success: true, order });
  })
);

router.post(
  "/:id/rate",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    if (String(order.customer) !== req.user.id) throw ApiError.forbidden("Not your order");
    if (order.status !== "DELIVERED") throw ApiError.badRequest("You can rate an order once it is delivered");

    order.rating = { ...req.body, ratedAt: new Date() };
    await order.save();
    res.json({ success: true, order });
  })
);

// ---------------------------------------------------------------- staff

router.get(
  "/",
  requirePermission("orders.view"),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.store) filter.store = req.query.store;
    if (req.query.partner) filter["delivery.partner"] = req.query.partner;
    if (req.query.paymentStatus) filter["payment.status"] = req.query.paymentStatus;
    const placed = dateBounds(req.query.from, req.query.to);
    if (placed) filter.placedAt = placed;

    const result = await paginate(Order, filter, req.query, { defaultSort: { placedAt: -1 } });
    res.json({ success: true, ...result });
  })
);

router.get(
  "/:id",
  requirePermission("orders.view"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    res.json({
      success: true,
      order,
      timeline: buildTimeline(order.status, order.statusHistory),
      // Exactly the moves this user may make from here.
      actions: allowedTransitions(order.status, req.user.role).map(describeAction),
    });
  })
);

router.post(
  "/:id/status",
  // A delivery partner reaches this endpoint too; the state machine decides
  // which transitions their role may actually make.
  requireAnyPermission("orders.manage", "delivery.fulfil"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    await orderService.transition(
      order,
      req.body.status,
      { id: req.user.id, name: req.user.name, role: req.user.role },
      req.body.note || ""
    );

    res.json({
      success: true,
      order,
      actions: allowedTransitions(order.status, req.user.role).map(describeAction),
    });
  })
);

// Records what was actually put in the bag. Loose produce rarely matches the
// ordered weight exactly, so the picked quantity is what gets billed.
router.post(
  "/:id/pick",
  // Picking happens in the store, so this one stays store-side only.
  requirePermission("orders.manage"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    for (const picked of req.body.items || []) {
      const item = order.items.id(picked.item);
      if (!item) continue;
      item.pickedQuantity = picked.quantity;
      item.pickedBatchNo = picked.batchNo || "";
      item.itemStatus = picked.quantity > 0 ? "picked" : "unavailable";
    }
    await order.save();
    res.json({ success: true, order });
  })
);

// Items that cannot go out with the rest of the order and will come on a later
// day. The customer is told straight away (push, SMS and in-app), and the order
// page shows those lines as "arriving <date>".
router.post(
  "/:id/delay-items",
  requirePermission("orders.manage"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    if (["CANCELLED", "REJECTED", "REFUNDED"].includes(order.status)) {
      throw ApiError.badRequest("This order is closed — nothing can be delayed");
    }

    const day = String(req.body.expectedOn || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw ApiError.badRequest("Choose the new delivery date");
    const expectedOn = new Date(`${day}T00:00:00+05:30`);
    const todayIst = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T00:00:00+05:30`);
    if (Number.isNaN(expectedOn.getTime()) || expectedOn < todayIst) {
      throw ApiError.badRequest("The new delivery date can't be in the past");
    }

    const ids = Array.isArray(req.body.items) ? req.body.items.map(String) : [];
    const chosen = ids.map((id) => order.items.id(id)).filter(Boolean);
    if (!chosen.length) throw ApiError.badRequest("Select at least one item");
    if (chosen.some((item) => item.deferred?.deliveredAt)) {
      throw ApiError.badRequest("An item you picked has already been delivered");
    }

    const reason = String(req.body.reason || "").trim().slice(0, 120);
    for (const item of chosen) {
      item.deferred = {
        expectedOn,
        reason,
        markedAt: new Date(),
        deliveredAt: undefined,
        // Already delivered with the order = the stock is gone; otherwise it
        // is taken off the shelf when the item is finally delivered.
        dispatched: item.deferred?.dispatched || order.status === "DELIVERED",
      };
    }
    await order.save();

    await orderService.announceDeferred(order, "ITEMS_DELAYED", chosen);
    await audit.record({
      req, action: "update", entity: "Order", entityId: order._id, label: order.code,
      after: { delayedItems: chosen.map((i) => i.name), expectedOn: day, reason },
    });

    res.json({ success: true, order });
  })
);

// The delayed items have arrived.
router.post(
  "/:id/delayed-items/delivered",
  requireAnyPermission("orders.manage", "delivery.fulfil"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    const ids = Array.isArray(req.body.items) ? req.body.items.map(String) : [];
    const chosen = ids
      .map((id) => order.items.id(id))
      .filter((item) => item?.deferred?.expectedOn && !item.deferred.deliveredAt);
    if (!chosen.length) throw ApiError.badRequest("Nothing delayed to mark as delivered");

    const inventoryService = require("../inventory/inventory.service");
    for (const item of chosen) {
      item.deferred.deliveredAt = new Date();
      if (!item.deferred.dispatched) {
        await inventoryService.dispatch(order.store, item.variant, item.pickedQuantity ?? item.quantity, {
          refType: "order", refId: order._id, refCode: order.code, reason: "Delivered later",
          actor: { id: req.user.id, name: req.user.name, role: req.user.role },
        });
        item.deferred.dispatched = true;
      }
    }
    await order.save();

    await orderService.announceDeferred(order, "DELAYED_ITEMS_DELIVERED", chosen);
    await audit.record({
      req, action: "update", entity: "Order", entityId: order._id, label: order.code,
      after: { delayedItemsDelivered: chosen.map((i) => i.name) },
    });

    res.json({ success: true, order });
  })
);

// Who an order can be handed to, with today's load so the dispatcher can pick
// the least busy partner rather than the first in the list.
router.get(
  "/delivery/partners",
  requirePermission("orders.assign"),
  asyncHandler(async (req, res) => {
    const filter = { role: "delivery_partner", status: "active" };
    if (req.query.store) filter.$or = [{ stores: req.query.store }, { stores: { $size: 0 } }];

    const partners = await User.find(filter).select("name phone stores").sort({ name: 1 });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const load = await Order.aggregate([
      {
        $match: {
          "delivery.partner": { $in: partners.map((p) => p._id) },
          placedAt: { $gte: startOfDay },
        },
      },
      {
        $group: {
          _id: "$delivery.partner",
          assigned: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
        },
      },
    ]);

    const byPartner = new Map(load.map((l) => [String(l._id), l]));

    res.json({
      success: true,
      partners: partners.map((partner) => {
        const stats = byPartner.get(partner.id) || { assigned: 0, delivered: 0 };
        return {
          id: partner.id,
          name: partner.name,
          phone: partner.phone,
          stores: (partner.stores || []).map(String),
          assignedToday: stats.assigned,
          deliveredToday: stats.delivered,
          openNow: stats.assigned - stats.delivered,
        };
      }),
    });
  })
);

router.post(
  "/:id/assign",
  requirePermission("orders.assign"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    await orderService.assignDeliveryPartner(order, req.body.partner, {
      id: req.user.id, name: req.user.name, role: req.user.role,
    });
    res.json({ success: true, order });
  })
);

// Permanently removes an order (admins only). An order that is still open is
// cancelled first, so its reserved stock goes back on the shelf and any money
// taken is refunded; a finished order is simply removed.
router.delete(
  "/:id",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    const actor = { id: req.user.id, name: req.user.name, role: req.user.role };
    const terminal = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];
    if (!terminal.includes(order.status) && STATUSES[order.status]?.next?.includes("CANCELLED")) {
      await orderService.transition(order, "CANCELLED", actor, "Order deleted by admin");
    }

    await audit.record({
      req,
      action: "delete",
      entity: "Order",
      entityId: order.id,
      label: `${order.code} (${order.status})`,
    });
    await Order.deleteOne({ _id: order._id });
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------- delivery app

const LIVE_STATUSES = ["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"];

// Orders an admin has already given to a rider while the store is still
// preparing them. The rider sees them as "coming up" and they become live the
// moment the order reaches Ready for pickup.
const UPCOMING_STATUSES = [
  "ORDER_PLACED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "ORDER_CONFIRMED",
  "ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP",
];

// The partner app's home screen in one request: what is in hand right now, and
// what today has been worth. Everything here is computed from real orders —
// earnings are deliveries × the store's configured per-delivery fee, not an
// estimate.
router.get(
  "/delivery/queue",
  requireRole("delivery_partner", "admin", "super_admin", "store_manager"),
  asyncHandler(async (req, res) => {
    const partnerId = req.query.partner || req.user.id;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [orders, upcomingOrders, deliveredToday, stores] = await Promise.all([
      Order.find({ "delivery.partner": partnerId, status: { $in: LIVE_STATUSES } })
        .sort({ "delivery.assignedAt": 1 }),
      Order.find({ "delivery.partner": partnerId, status: { $in: UPCOMING_STATUSES } })
        .sort({ "delivery.assignedAt": 1 }),
      Order.find({
        "delivery.partner": partnerId,
        status: "DELIVERED",
        "delivery.deliveredAt": { $gte: startOfDay },
      }).select("store pricing payment delivery.deliveredAt code"),
      Store.find({ status: { $ne: "closed" } }).select("name code address location contact settings"),
    ]);

    const storeById = new Map(stores.map((s) => [s.id, s]));

    // Fee is per store, so a partner working two branches earns each branch's
    // rate rather than an average.
    const earnings = deliveredToday.reduce(
      (sum, order) => sum + (storeById.get(String(order.store))?.settings?.partnerFeePerDelivery ?? 0),
      0
    );

    // Cash the partner is holding and owes back to the store at shift end.
    const codCollected = deliveredToday
      .filter((order) => order.payment.method === "cod")
      .reduce((sum, order) => sum + (order.pricing?.total || 0), 0);

    // Each live order carries its pickup store, so the app can offer "navigate
    // to store" without a second lookup per card.
    const withPickupInfo = (order) => {
      const store = storeById.get(String(order.store));
      return {
        ...order.toJSON(),
        pickup: store
          ? {
              id: store.id,
              name: store.name,
              address: store.address,
              location: store.location,
              phone: store.contact?.phone || "",
            }
          : null,
      };
    };
    const withPickup = orders.map(withPickupInfo);
    const upcoming = upcomingOrders.map(withPickupInfo);

    res.json({
      success: true,
      orders: withPickup,
      upcoming,
      stats: {
        pending: orders.length,
        upcoming: upcoming.length,
        deliveredToday: deliveredToday.length,
        assignedToday: orders.length + deliveredToday.length,
        earnings,
        codCollected,
      },
    });
  })
);

// Completed runs, newest first — the "what did I do today / this week" screen.
router.get(
  "/delivery/history",
  requireRole("delivery_partner", "admin", "super_admin", "store_manager"),
  asyncHandler(async (req, res) => {
    const partnerId = req.query.partner || req.user.id;

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (Number(req.query.days) || 7) + 1);

    const result = await paginate(
      Order,
      {
        "delivery.partner": partnerId,
        status: "DELIVERED",
        "delivery.deliveredAt": { $gte: since },
      },
      req.query,
      { defaultSort: { "delivery.deliveredAt": -1 } }
    );

    res.json({ success: true, ...result });
  })
);

router.post(
  "/:id/deliver",
  requireRole("delivery_partner", "admin", "super_admin", "store_manager"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");

    if (req.user.role === "delivery_partner" && String(order.delivery.partner) !== req.user.id) {
      throw ApiError.forbidden("This order is assigned to another partner");
    }

    // The QR scan is optional now (the delivery OTP is the proof of handover).
    // If a QR value *is* sent it still has to match this order.
    const scannedQr = String(req.body.scanned || "").trim();
    if (req.user.role === "delivery_partner" && scannedQr && scannedQr !== orderQrValue(order)) {
      throw ApiError.badRequest("That QR belongs to a different order");
    }

    await orderService.completeDelivery(order, req.body, {
      id: req.user.id, name: req.user.name, role: req.user.role,
    });
    res.json({ success: true, order });
  })
);

module.exports = router;
