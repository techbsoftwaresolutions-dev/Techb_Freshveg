const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const { requireAuth, requirePermission, optionalAuth } = require("../../middleware/auth");

const Settings = require("./settings.model");
const audit = require("../audit/audit.service");
const ApiError = require("../../core/ApiError");
const storage = require("../storage/providers");

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
        branding: settings.branding,
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
      "delivery", "notifications", "app", "website", "branding",
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

    const next = { ...(settings[section]?.toObject?.() ?? settings[section]), ...req.body };
    if (section === "website") checkVideoHero(next);
    if (section === "branding") checkBranding(next);
    settings[section] = next;
    settings.updatedBy = req.user.id;
    await settings.save();

    await audit.record({
      req, action: "update", entity: "Settings", entityId: settings._id,
      label: section, before, after: audit.snapshot(settings),
    });

    res.json({ success: true, settings });
  })
);

// The Video Hero design cannot go live half-configured, and only videos from
// this store's own Cloudinary account may play on the homepage.
function checkVideoHero(website) {
  const hero = website?.videoHero;
  const videos = hero?.videos || [];
  if (videos.length > 20) throw ApiError.badRequest("A hero playlist can hold up to 20 videos");
  if (videos.some((video) => !storage.cloudinary.ownsVideo(video?.url))) {
    throw ApiError.badRequest("Hero videos must be uploaded through the video library");
  }
  if (new Set(videos.map((video) => video.url)).size !== videos.length) {
    throw ApiError.badRequest("A video can appear in the hero playlist only once");
  }
  if (website?.homeTemplate === "video") {
    if (!videos.length) throw ApiError.badRequest("Choose at least one video before turning on Video Hero");
    if (!String(hero?.text || "").trim()) throw ApiError.badRequest("Add the hero text before turning on Video Hero");
  }
}

// The logo and favicon land on every storefront page, so they must be images
// uploaded to this store's own Cloudinary account (or empty, for the defaults).
function checkBranding(branding) {
  for (const [key, label] of [["logo", "logo"], ["favicon", "favicon"]]) {
    const url = branding?.[key];
    if (url && !storage.cloudinary.ownsImage(url)) {
      throw ApiError.badRequest(`Upload the ${label} here rather than pasting a link`);
    }
  }
}

module.exports = router;
