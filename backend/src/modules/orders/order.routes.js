const express = require("express");
const rateLimit = require("express-rate-limit");
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

// A delivery partner sees and moves only the orders assigned to them, and
// never the customer's handover code: the code is how a delivery proves the
// rider reached the customer.
const isRider = (user) => user.role === "delivery_partner";

function assertAssigned(order, user) {
  if (isRider(user) && String(order.delivery?.partner) !== user.id) {
    throw ApiError.forbidden("This order is assigned to another delivery boy");
  }
}

// A rider gets what the run in hand needs and no more: the customer's name,
// phone, address and instructions only while the order is on their run, and
// never the email, staff notes, payment references or customer id. Once the
// run is over, history keeps the area and the amounts (for the cash count),
// not the person.
const ON_RUN = ["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"];

function forViewer(order, user) {
  const json = typeof order.toJSON === "function" ? order.toJSON() : { ...order };
  if (!isRider(user)) return json;

  const live = ON_RUN.includes(json.status);
  const delivery = json.delivery || {};
  const address = delivery.address || {};
  const { method, status, amountPaid } = json.payment || {};
  return {
    ...json,
    customer: undefined,
    customerSnapshot: live ? { name: json.customerSnapshot?.name, phone: json.customerSnapshot?.phone } : {},
    customerNote: undefined,
    internalNote: undefined,
    statusHistory: undefined,
    rating: undefined,
    rewardCoupon: undefined,
    payment: { method, status, amountPaid },
    delivery: {
      ...delivery,
      otp: undefined,
      proofPhoto: undefined,
      signature: undefined,
      deliveredLocation: undefined,
      instructions: live ? delivery.instructions : undefined,
      address: live ? address : { label: address.label, city: address.city, state: address.state, pincode: address.pincode },
    },
  };
}

// A customer's own order, without staff notes, and with the delivery
// employee's phone only while the order is on its way.
function forCustomer(order) {
  const json = typeof order.toJSON === "function" ? order.toJSON() : { ...order };
  const delivery = json.delivery || {};
  return {
    ...json,
    internalNote: undefined,
    delivery: { ...delivery, partnerPhone: ON_RUN.includes(json.status) ? delivery.partnerPhone : undefined },
  };
}

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
      deliveryAreaId: req.body.deliveryArea,
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
    res.json({ success: true, ...result, items: result.items.map(forCustomer) });
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

    // The order itself rides along, so a detail screen needs one request and
    // works for any order — not only the ones on the first page of /mine.
    res.json({ success: true, tracking: orderService.trackingView(order), order: isOwner ? forCustomer(order) : order });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    if (String(order.customer) !== req.user.id) throw ApiError.forbidden("Not your order");
    // Once the rider has collected it the goods are on the road: the website
    // and app stop offering Cancel here, and so does the API (refund policy:
    // docs/legal/refund-cancellation-policy.md).
    if (["PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"].includes(order.status)) {
      throw ApiError.conflict("This order is already on its way and can no longer be cancelled. Contact support if there is a problem.");
    }

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
    if (req.query.from || req.query.to) {
      filter.placedAt = {};
      if (req.query.from) filter.placedAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.placedAt.$lte = new Date(req.query.to);
    }

    const result = await paginate(Order, filter, req.query, { defaultSort: { placedAt: -1 } });
    res.json({ success: true, ...result });
  })
);

router.get(
  "/:id",
  requireAnyPermission("orders.view", "delivery.fulfil"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    assertAssigned(order, req.user);
    // Where it was collected from — the delivery app's run and history screens.
    const store = await Store.findById(order.store).select("name address contact");

    res.json({
      success: true,
      order: forViewer(order, req.user),
      pickup: store ? { name: store.name, address: store.address, phone: store.contact?.phone || "" } : null,
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
    assertAssigned(order, req.user);
    // A rider's handover goes through /deliver, which checks the customer's code.
    if (isRider(req.user) && req.body.status === "DELIVERED") {
      throw ApiError.badRequest("Confirm the delivery with the customer's handover code");
    }

    await orderService.transition(
      order,
      req.body.status,
      { id: req.user.id, name: req.user.name, role: req.user.role },
      req.body.note || ""
    );

    res.json({
      success: true,
      order: forViewer(order, req.user),
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
          assignedToday: stats.assigned,
          deliveredToday: stats.delivered,
          openNow: stats.assigned - stats.delivered,
          // Store ids this rider is limited to (empty = every store), so one
          // list can serve a table of orders from several stores.
          stores: partner.stores.map(String),
        };
      }),
    });
  })
);

// Assign, or reassign before pickup (Admin -> Orders table and order page).
router.post(
  "/:id/assign",
  requirePermission("orders.assign"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    const before = order.delivery.partnerName || "";

    await orderService.assignDeliveryPartner(order, req.body.partner, {
      id: req.user.id, name: req.user.name, role: req.user.role,
    });
    const after = order.delivery.partnerName;
    if (before !== after) {
      await audit.record({
        req, action: before ? "reassign" : "assign", entity: "Order", entityId: order._id, label: order.code,
        summary: before ? `Delivery moved from ${before} to ${after}` : `Delivery assigned to ${after}`,
      });
    }
    res.json({
      success: true,
      message: before === after ? `Already assigned to ${after}` : `Assigned to ${after}`,
      order,
    });
  })
);

// Remove the assignment before pickup: back to Ready for pickup, nobody on it.
router.delete(
  "/:id/assign",
  requirePermission("orders.assign"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    const removed = order.delivery.partnerName || "the delivery person";

    await orderService.unassignDeliveryPartner(order, {
      id: req.user.id, name: req.user.name, role: req.user.role,
    });
    await audit.record({
      req, action: "unassign", entity: "Order", entityId: order._id, label: order.code,
      summary: `Delivery unassigned from ${removed}`,
    });
    res.json({ success: true, message: `Removed ${removed} from ${order.code}`, order });
  })
);

// ---------------------------------------------------------------- delivery app

const LIVE_STATUSES = ON_RUN;

// The delivery app's home screen in one request: what is in hand right now,
// and how today's work stands. Delivery boys are store employees on a salary,
// so there is nothing per delivery to add up — only counts and the cash on
// delivery they are holding for the store.
router.get(
  "/delivery/queue",
  requireRole("delivery_partner", "admin", "super_admin", "store_manager"),
  asyncHandler(async (req, res) => {
    // Staff may look at anyone's queue; a delivery boy only ever at their own.
    const partnerId = (!isRider(req.user) && req.query.partner) || req.user.id;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [orders, deliveredToday, stores] = await Promise.all([
      Order.find({ "delivery.partner": partnerId, status: { $in: LIVE_STATUSES } })
        .sort({ "delivery.assignedAt": 1 }),
      Order.find({
        "delivery.partner": partnerId,
        status: "DELIVERED",
        "delivery.deliveredAt": { $gte: startOfDay },
      }).select("pricing payment delivery.deliveredAt code"),
      Store.find({ status: { $ne: "closed" } }).select("name code address location contact"),
    ]);

    const storeById = new Map(stores.map((s) => [s.id, s]));

    // Cash on delivery collected today: the store's money, handed in at the
    // counter (Admin → Payments → Cash on delivery).
    const codCollected = deliveredToday
      .filter((order) => order.payment.method === "cod")
      .reduce((sum, order) => sum + (order.pricing?.total || 0), 0);

    // Each live order carries its pickup store, so the app can offer "navigate
    // to store" without a second lookup per card.
    const withPickup = orders.map((order) => {
      const store = storeById.get(String(order.store));
      return {
        ...forViewer(order, req.user),
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
    });

    res.json({
      success: true,
      orders: withPickup,
      stats: {
        pending: orders.length,
        deliveredToday: deliveredToday.length,
        assignedToday: orders.length + deliveredToday.length,
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
    const partnerId = (!isRider(req.user) && req.query.partner) || req.user.id;

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

    res.json({ success: true, ...result, items: result.items.map((order) => forViewer(order, req.user)) });
  })
);

// The handover code is four digits, so wrong guesses are capped per person per
// order; a rider who mistypes a few times is told to wait, not locked out.
const handoverAttempts = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.user.id}:${req.params.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many wrong codes. Wait 15 minutes, or call the store." } },
});

router.post(
  "/:id/deliver",
  requireRole("delivery_partner", "admin", "super_admin", "store_manager"),
  handoverAttempts,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound("Order not found");
    assertAssigned(order, req.user);

    await orderService.completeDelivery(order, req.body, {
      id: req.user.id, name: req.user.name, role: req.user.role,
    });
    res.json({ success: true, order: forViewer(order, req.user) });
  })
);

module.exports = router;
