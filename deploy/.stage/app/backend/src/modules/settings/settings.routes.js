const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const { requireAuth, requirePermission, optionalAuth } = require("../../middleware/auth");

const Settings = require("./settings.model");
const audit = require("../audit/audit.service");

const router = express.Router();

// What the apps and the website need before anyone signs in: whether the store
// is in maintenance mode, which features are on, and the minimum app version.
// Deliberately a subset — the full document has commercial detail clients have
// no business knowing.
router.get(
  "/public",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const settings = await Settings.load();
    res.json({
      success: true,
      settings: {
        company: {
          name: settings.company.name,
          supportPhone: settings.company.supportPhone,
          supportEmail: settings.company.supportEmail,
          logo: settings.company.logo,
        },
        app: settings.app,
        website: settings.website,
        payment: {
          codEnabled: settings.payment.codEnabled,
          onlineEnabled: settings.payment.onlineEnabled,
          provider: settings.payment.provider,
          allowWallet: settings.payment.allowWallet,
          allowLoyalty: settings.payment.allowLoyalty,
        },
        loyalty: {
          enabled: settings.loyalty.enabled,
          rupeesPerPoint: settings.loyalty.rupeesPerPoint,
          pointValuePaise: settings.loyalty.pointValuePaise,
          minPointsToRedeem: settings.loyalty.minPointsToRedeem,
        },
        referral: {
          enabled: settings.referral.enabled,
          referrerReward: settings.referral.referrerReward,
          refereeReward: settings.referral.refereeReward,
        },
        delivery: {
          slotsEnabled: settings.delivery.slotsEnabled,
          liveTrackingEnabled: settings.delivery.liveTrackingEnabled,
        },
      },
    });
  })
);

router.use(requireAuth);

router.get(
  "/",
  requirePermission("settings.manage"),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, settings: await Settings.load() });
  })
);

// Sections are patched individually so two admins editing different areas do
// not overwrite each other's work with a whole-document PUT.
router.patch(
  "/:section",
  requirePermission("settings.manage"),
  asyncHandler(async (req, res) => {
    const allowed = [
      "company", "tax", "payment", "loyalty", "referral",
      "delivery", "notifications", "app", "website",
    ];
    const { section } = req.params;
    if (!allowed.includes(section)) {
      return res.status(400).json({
        success: false,
        error: { message: `Unknown settings section. Try one of: ${allowed.join(", ")}` },
      });
    }

    const settings = await Settings.load();
    const before = audit.snapshot(settings);

    settings[section] = { ...(settings[section]?.toObject?.() ?? settings[section]), ...req.body };
    settings.updatedBy = req.user.id;
    await settings.save();

    await audit.record({
      req, action: "update", entity: "Settings", entityId: settings._id,
      label: section, before, after: audit.snapshot(settings),
    });

    res.json({ success: true, settings });
  })
);

module.exports = router;
