const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission, optionalAuth } = require("../../middleware/auth");
const Store = require("./store.model");

const router = express.Router();

// Public: which stores exist and whether they are open. Commercial settings
// (COD ceiling, prep time) are fine to expose; staff assignments are not.
router.get(
  "/public",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const filter = { status: "active" };
    if (req.query.pincode) filter.servicePincodes = String(req.query.pincode);

    const stores = await Store.find(filter).select("-manager");
    res.json({
      success: true,
      stores: stores.map((s) => ({
        id: s.id, name: s.name, code: s.code, type: s.type,
        address: s.address, isOpen: s.isOpenNow(), settings: s.settings,
      })),
    });
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
    const store = await Store.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!store) throw ApiError.notFound("Store not found");
    res.json({ success: true, store });
  })
);

module.exports = router;
