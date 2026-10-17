const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Notification = require("./notification.model");
const NotificationTemplate = require("./notificationTemplate.model");
const User = require("../auth/user.model");
const notificationService = require("./notification.service");
const audit = require("../audit/audit.service");

const router = express.Router();
router.use(requireAuth);

// ---------------------------------------------------------------- recipient

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const feed = await notificationService.feed(req.user.id, {
      limit: Number(req.query.limit) || 30,
      unreadOnly: req.query.unread === "true",
    });
    res.json({ success: true, ...feed });
  })
);

router.post(
  "/read",
  asyncHandler(async (req, res) => {
    const result = await notificationService.markRead(req.user.id, req.body.id);
    res.json({ success: true, ...result });
  })
);

// Registers a device for push. Replacing by token keeps a reinstall from
// leaving a dead entry behind.
router.post(
  "/devices",
  asyncHandler(async (req, res) => {
    const { token, platform } = req.body;
    if (!token) throw ApiError.badRequest("A device token is required");

    await User.updateOne({ _id: req.user.id }, { $pull: { devices: { token } } });
    await User.updateOne(
      { _id: req.user.id },
      { $push: { devices: { token, platform, lastSeenAt: new Date() } } }
    );

    res.json({ success: true });
  })
);

router.patch(
  "/preferences",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    user.notificationPrefs = { ...user.notificationPrefs.toObject?.() ?? user.notificationPrefs, ...req.body };
    await user.save();
    res.json({ success: true, preferences: user.notificationPrefs });
  })
);

// ---------------------------------------------------------------- admin

const canView = requirePermission("marketing.view");
const canManage = requirePermission("marketing.manage");

router.get(
  "/templates",
  canView,
  asyncHandler(async (req, res) => {
    const templates = await NotificationTemplate.find().sort({ audience: 1, event: 1 });
    res.json({
      success: true,
      templates,
      events: NotificationTemplate.EVENTS,
      channels: NotificationTemplate.CHANNELS,
    });
  })
);

router.patch(
  "/templates/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const template = await NotificationTemplate.findById(req.params.id);
    if (!template) throw ApiError.notFound("Template not found");

    const before = audit.snapshot(template);
    // The event is what fires it; renaming that would silently disconnect it.
    delete req.body.event;
    Object.assign(template, req.body);
    await template.save();

    await audit.record({
      req, action: "update", entity: "NotificationTemplate",
      entityId: template._id, label: template.name,
      before, after: audit.snapshot(template),
    });

    res.json({ success: true, template });
  })
);

router.post(
  "/templates",
  canManage,
  asyncHandler(async (req, res) => {
    const template = await NotificationTemplate.create(req.body);
    await audit.record({
      req, action: "create", entity: "NotificationTemplate",
      entityId: template._id, label: template.name,
    });
    res.status(201).json({ success: true, template });
  })
);

/**
 * Turns a named segment into a recipient filter.
 *
 * The names are resolved here rather than accepted as a Mongo query from the
 * client — a caller that can hand the database its own filter can address
 * anyone, which is not what "send to lapsed customers" should be able to do.
 */
async function audienceFilter({ segment = "all", group }) {
  if (group) {
    const CustomerGroup = require("../customers/customerGroup.model");
    const saved = await CustomerGroup.findById(group).select("members");
    if (!saved) throw ApiError.badRequest("That customer group no longer exists");
    return { _id: { $in: saved.members } };
  }

  if (segment === "all") return {};

  const Order = require("../orders/order.model");
  const stats = await Order.aggregate([
    { $match: { status: "DELIVERED" } },
    { $group: { _id: "$customer", orders: { $sum: 1 }, lastOrderAt: { $max: "$placedAt" } } },
  ]);

  const now = Date.now();
  const days = (date) => (now - new Date(date)) / 86400000;

  if (segment === "new") {
    // Everyone who has never had an order delivered.
    return { _id: { $nin: stats.map((row) => row._id) } };
  }
  if (segment === "repeat") {
    return { _id: { $in: stats.filter((row) => row.orders > 1).map((row) => row._id) } };
  }
  if (segment === "lapsed") {
    return { _id: { $in: stats.filter((row) => days(row.lastOrderAt) > 30).map((row) => row._id) } };
  }

  throw ApiError.badRequest(`Unknown segment “${segment}”`);
}

// A campaign send. Marketing only — transactional events fire from the engine.
router.post(
  "/broadcast",
  canManage,
  asyncHandler(async (req, res) => {
    const { event = "CUSTOM", context = {}, segment = "all", group } = req.body;

    const template = await NotificationTemplate.findOne({ event, audience: "customer" });
    if (template && template.category !== "marketing") {
      throw ApiError.badRequest("Only marketing templates can be broadcast");
    }

    const filter = await audienceFilter({ segment, group });
    const result = await notificationService.broadcast(event, context, { filter });

    await audit.record({
      req, action: "broadcast", entity: "Notification",
      summary: `Sent “${event}” to ${result.sent} of ${result.audience} in ${group ? "a saved group" : segment}`,
    });

    res.json({ success: true, ...result });
  })
);

// The delivery log — what was attempted and what actually went out.
router.get(
  "/log",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.event) filter.event = req.query.event;
    if (req.query.user) filter.user = req.query.user;

    const result = await paginate(Notification, filter, req.query, {
      defaultSort: { createdAt: -1 },
      populate: { path: "user", select: "name phone" },
    });
    res.json({ success: true, ...result });
  })
);

module.exports = router;
