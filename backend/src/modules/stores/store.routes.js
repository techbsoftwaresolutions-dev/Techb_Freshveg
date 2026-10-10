const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission, optionalAuth } = require("../../middleware/auth");
const Store = require("./store.model");
const Order = require("../orders/order.model");
const Payment = require("../payments/payment.model");
const User = require("../auth/user.model");
const Offer = require("../pricing/offer.model");
const Inventory = require("../inventory/inventory.model");
const StockMovement = require("../inventory/stockMovement.model");
const Cart = require("../cart/cart.model");
const DeliveryZone = require("../delivery/deliveryZone.model");
const DeliverySlot = require("../delivery/deliverySlot.model");
const MaintenanceAsset = require("../maintenance/maintenanceAsset.model");
const MaintenanceRequest = require("../maintenance/maintenanceRequest.model");
const audit = require("../audit/audit.service");

const router = express.Router();

// Public: which stores exist and whether they are open. Commercial settings
// (COD ceiling, prep time) are fine to expose; staff assignments are not.
router.get(
  "/public",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const filter = { status: "active" };
    if (req.query.pincode) filter.servicePincodes = String(req.query.pincode);

    // Default store first: a client with no pincode yet takes stores[0], and
    // that must be the store the storefront prices and stocks pages against.
    const stores = await Store.find(filter).select("-manager").sort({ isDefault: -1, _id: 1 });
    res.json({
      success: true,
      stores: stores.map((s) => ({
        id: s.id, name: s.name, code: s.code, type: s.type,
        address: s.address, isOpen: s.isOpenNow(), settings: s.settings,
      })),
    });
  })
);

// Public: every place the shop delivers to, for the "Deliver to" picker —
// pincode and place name, sorted by name. Pincodes with no place name set
// are listed by pincode alone.
router.get(
  "/service-areas",
  asyncHandler(async (req, res) => {
    const stores = await Store.find({ status: "active" }).select("name servicePincodes serviceAreas").sort({ isDefault: -1, _id: 1 });
    const seen = new Set();
    const areas = [];
    for (const store of stores) {
      for (const area of store.deliveryAreas()) {
        const key = `${area.pincode}|${area.name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        areas.push(area);
      }
    }
    areas.sort((a, b) => !a.name - !b.name || a.name.localeCompare(b.name) || a.pincode.localeCompare(b.pincode));
    res.json({ success: true, areas });
  })
);

router.use(requireAuth);

router.get(
  "/",
  requirePermission("settings.manage"),
  asyncHandler(async (req, res) => {
    const result = await paginate(Store, {}, req.query, { defaultSort: { isDefault: -1, name: 1 } });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/",
  requirePermission("settings.manage"),
  asyncHandler(async (req, res) => {
    const store = await Store.create(req.body);
    res.status(201).json({ success: true, store });
  })
);

router.patch(
  "/:id",
  requirePermission("settings.manage"),
  asyncHandler(async (req, res) => {
    // Free-delivery rule: the amount must be a real, non-negative number, and
    // an enabled rule needs an amount above zero. (0 with the rule off is how
    // stores that predate the switch are stored, so that stays allowed.)
    const rule = req.body?.settings;
    if (rule && Object.prototype.hasOwnProperty.call(rule, "freeDeliveryAbove")) {
      const amount = Number(rule.freeDeliveryAbove);
      if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
        throw ApiError.badRequest("Free delivery amount must be a positive number");
      }
      if (rule.freeDeliveryEnabled === true && amount <= 0) {
        throw ApiError.badRequest("Enter a free delivery amount above zero, or turn free delivery off");
      }
    }
    if (rule && "freeDeliveryEnabled" in rule && typeof rule.freeDeliveryEnabled !== "boolean") {
      throw ApiError.badRequest("Free delivery must be on or off");
    }

    // Named delivery areas decide the pincode list, so the two never disagree.
    const update = { ...req.body };
    if (Array.isArray(update.serviceAreas)) {
      Object.assign(update, Store.normalizeServiceAreas(update.serviceAreas));
    }

    const store = await Store.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!store) throw ApiError.notFound("Store not found");
    res.json({ success: true, store });
  })
);

// Deleting a store removes it and its operational data (stock, carts,
// delivery zones and slots, maintenance records). It is refused when that
// would lose something that has to be kept or change who/what a rule covers:
//  - the default store — the storefront falls back to it;
//  - a store with orders or payments — that history must stay (close the
//    store instead: status "closed");
//  - staff or offers scoped to this store alone — an empty store list means
//    "every store", so removing the last one would widen them.
router.delete(
  "/:id",
  requirePermission("settings.manage"),
  asyncHandler(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) throw ApiError.notFound("Store not found");
    if (store.isDefault) {
      throw ApiError.conflict("This is the default store. Make another store the default first.");
    }

    const id = store._id;
    const [orders, payments, onlyStaff, onlyOffers] = await Promise.all([
      Order.countDocuments({ store: id }),
      Payment.countDocuments({ store: id }),
      User.countDocuments({ stores: [id] }),
      Offer.countDocuments({ "conditions.stores": [id] }),
    ]);
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    if (orders || payments) {
      throw ApiError.conflict(
        `${store.name} has ${plural(orders || payments, orders ? "order" : "payment")} on record, which must be kept. Set its status to Closed instead.`
      );
    }
    if (onlyStaff) {
      throw ApiError.conflict(`${plural(onlyStaff, "staff member")} ${onlyStaff === 1 ? "works" : "work"} only at ${store.name}. Assign them to another store first.`);
    }
    if (onlyOffers) {
      throw ApiError.conflict(`${plural(onlyOffers, "offer")} ${onlyOffers === 1 ? "applies" : "apply"} only at ${store.name}. Edit or remove ${onlyOffers === 1 ? "it" : "them"} first.`);
    }

    await Promise.all([
      Inventory.deleteMany({ store: id }),
      StockMovement.deleteMany({ store: id }),
      Cart.deleteMany({ store: id }),
      DeliveryZone.deleteMany({ store: id }),
      DeliverySlot.deleteMany({ store: id }),
      MaintenanceAsset.deleteMany({ store: id }),
      MaintenanceRequest.deleteMany({ store: id }),
      User.updateMany({ stores: id }, { $pull: { stores: id } }),
      Offer.updateMany({ "conditions.stores": id }, { $pull: { "conditions.stores": id } }),
    ]);
    await store.deleteOne();

    await audit.record({ req, action: "delete", entity: "Store", entityId: id, label: store.name });
    res.json({ success: true });
  })
);

module.exports = router;
