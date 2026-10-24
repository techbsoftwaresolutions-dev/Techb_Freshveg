const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// Merchandising slots the admin fills without a deploy. Placement is a named
// position the clients know about, so adding a banner is data, not layout work.

// #RRGGBB — the admin's colour picker only reads and writes this form.
const HEX_COLOR = /^(#[0-9a-fA-F]{6})?$/;

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    image: { type: String, default: "" },
    mobileImage: { type: String, default: "" },
    // Where object-fit: cover keeps its crop, as a percentage of the photo
    // (50/50 is dead center). The hero slot in particular stretches this
    // image across a very wide, short box — nothing close to the photo's
    // own aspect ratio — so without this the crop just takes equal amounts
    // off the top and bottom regardless of where the actual subject sits.
    focalX: { type: Number, default: 50, min: 0, max: 100 },
    focalY: { type: Number, default: 50, min: 0, max: 100 },
    // Banner 1 / Banner 2 only.
    // imageScale: zoom, as a percentage — 100 shows the whole photo uncropped,
    //   more zooms in towards focalX/focalY (which then say what stays in view).
    // fade: how far across the banner the colour wash reaches, as a % of its
    //   width (100 covers all of it, 50 the left half, then softens out).
    // fadeOpacity: how strong that wash is, 0–100.
    // height: the banner's height in px on desktop; null = the site's default.
    imageScale: { type: Number, default: 100, min: 100, max: 300 },
    fade: { type: Number, default: 45, min: 0, max: 100 },
    fadeOpacity: { type: Number, default: 100, min: 0, max: 100 },
    height: { type: Number, default: null, min: 120, max: 600 },
    // Hex only ("" = the site's default): both go straight into the
    // storefront's styles, so nothing else gets through.
    backgroundColor: { type: String, default: "", match: HEX_COLOR },
    // Banner 1 / Banner 2: the colour of the wash over the photo.
    fadeColor: { type: String, default: "", match: HEX_COLOR },
    // Only for home_story: the short selling points under its title.
    points: { type: [String], default: [] },

    placement: {
      type: String,
      enum: ["home_hero", "home_story", "home_strip", "category_top", "cart", "app_launch"],
      default: "home_hero",
      index: true,
    },
    // Only for category_top.
    category: objectId("Category"),

    // Where tapping it goes. Kept as a kind + value rather than a raw URL so
    // the same banner works in the apps and on the website.
    target: {
      kind: {
        type: String,
        enum: ["none", "category", "product", "offer", "url", "search"],
        default: "none",
      },
      value: { type: String, default: "" },
    },

    schedule: {
      startsAt: Date,
      endsAt: Date,
    },

    seq: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "active", "paused"], default: "draft", index: true },

    // Rough engagement counters — enough to retire a banner nobody taps.
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  baseOptions
);

bannerSchema.index({ placement: 1, status: 1, seq: 1 });

bannerSchema.methods.isLive = function isLive(at = new Date()) {
  if (this.status !== "active") return false;
  const { startsAt, endsAt } = this.schedule || {};
  if (startsAt && at < startsAt) return false;
  if (endsAt && at > endsAt) return false;
  return true;
};

module.exports = mongoose.model("Banner", bannerSchema);
