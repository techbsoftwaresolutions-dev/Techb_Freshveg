const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { nextSequence, highestIssued } = require("../../core/sequence");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const MaintenanceAsset = require("./maintenanceAsset.model");
const MaintenanceRequest = require("./maintenanceRequest.model");
const audit = require("../audit/audit.service");

const router = express.Router();
// Maintenance is an internal operations concern, gated on the same permission
// as the rest of store administration.
router.use(requireAuth, requirePermission("settings.manage"));

// ---------------------------------------------------------------- assets

router.get(
  "/assets",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.store) filter.store = req.query.store;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    // The list that matters most: what is overdue a service.
    if (req.query.overdue === "true") filter.nextServiceDue = { $lte: new Date() };

    const result = await paginate(MaintenanceAsset, filter, req.query, {
      defaultSort: { nextServiceDue: 1 },
      populate: { path: "store", select: "name code" },
    });

    const [overdue, dueSoon, down] = await Promise.all([
      MaintenanceAsset.countDocuments({ nextServiceDue: { $lte: new Date() }, status: { $ne: "retired" } }),
      MaintenanceAsset.countDocuments({
        nextServiceDue: { $gt: new Date(), $lte: new Date(Date.now() + 7 * 86400000) },
      }),
      MaintenanceAsset.countDocuments({ status: "under_repair" }),
    ]);

    res.json({
      success: true,
      ...result,
      summary: { overdue, dueSoon, underRepair: down },
      types: MaintenanceAsset.TYPES,
    });
  })
);

router.post(
  "/assets",
  asyncHandler(async (req, res) => {
    const asset = new MaintenanceAsset(req.body);
    if (!asset.code) {
      // Atomic counter rather than a row count, which reissues a code after a
      // delete. Numbering starts at AST-0101, as it always has.
      const floor = Math.max(100, await highestIssued(MaintenanceAsset, "AST-"));
      const seq = await nextSequence("maintenance-asset", { floor });
      asset.code = `AST-${String(seq).padStart(4, "0")}`;
    }
    // A new asset is due its first service one interval from now.
    if (!asset.nextServiceDue) asset.scheduleNext(asset.purchasedOn || new Date());
    await asset.save();

    await audit.record({ req, action: "create", entity: "MaintenanceAsset", entityId: asset._id, label: asset.name });
    res.status(201).json({ success: true, asset });
  })
);

router.patch(
  "/assets/:id",
  asyncHandler(async (req, res) => {
    const asset = await MaintenanceAsset.findById(req.params.id);
    if (!asset) throw ApiError.notFound("Asset not found");

    const before = audit.snapshot(asset);
    Object.assign(asset, req.body);
    await asset.save();

    await audit.record({
      req, action: "update", entity: "MaintenanceAsset", entityId: asset._id,
      label: asset.name, before, after: audit.snapshot(asset),
    });

    res.json({ success: true, asset });
  })
);

router.get(
  "/assets/:id",
  asyncHandler(async (req, res) => {
    const asset = await MaintenanceAsset.findById(req.params.id).populate("store", "name code");
    if (!asset) throw ApiError.notFound("Asset not found");

    const requests = await MaintenanceRequest.find({ asset: asset._id }).sort({ createdAt: -1 }).limit(50);

    res.json({
      success: true,
      asset,
      requests,
      // Cost of ownership so far — the number that decides repair or replace.
      totals: {
        jobs: requests.length,
        cost: requests.reduce((sum, r) => sum + (r.totalCost || 0), 0),
        downtimeMinutes: requests.reduce((sum, r) => sum + (r.downtimeMinutes || 0), 0),
      },
    });
  })
);

// ---------------------------------------------------------------- requests

router.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.store) filter.store = req.query.store;
    if (req.query.asset) filter.asset = req.query.asset;
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.open === "true") {
      filter.status = { $in: ["open", "assigned", "in_progress", "on_hold"] };
    }

    const result = await paginate(MaintenanceRequest, filter, req.query, {
      defaultSort: { priority: -1, createdAt: -1 },
      populate: { path: "asset", select: "name code type" },
    });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/requests",
  asyncHandler(async (req, res) => {
    const asset = await MaintenanceAsset.findById(req.body.asset);
    if (!asset) throw ApiError.badRequest("Asset not found");

    const request = await MaintenanceRequest.create({
      ...req.body,
      code: await MaintenanceRequest.nextCode(),
      assetName: asset.name,
      store: asset.store,
      reportedBy: req.user.id,
      reportedByName: req.user.name,
    });

    // A breakdown takes the asset out of service immediately — the schedule
    // should reflect reality, not wait for someone to update it.
    if (request.type === "breakdown" && asset.status === "operational") {
      asset.status = "needs_attention";
      await asset.save();
    }

    await audit.record({
      req, action: "create", entity: "MaintenanceRequest",
      entityId: request._id, label: request.code,
      summary: `${request.type} raised for ${asset.name}`,
    });

    res.status(201).json({ success: true, request });
  })
);

router.patch(
  "/requests/:id",
  asyncHandler(async (req, res) => {
    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) throw ApiError.notFound("Request not found");

    const before = audit.snapshot(request);
    Object.assign(request, req.body);

    if (req.body.status === "in_progress" && !request.startedAt) request.startedAt = new Date();

    if (req.body.status === "completed" && !request.completedAt) {
      request.completedAt = new Date();

      const asset = await MaintenanceAsset.findById(request.asset);
      if (asset) {
        // Completing a job is what resets the service clock and clears the
        // asset's status — otherwise the two drift apart.
        asset.scheduleNext(request.completedAt);
        asset.status = "operational";
        asset.lifetimeMaintenanceCost += request.totalCost || 0;
        await asset.save();
      }
    }

    await request.save();

    await audit.record({
      req, action: "update", entity: "MaintenanceRequest", entityId: request._id,
      label: request.code, before, after: audit.snapshot(request),
    });

    res.json({ success: true, request });
  })
);

// What is due, overdue, or currently broken — the maintenance home screen.
router.get(
  "/schedule",
  asyncHandler(async (req, res) => {
    const horizon = new Date(Date.now() + (Number(req.query.days) || 30) * 86400000);
    const filter = { status: { $ne: "retired" } };
    if (req.query.store) filter.store = req.query.store;

    const assets = await MaintenanceAsset.find({ ...filter, nextServiceDue: { $lte: horizon } })
      .populate("store", "name code")
      .sort({ nextServiceDue: 1 });

    const now = new Date();
    res.json({
      success: true,
      overdue: assets.filter((a) => a.nextServiceDue <= now),
      upcoming: assets.filter((a) => a.nextServiceDue > now),
    });
  })
);

module.exports = router;
