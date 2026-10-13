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

    referral: {
      enabled: { type: Boolean, default: true },
      referrerReward: money(5000), // ₹50 to the person who shared
      refereeReward: money(5000),  // ₹50 to the new customer
      minFirstOrderValue: money(19900),
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

    // The storefront's own logo (header) and browser-tab icon, uploaded in
    // Admin → Settings → Branding. Empty means the bundled defaults.
    branding: {
      logo: { type: String, default: "" },
      favicon: { type: String, default: "" },
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
