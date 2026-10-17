const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, escapeRegex } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const DeliveryArea = require("./deliveryArea.model");
const Store = require("./store.model");
const Order = require("../orders/order.model");
const audit = require("../audit/audit.service");
const deliveryAreas = require("./deliveryArea.service");

// Admin → Delivery Areas. Customers read active areas through the existing
// public GET /stores/service-areas; everything here needs settings.manage,
// the same permission as editing stores and delivery zones.

const router = express.Router();
router.use(requireAuth, requirePermission("settings.manage"), (_req, _res, next) => {
  deliveryAreas.ensureReady().then(() => next(), next);
});

const FIELDS = ["name", "city", "state", "pincode", "description"];
// Orders in these states are still on their way — deactivating their area
// does not stop them, but the admin should know they exist.
const OPEN = ["ORDER_PLACED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "ORDER_CONFIRMED", "ORDER_ACCEPTED", "PICKING",
  "PACKING", "READY_FOR_PICKUP", "ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"];

function readInput(body = {}, { creating }) {
  const input = {};
  for (const key of FIELDS) if (body[key] !== undefined && body[key] !== null) input[key] = String(body[key]).trim();
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") throw ApiError.unprocessable("Check the highlighted fields", { active: "Status is active or inactive" });
    input.active = body.active;
  }
  if (body.store !== undefined) input.store = String(body.store);

  const errors = {};
  if ((creating || input.name !== undefined) && !input.name) errors.name = "Enter the area's name";
  if ((creating || input.city !== undefined) && !input.city) errors.city = "Enter the city or locality";
  if ((creating || input.pincode !== undefined) && !/^\d{6}$/.test(input.pincode || "")) errors.pincode = "PIN code must be 6 digits";
  for (const [key, max] of [["name", 80], ["city", 80], ["state", 80], ["description", 300]]) {
    if (input[key] && input[key].length > max) errors[key] = `Keep this under ${max} characters`;
  }
  if (input.store !== undefined && !mongoose.isValidObjectId(input.store)) errors.store = "Choose a store";
  if (Object.keys(errors).length) throw ApiError.unprocessable("Check the highlighted fields", errors);
  return input;
}

// "This place already exists" as a field message, not a raw duplicate-key error.
async function saveUnique(area) {
  try {
    await area.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw ApiError.unprocessable("That delivery area already exists", {
        name: `${area.name}, ${area.city} (${area.pincode}) is already in the list`,
      });
    }
    throw err;
  }
}

const snapshot = (a) => ({ name: a.name, city: a.city, state: a.state, pincode: a.pincode, description: a.description, active: a.active, store: String(a.store) });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status === "active") filter.active = true;
    else if (req.query.status === "inactive") filter.active = false;
    else if (req.query.status) throw ApiError.badRequest("Status is active or inactive");
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search)), "i");
      filter.$or = [{ name: rx }, { city: rx }, { state: rx }, { pincode: rx }];
    }

    const result = await paginate(DeliveryArea, filter, req.query, { defaultSort: { name: 1 } });
    const ids = result.items.map((a) => a._id);
    const [stores, orderCounts] = await Promise.all([
      Store.find({}).select("name isDefault").sort({ isDefault: -1, name: 1 }),
      Order.aggregate([
        { $match: { "delivery.area.id": { $in: ids } } },
        { $group: { _id: "$delivery.area.id", orders: { $sum: 1 }, open: { $sum: { $cond: [{ $in: ["$status", OPEN] }, 1, 0] } } } },
      ]),
    ]);
    const counts = new Map(orderCounts.map((c) => [String(c._id), c]));
    const storeNames = new Map(stores.map((s) => [s.id, s.name]));

    res.json({
      success: true,
      ...result,
      items: result.items.map((area) => ({
        ...area.toJSON(),
        store: String(area.store),
        storeName: storeNames.get(String(area.store)) || "",
        orders: counts.get(area.id)?.orders || 0,
        openOrders: counts.get(area.id)?.open || 0,
      })),
      stores: stores.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault })),
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Delivery area not found");
    const [area, stores] = await Promise.all([
      DeliveryArea.findById(req.params.id),
      Store.find({}).select("name isDefault").sort({ isDefault: -1, name: 1 }),
    ]);
    if (!area) throw ApiError.notFound("Delivery area not found");
    res.json({ success: true, area: { ...area.toJSON(), store: String(area.store) }, stores: stores.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault })) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = readInput(req.body, { creating: true });
    const store = input.store
      ? await Store.findById(input.store)
      : await Store.findOne({}).sort({ isDefault: -1, _id: 1 });
    if (!store) throw ApiError.unprocessable("Check the highlighted fields", { store: "Choose a store" });

    const area = new DeliveryArea({ ...input, store: store._id });
    await saveUnique(area);
    await deliveryAreas.syncStore(store._id);
    await audit.record({ req, action: "create", entity: "DeliveryArea", entityId: area._id, label: area.name, after: snapshot(area) });
    res.status(201).json({ success: true, message: `${area.name} added`, area });
  })
);

// Details and activate / deactivate. The area keeps its id, so orders and
// customers that picked it stay attached.
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Delivery area not found");
    const area = await DeliveryArea.findById(req.params.id);
    if (!area) throw ApiError.notFound("Delivery area not found");

    const input = readInput(req.body, { creating: false });
    const previousStore = String(area.store);
    if (input.store && !(await Store.exists({ _id: input.store }))) {
      throw ApiError.unprocessable("Check the highlighted fields", { store: "Choose a store" });
    }

    const before = snapshot(area);
    Object.assign(area, input);
    await saveUnique(area);
    await deliveryAreas.syncStore(area.store);
    if (previousStore !== String(area.store)) await deliveryAreas.syncStore(previousStore);

    const statusChanged = before.active !== area.active;
    await audit.record({
      req, action: statusChanged ? (area.active ? "activate" : "deactivate") : "update",
      entity: "DeliveryArea", entityId: area._id, label: area.name, before, after: snapshot(area),
    });

    const openOrders = statusChanged && !area.active
      ? await Order.countDocuments({ "delivery.area.id": area._id, status: { $in: OPEN } })
      : 0;
    const message = statusChanged
      ? area.active
        ? `${area.name} is open for delivery`
        : `${area.name} deactivated${openOrders ? ` — its ${openOrders} open order${openOrders === 1 ? "" : "s"} will still be delivered` : ""}`
      : `${area.name} updated`;
    res.json({ success: true, message, area, openOrders });
  })
);

// Deleting is for mistakes. An area any order was delivered to is history —
// deactivate it instead, so reports and past orders keep their place.
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound("Delivery area not found");
    const area = await DeliveryArea.findById(req.params.id);
    if (!area) throw ApiError.notFound("Delivery area not found");
    const orders = await Order.countDocuments({ "delivery.area.id": area._id });
    if (orders) {
      throw ApiError.conflict(`${area.name} has ${orders} order${orders === 1 ? "" : "s"} — deactivate it instead of deleting it`);
    }
    await area.deleteOne();
    await deliveryAreas.syncStore(area.store);
    await audit.record({ req, action: "delete", entity: "DeliveryArea", entityId: area._id, label: area.name, before: snapshot(area) });
    res.json({ success: true, message: `${area.name} deleted` });
  })
);

module.exports = router;
