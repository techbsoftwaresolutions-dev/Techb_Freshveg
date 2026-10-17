const { mongoose, baseOptions, money, percent } = require("../../core/schemaBase");

// One settings document for the whole platform (`key: "global"`), so a change
// is a single write and reads can be cached under one key.
//
// Store-level commercial rules live on the Store — these are the things that
// apply everywhere: tax behaviour, loyalty maths, which channels notifications
// go out on, what the apps are allowed to do.

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },

    company: {
      name: { type: String, default: "Samagra Mart" },
      legalName: { type: String, default: "" },
      gstin: { type: String, default: "" },
      fssai: { type: String, default: "" },
      supportPhone: { type: String, default: "" },
      supportEmail: { type: String, default: "" },
      address: { type: String, default: "" },
      logo: { type: String, default: "" },
    },

    tax: {
      // Prices in this engine are tax-inclusive by default — that is what a
      // shopper in India expects to see on a shelf label.
      pricesIncludeTax: { type: Boolean, default: true },
      defaultRatePct: percent(5),
      // Intra-state sales split the same rate into CGST + SGST; inter-state is
      // a single IGST line. The split is presentational — the total is the same.
      splitCgstSgst: { type: Boolean, default: true },
      homeStateCode: { type: String, default: "33" }, // Tamil Nadu
    },

    payment: {
      codEnabled: { type: Boolean, default: true },
      onlineEnabled: { type: Boolean, default: false },
      provider: { type: String, enum: ["none", "razorpay"], default: "none" },
      // Keys are read from the environment, never stored here — a settings
      // document ends up in backups, logs and admin screens.
      testMode: { type: Boolean, default: true },
      allowWallet: { type: Boolean, default: true },
      allowLoyalty: { type: Boolean, default: true },
      autoRefundToWallet: { type: Boolean, default: true },
    },

    loyalty: {
      enabled: { type: Boolean, default: true },
      // ₹100 spent earns 1 point; 100 points are worth ₹10.
      rupeesPerPoint: { type: Number, default: 100 },
      pointValuePaise: { type: Number, default: 10 },
      minPointsToRedeem: { type: Number, default: 100 },
      maxRedeemPctOfOrder: percent(20),
      expiryDays: { type: Number, default: 365 },
    },

    // Referral & Rewards (Admin → Marketing → Referral & Rewards). Rules and
    // their exact meaning: referrals/referral.service.js. Rewards are issued
    // as single-use coupons, never wallet cash.
    referral: {
      // Off: no new attributions, and purchases delivered while off neither
      // count nor earn. Existing links, progress and issued coupons are kept,
      // and progress resumes from where it was when it is switched back on.
      enabled: { type: Boolean, default: true },
      // The referrer earns `reward` when a referred friend's count of
      // qualifying purchases reaches exactly `purchases`. Validated on save:
      // positive whole counts, no duplicates.
      milestones: {
        type: [{ _id: false, purchases: { type: Number, required: true }, reward: money(0) }],
        default: () => [{ purchases: 1, reward: 5000 }],
      },
      // After the last milestone, every `repeatEvery` further qualifying
      // purchases earn `repeatReward` again (0 = no repeating rewards).
      repeatEvery: { type: Number, default: 0, min: 0 },
      repeatReward: money(0),
      // A one-off welcome coupon for the new customer on their first
      // qualifying purchase (0 = none).
      refereeReward: money(5000),
      // Basis: merchandise subtotal after catalogue prices and offers, before
      // delivery, packaging, wallet, points and reward coupons.
      minQualifyingOrderValue: money(19900),
      couponExpiryDays: { type: Number, default: 30, min: 1 },
      // Merchandise value the cart must reach to redeem a reward coupon.
      couponMinOrderValue: money(0),
      // Whether a reward coupon may sit on the same order as an offer coupon
      // code. Automatic offers (no code) always apply.
      combinable: { type: Boolean, default: false },
      // Most coupons one referrer can ever earn (0 = no cap).
      maxRewardsPerReferrer: { type: Number, default: 0, min: 0 },
      // Items in these categories (and below) are not discounted by a reward
      // coupon.
      excludedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    },

    delivery: {
      slotsEnabled: { type: Boolean, default: true },
      slotDays: { type: Number, default: 3 },      // how far ahead slots open
      liveTrackingEnabled: { type: Boolean, default: true },
      proofPhotoRequired: { type: Boolean, default: false },
      proofSignatureRequired: { type: Boolean, default: false },
      otpRequired: { type: Boolean, default: true },
    },

    notifications: {
      channels: {
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
      },
      abandonedCart: {
        enabled: { type: Boolean, default: true },
        firstReminderMinutes: { type: Number, default: 30 },
        secondReminderHours: { type: Number, default: 6 },
        secondReminderCoupon: { type: String, default: "" },
      },
      winBack: {
        enabled: { type: Boolean, default: true },
        inactiveDays: { type: Number, default: 30 },
      },
      lowStockAlerts: { type: Boolean, default: true },
    },

    app: {
      minSupportedVersion: { type: String, default: "0.1.0" },
      maintenanceMode: { type: Boolean, default: false },
      maintenanceMessage: { type: String, default: "" },
      guestCheckoutEnabled: { type: Boolean, default: false },
      reviewsEnabled: { type: Boolean, default: true },
      reviewsNeedApproval: { type: Boolean, default: true },
      wishlistEnabled: { type: Boolean, default: true },
      // The customer app's home hero, chosen in Admin → Settings → Apps and
      // independent of the website's homeTemplate. "classic" is the banner
      // strip; "video" plays the website's Video Hero playlist
      // (website.videoHero), so the videos are uploaded once.
      homeHero: { type: String, enum: ["classic", "video"], default: "classic" },
      // The words over the app's hero, on either style. Empty text: Video
      // Hero falls back to the website's hero text, Classic shows the banner
      // alone.
      heroText: { type: String, maxlength: 300, trim: true, default: "" },
      heroCtaLabel: { type: String, maxlength: 30, trim: true, default: "Shop Now" },
    },

    website: {
      title: { type: String, default: "Samagra Mart" },
      tagline: { type: String, default: "Fresh from the market, at your door" },
      metaDescription: { type: String, default: "" },
      socialLinks: { type: mongoose.Schema.Types.Mixed, default: {} },
      // Which homepage layout the storefront renders — chosen in Admin →
      // Settings, applies to every visitor. "classic" is the original design,
      // "fresh" the "Farm Fresh Goodness" layout, "video" the Classic page
      // with a full-card background video as its hero.
      homeTemplate: { type: String, enum: ["classic", "fresh", "video"], default: "classic" },
      // Kept when another design is chosen, so switching back needs no
      // re-upload. Videos are Cloudinary references, never the bytes.
      videoHero: {
        text: {
          type: String,
          maxlength: 300,
          default: "100% source traceable natural harvest from 800+ farms across South India.",
        },
        ctaLabel: { type: String, maxlength: 30, default: "Shop Now" },
        videos: {
          type: [
            {
              _id: false,
              url: { type: String, required: true },
              publicId: String,
              name: String,
              duration: Number,
              bytes: Number,
              width: Number,
              height: Number,
            },
          ],
          default: [],
        },
      },
    },

    // Brand images, uploaded in Admin → Settings → Branding (rules and the
    // runtime vs build-time split: ./branding.js). Cloudinary URLs only, never
    // the bytes. Empty means each client's bundled default.
    branding: {
      logo: { type: String, default: "" }, // headers, sign-in screens, loaders
      symbol: { type: String, default: "" }, // the compact mark: footers, admin sidebar
      favicon: { type: String, default: "" }, // browser tab (website, admin)
      shareImage: { type: String, default: "" }, // Open Graph / link previews
      // Launcher icons, one per app, applied at app build time. The customer
      // icon is also the website's "Add to Home Screen" icon (live).
      customerAppIcon: { type: String, default: "" },
      deliveryAppIcon: { type: String, default: "" },
      splash: { type: String, default: "" }, // splash artwork, applied at app build time
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  baseOptions
);

// There is exactly one settings document; create it on first read so nothing
// downstream has to handle "settings do not exist yet".
settingsSchema.statics.load = async function load() {
  const existing = await this.findOne({ key: "global" });
  if (existing) return existing;
  return this.create({ key: "global" });
};

module.exports = mongoose.model("Settings", settingsSchema);
