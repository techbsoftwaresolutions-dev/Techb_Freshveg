const { mongoose, baseOptions, money, percent, objectId } = require("../../core/schemaBase");

// One model covers both auto-applied offers ("20% off all vegetables this
// weekend") and coupons ("WEEKEND100"). The difference is whether a code is
// required, not a different table — otherwise every rule would need writing
// twice.

const OFFER_TYPES = [
  "percentage",
  "fixed",
  "free_delivery",
  "bogo",        // buy X get Y free
  "cashback",    // credited to wallet after delivery
  "free_item",
];

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    // Short line shown on the product card / cart, e.g. "Save ₹50".
    badge: { type: String, default: "" },
    image: { type: String, default: "" },

    // A coupon needs a code typed in; an offer applies on its own.
    requiresCode: { type: Boolean, default: false },
    code: { type: String, uppercase: true, trim: true },

    type: { type: String, enum: OFFER_TYPES, required: true },

    // --- What has to be true for it to apply ---
    conditions: {
      minCartValue: money(0),
      maxCartValue: money(0), // 0 = no ceiling
      minQuantity: { type: Number, default: 0 },
      // Empty array means "no restriction on this dimension". A category here
      // matches anything filed beneath it, because products carry the whole
      // categoryPath.
      categories: [objectId("Category")],
      brands: [objectId("Brand")],
      products: [objectId("Product")],
      variants: [objectId("Variant")],
      stores: [objectId("Store")],
      paymentMethods: { type: [String], default: [] },
      firstOrderOnly: { type: Boolean, default: false },
      newCustomerDays: { type: Number, default: 0 },
      customerTags: { type: [String], default: [] },
    },

    // --- What the customer gets ---
    reward: {
      discountPct: percent(0),
      discountAmount: money(0),
      maxDiscount: money(0),   // caps a percentage discount
      freeDelivery: { type: Boolean, default: false },
      cashbackPct: percent(0),
      cashbackMax: money(0),
      buyQuantity: { type: Number, default: 0 },
      getQuantity: { type: Number, default: 0 },
      freeVariant: objectId("Variant"),
      loyaltyPointsMultiplier: { type: Number, default: 1 },
    },

    schedule: {
      startsAt: Date,
      endsAt: Date,
      daysOfWeek: { type: [Number], default: [] }, // 0=Sun; empty = every day
      startHour: { type: Number, default: null },  // 0-23, for flash sales
      endHour: { type: Number, default: null },
    },

    limits: {
      totalUses: { type: Number, default: 0 },     // 0 = unlimited
      perCustomer: { type: Number, default: 0 },
      usedCount: { type: Number, default: 0 },
    },

    // Whether this can sit on top of another offer, and which wins when two
    // both apply and neither combines.
    combinable: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },

    status: { type: String, enum: ["draft", "active", "paused", "expired"], default: "draft", index: true },
    isFeatured: { type: Boolean, default: false },
    createdBy: objectId("User"),
  },
  baseOptions
);

offerSchema.index({ code: 1 }, { unique: true, sparse: true });
offerSchema.index({ status: 1, requiresCode: 1, "schedule.endsAt": 1 });
offerSchema.index({ "conditions.categories": 1, status: 1 });

offerSchema.statics.TYPES = OFFER_TYPES;

// Live right now: active, inside its date range, and inside its day/hour
// window if it declares one (which is what makes a flash sale a flash sale).
offerSchema.methods.isLive = function isLive(at = new Date()) {
  if (this.status !== "active") return false;

  const { startsAt, endsAt, daysOfWeek, startHour, endHour } = this.schedule || {};
  if (startsAt && at < startsAt) return false;
  if (endsAt && at > endsAt) return false;
  if (daysOfWeek?.length && !daysOfWeek.includes(at.getDay())) return false;

  if (startHour !== null && startHour !== undefined) {
    const hour = at.getHours();
    if (endHour !== null && endHour !== undefined) {
      // A window like 22:00–02:00 wraps past midnight.
      const wraps = endHour < startHour;
      const inWindow = wraps ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
      if (!inWindow) return false;
    } else if (hour < startHour) {
      return false;
    }
  }

  const { totalUses, usedCount } = this.limits || {};
  if (totalUses && usedCount >= totalUses) return false;

  return true;
};

module.exports = mongoose.model("Offer", offerSchema);
