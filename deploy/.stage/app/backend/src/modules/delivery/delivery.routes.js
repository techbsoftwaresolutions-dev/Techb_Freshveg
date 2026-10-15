const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission, requireRole, optionalAuth } = require("../../middleware/auth");

const DeliveryZone = require("./deliveryZone.model");
const DeliverySlot = require("./deliverySlot.model");
const Order = require("../orders/order.model");
const User = require("../auth/user.model");
const deliveryService = require("./delivery.service");
const audit = require("../audit/audit.service");

const router = express.Router();

// ---------------------------------------------------------------- public

// What delivery will cost and how long it will take, before anyone signs in.
router.get(
  "/quote",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const coordinates =
      req.query.lng && req.query.lat ? [Number(req.query.lng), Number(req.query.lat)] : undefined;

    const quote = await deliveryService.quote({
      storeId: req.query.store,
      pincode: req.query.pincode,
      coordinates,
      cartValue: Number(req.query.cartValue) || 0,
    });

    if (!quote) throw ApiError.notFound("No store serves that address");
    res.json({ success: true, ...quote });
  })
);

router.get(
  "/slots",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const days = await deliveryService.availableSlots(req.query.store, {
      days: Number(req.query.days) || undefined,
    });
    res.json({ success: true, days });
  })
);

router.use(requireAuth);

// ---------------------------------------------------------------- tracking

// A ping from the partner's phone during a run.
router.post(
  "/orders/:orderId/ping",
  requireRole("delivery_partner", "admin", "super_admin", "store_manager"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);
    if (!order) throw ApiError.notFound("Order not found");

    if (req.user.role === "delivery_partner" && String(order.delivery.partner) !== req.user.id) {
      throw ApiError.forbidden("This order is assigned to another partner");
    }

    const { lng, lat } = req.body;
    if (typeof lng !== "number" || typeof lat !== "number") {
      throw ApiError.badRequest("lng and lat are required");
    }

    const result = await deliveryService.recordPing(order, req.user.id, {
      coordinates: [lng, lat],
      accuracyMetres: req.body.accuracyMetres,
      speedKmph: req.body.speedKmph,
      heading: req.body.heading,
      batteryPct: req.body.batteryPct,
    });

    // Mirrored onto the order so the customer's tracker needs one read.
    order.delivery.distanceKm = result.distanceKm ?? order.delivery.distanceKm;
    await order.save();

    res.json({ success: true, distanceKm: result.distanceKm, etaMinutes: result.etaMinutes });
  })
);

// Where the rider is. Only while the order is actually out — a customer has no
// business seeing a partner's position before or after their run.
router.get(
  "/orders/:orderId/position",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);
    if (!order) throw ApiError.notFound("Order not found");

    const isOwner = String(order.customer) === req.user.id;
    if (!isOwner && !req.user.permissions.includes("delivery.view")) {
      throw ApiError.forbidden("Not your order");
    }

    if (!["PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"].includes(order.status)) {
      return res.json({ success: true, live: false, position: null, status: order.status });
    }

    const position = await deliveryService.latestPosition(order._id);
    res.json({
      success: true,
      live: Boolean(position),
      position: position
        ? {
            coordinates: position.location.coordinates,
            distanceKm: position.distanceToCustomerKm,
            etaMinutes: position.etaMinutes,
            at: position.createdAt,
          }
        : null,
      partner: order.delivery.partnerName
        ? { name: order.delivery.partnerName, phone: order.delivery.partnerPhone }
        : null,
    });
  })
);

// ---------------------------------------------------------------- zones

const canView = requirePermission("delivery.view");
const canManage = requirePermission("settings.manage");

router.get(
  "/zones",
  canView,
  asyncHandler(async (req, res) => {
    const filter = req.query.store ? { store: req.query.store } : {};
    const result = await paginate(DeliveryZone, filter, req.query, {
      defaultSort: { priority: -1, name: 1 },
      populate: { path: "store", select: "name code" },
    });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/zones",
  canManage,
  asyncHandler(async (req, res) => {
    const zone = await DeliveryZone.create(req.body);
    await audit.record({ req, action: "create", entity: "DeliveryZone", entityId: zone._id, label: zone.name });
    res.status(201).json({ success: true, zone });
  })
);

router.patch(
  "/zones/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const zone = await DeliveryZone.findById(req.params.id);
    if (!zone) throw ApiError.notFound("Zone not found");

    const before = audit.snapshot(zone);
    Object.assign(zone, req.body);
    await zone.save();

    await audit.record({
      req, action: "update", entity: "DeliveryZone", entityId: zone._id,
      label: zone.name, before, after: audit.snapshot(zone),
    });

    res.json({ success: true, zone });
  })
);

router.delete(
  "/zones/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const zone = await DeliveryZone.findByIdAndUpdate(req.params.id, { status: "paused" }, { new: true });
    if (!zone) throw ApiError.notFound("Zone not found");
    res.json({ success: true, zone });
  })
);

// ---------------------------------------------------------------- slots

router.get(
  "/slot-templates",
  canView,
  asyncHandler(async (req, res) => {
    const filter = req.query.store ? { store: req.query.store } : {};
    const slots = await DeliverySlot.find(filter).sort({ seq: 1, startTime: 1 });
    res.json({ success: true, slots });
  })
);

router.post(
  "/slot-templates",
  canManage,
  asyncHandler(async (req, res) => {
    const slot = await DeliverySlot.create(req.body);
    await audit.record({ req, action: "create", entity: "DeliverySlot", entityId: slot._id, label: slot.label });
    res.status(201).json({ success: true, slot });
  })
);

router.patch(
  "/slot-templates/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const slot = await DeliverySlot.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!slot) throw ApiError.notFound("Slot not found");
    res.json({ success: true, slot });
  })
);

// ---------------------------------------------------------------- reports

// The delivery report from the spec: one row per run, with the timings that
// say where the time actually went.
router.get(
  "/report",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};

    const { from, to, partner, status, store, pincode } = req.query;
    if (partner) filter["delivery.partner"] = partner;
    if (store) filter.store = store;
    if (pincode) filter["delivery.address.pincode"] = pincode;
    if (status) filter.status = { $in: String(status).split(",") };
    else filter["delivery.assignedAt"] = { $ne: null };

    if (from || to) {
      filter.placedAt = {};
      if (from) filter.placedAt.$gte = new Date(from);
      if (to) filter.placedAt.$lte = new Date(to);
    }

    const result = await paginate(Order, filter, req.query, {
      defaultSort: { placedAt: -1 },
      select: "code status placedAt pricing.total payment delivery customerSnapshot store rating",
    });

    const rows = result.items.map((order) => {
      const assigned = order.delivery.assignedAt;
      const picked = order.delivery.pickedUpAt;
      const delivered = order.delivery.deliveredAt;

      const minutes = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 60000) : null);

      return {
        id: order.id,
        code: order.code,
        status: order.status,
        customer: order.customerSnapshot?.name,
        area: order.delivery.address?.pincode,
        city: order.delivery.address?.city,
        partner: order.delivery.partnerName || null,
        assignedAt: assigned,
        pickedUpAt: picked,
        deliveredAt: delivered,
        // Where the time went: waiting at the store, then on the road.
        pickupMinutes: minutes(assigned, picked),
        transitMinutes: minutes(picked, delivered),
        totalMinutes: minutes(assigned, delivered),
        // Did it beat the promise made at checkout?
        onTime: delivered && order.delivery.expectedBy
          ? new Date(delivered) <= new Date(order.delivery.expectedBy)
          : null,
        amount: order.pricing?.total,
        paymentMethod: order.payment?.method,
        deliveryRating: order.rating?.delivery ?? null,
      };
    });

    const completed = rows.filter((r) => r.totalMinutes !== null);
    const onTimeRows = completed.filter((r) => r.onTime !== null);

    res.json({
      success: true,
      items: rows,
      meta: result.meta,
      summary: {
        total: result.meta.total,
        delivered: rows.filter((r) => r.status === "DELIVERED").length,
        averageMinutes: completed.length
          ? Math.round(completed.reduce((sum, r) => sum + r.totalMinutes, 0) / completed.length)
          : null,
        onTimePct: onTimeRows.length
          ? Math.round((onTimeRows.filter((r) => r.onTime).length / onTimeRows.length) * 100)
          : null,
      },
    });
  })
);

// Per-partner performance, for the same window.
router.get(
  "/report/partners",
  canView,
  asyncHandler(async (req, res) => {
    const match = { "delivery.partner": { $ne: null } };
    if (req.query.from || req.query.to) {
      match.placedAt = {};
      if (req.query.from) match.placedAt.$gte = new Date(req.query.from);
      if (req.query.to) match.placedAt.$lte = new Date(req.query.to);
    }

    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$delivery.partner",
          assigned: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $in: ["$status", ["CANCELLED", "REJECTED"]] }, 1, 0] } },
          value: { $sum: "$pricing.total" },
          ratingSum: { $sum: { $ifNull: ["$rating.delivery", 0] } },
          ratingCount: { $sum: { $cond: [{ $gt: ["$rating.delivery", 0] }, 1, 0] } },
          minutesSum: {
            $sum: {
              $cond: [
                { $and: ["$delivery.assignedAt", "$delivery.deliveredAt"] },
                { $divide: [{ $subtract: ["$delivery.deliveredAt", "$delivery.assignedAt"] }, 60000] },
                0,
              ],
            },
          },
        },
      },
      { $sort: { delivered: -1 } },
    ]);

    const partners = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select("name phone");
    const byId = new Map(partners.map((p) => [p.id, p]));

    res.json({
      success: true,
      partners: rows.map((row) => ({
        partner: byId.get(String(row._id))
          ? { id: String(row._id), name: byId.get(String(row._id)).name, phone: byId.get(String(row._id)).phone }
          : null,
        assigned: row.assigned,
        delivered: row.delivered,
        cancelled: row.cancelled,
        valueHandled: row.value,
        averageMinutes: row.delivered ? Math.round(row.minutesSum / row.delivered) : null,
        averageRating: row.ratingCount ? Math.round((row.ratingSum / row.ratingCount) * 10) / 10 : null,
      })),
    });
  })
);

module.exports = router;
