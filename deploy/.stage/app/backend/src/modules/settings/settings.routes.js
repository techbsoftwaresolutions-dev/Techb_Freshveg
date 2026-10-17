const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const { requireAuth, requirePermission, optionalAuth } = require("../../middleware/auth");

const Settings = require("./settings.model");
const audit = require("../audit/audit.service");
const ApiError = require("../../core/ApiError");
const storage = require("../storage/providers");
const branding = require("./branding");

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
          logo: branding.publicBranding(settings).logo,
        },
        app: settings.app,
        website: settings.website,
        branding: branding.publicBranding(settings),
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
          milestones: settings.referral.milestones,
          refereeReward: settings.referral.refereeReward,
          minQualifyingOrderValue: settings.referral.minQualifyingOrderValue,
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
    if (section === "branding") checkBranding(next, settings.branding);
    if (section === "app") checkAppHero(next, settings.website);
    if (section === "referral") checkReferral(next);
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

// Referral rules decide who gets money-equivalent coupons, so nothing
// half-valid is saved: whole non-negative paise, positive whole counts, no
// milestone twice. Milestones are stored in purchase order.
function checkReferral(next) {
  const paise = (value, label) => {
    if (!Number.isInteger(value) || value < 0) throw ApiError.badRequest(`${label} must be a whole, non-negative amount`);
  };
  const count = (value, label, { min = 1 } = {}) => {
    if (!Number.isInteger(value) || value < min) throw ApiError.badRequest(`${label} must be a whole number of at least ${min}`);
  };

  next.enabled = Boolean(next.enabled);
  next.combinable = Boolean(next.combinable);
  if (!Array.isArray(next.milestones)) throw ApiError.badRequest("Milestones must be a list");
  if (next.milestones.length > 20) throw ApiError.badRequest("Up to 20 milestones");
  next.milestones = next.milestones.map((m) => ({ purchases: Number(m?.purchases), reward: Number(m?.reward) }));
  const seen = new Set();
  for (const m of next.milestones) {
    count(m.purchases, "A milestone's purchase count");
    paise(m.reward, `The reward at ${m.purchases} purchases`);
    if (m.reward === 0) throw ApiError.badRequest(`The reward at ${m.purchases} purchases must be more than ₹0 — remove the milestone instead`);
    if (seen.has(m.purchases)) throw ApiError.badRequest(`There are two milestones at ${m.purchases} purchases`);
    seen.add(m.purchases);
  }
  next.milestones.sort((a, b) => a.purchases - b.purchases);

  for (const key of ["repeatReward", "refereeReward", "minQualifyingOrderValue", "couponMinOrderValue"]) {
    next[key] = Number(next[key] ?? 0);
    paise(next[key], key);
  }
  next.repeatEvery = Number(next.repeatEvery ?? 0);
  count(next.repeatEvery, "Repeat every", { min: 0 });
  if ((next.repeatEvery > 0) !== (next.repeatReward > 0)) {
    throw ApiError.badRequest("Set both the repeat interval and its reward, or neither");
  }
  next.couponExpiryDays = Number(next.couponExpiryDays);
  count(next.couponExpiryDays, "Coupon validity (days)");
  if (next.couponExpiryDays > 3650) throw ApiError.badRequest("Coupon validity can be at most 3650 days");
  next.maxRewardsPerReferrer = Number(next.maxRewardsPerReferrer ?? 0);
  count(next.maxRewardsPerReferrer, "Maximum rewards per referrer", { min: 0 });
  next.excludedCategories = Array.isArray(next.excludedCategories) ? next.excludedCategories.map(String) : [];
  if (next.excludedCategories.some((id) => !/^[a-f0-9]{24}$/i.test(id))) throw ApiError.badRequest("Unknown category in exclusions");
  if (next.enabled && !next.milestones.length && !next.repeatEvery) {
    throw ApiError.badRequest("Add at least one reward milestone before switching referrals on");
  }
}

// The app's Video Hero plays the website's playlist, so it needs videos there.
function checkAppHero(app, website) {
  if (!["classic", "video"].includes(app.homeHero)) {
    throw ApiError.badRequest("The app header style must be classic or video");
  }
  if (app.homeHero === "video" && !website?.videoHero?.videos?.length) {
    throw ApiError.badRequest("Add videos under Website → Configure video hero before turning on the app's Video Hero");
  }
}

// Brand images land on every page and in the app builds, so each must be an
// image uploaded to this store's own Cloudinary account — through the upload
// route, which checks its size and shape — or empty (""), for the default.
// A null is a client bug, not a reset, so it keeps the saved image rather
// than blanking a working logo.
function checkBranding(next, saved) {
  for (const key of branding.KEYS) {
    const url = next?.[key];
    if (url === null || url === undefined) next[key] = saved?.[key] || "";
    else if (typeof url !== "string") throw ApiError.badRequest(`${branding.ASSETS[key].label} must be a link`);
    else if (url && !storage.cloudinary.ownsImage(url)) {
      throw ApiError.badRequest(`Upload the ${branding.ASSETS[key].label.toLowerCase()} here rather than pasting a link`);
    }
  }
}

module.exports = router;
