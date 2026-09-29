const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// Merchandising slots the admin fills without a deploy. Placement is a named
// position the clients know about, so adding a banner is data, not layout work.

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
    backgroundColor: { type: String, default: "" },

    placement: {
      type: String,
      enum: ["home_hero", "home_strip", "category_top", "cart", "app_launch"],
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
