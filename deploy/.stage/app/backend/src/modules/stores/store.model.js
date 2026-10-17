const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// Multi-store is in the model from day one, because retrofitting it means
// touching inventory, pricing, orders and delivery at once. A single-branch
// business simply runs with one store flagged `isDefault`.

const storeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["store", "warehouse", "dark_store"],
      default: "store",
    },

    address: {
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      country: { type: String, default: "IN" },
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },

    contact: {
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      managerName: { type: String, default: "" },
    },
    manager: objectId("User"),

    // Coarse serviceability. Delivery zones (drawn polygons, per-zone charges)
    // refine this; a pincode list is what a small operation actually maintains.
    servicePincodes: { type: [String], default: [], index: true },
    // The named places behind those pincodes ("Sarjapura", "Dommasandra").
    // Both fields are a copy of this store's active delivery areas, written by
    // deliveryArea.service.syncStore — edit areas in Admin → Delivery Areas.
    serviceAreas: {
      type: [
        new mongoose.Schema(
          {
            pincode: { type: String, required: true, match: /^\d{6}$/ },
            name: { type: String, default: "", trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    serviceRadiusKm: { type: Number, default: 0 },

    timings: {
      type: [
        new mongoose.Schema(
          {
            day: { type: Number, min: 0, max: 6 }, // 0 = Sunday
            open: { type: String, default: "08:00" },
            close: { type: String, default: "22:00" },
            closed: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    // Commercial rules are per store: a city branch can carry a higher free
    // delivery threshold than a small-town one without a code change.
    settings: {
      minOrderValue: money(0),
      // Whether the "free above ₹X" rule is on at all. Off hides the customer
      // progress card and stops the threshold from waiving delivery; the
      // amount below is kept so switching it back on needs no retyping.
      freeDeliveryEnabled: { type: Boolean, default: true },
      freeDeliveryAbove: money(0),
      deliveryCharge: money(0),
      packagingCharge: money(0),
      maxCodValue: money(500000), // ₹5,000
      codEnabled: { type: Boolean, default: true },
      prepTimeMinutes: { type: Number, default: 30 },
      acceptingOrders: { type: Boolean, default: true },
      // (Delivery boys are store employees on a salary, so there is no
      // per-delivery fee here; the old partnerFeePerDelivery value is removed
      // from saved stores by src/migrations/20261014-retire-delivery-fee.js.)

      // Manual UPI collection: no payment gateway, just a VPA (or UPI-linked
      // mobile number) the customer pays from their own UPI app. The order is
      // created with payment pending, same as cash on delivery, and staff
      // confirm it once the money actually lands — see payment.service.js.
      upi: {
        enabled: { type: Boolean, default: false },
        vpa: { type: String, default: "", trim: true },
        payeeName: { type: String, default: "", trim: true },
      },
    },

    status: { type: String, enum: ["active", "paused", "closed"], default: "active", index: true },
    isDefault: { type: Boolean, default: false },
  },
  baseOptions
);

storeSchema.index({ location: "2dsphere" });
storeSchema.index({ status: 1, isDefault: -1 });

// Whether the store is taking orders right now — status, the manual kill
// switch, and today's opening hours, in that order.
storeSchema.methods.isOpenNow = function isOpenNow(at = new Date()) {
  if (this.status !== "active") return false;
  if (!this.settings?.acceptingOrders) return false;

  const today = this.timings?.find((t) => t.day === at.getDay());
  if (!today) return true; // no hours configured means always open
  if (today.closed) return false;

  const minutes = at.getHours() * 60 + at.getMinutes();
  const [openH, openM] = String(today.open).split(":").map(Number);
  const [closeH, closeM] = String(today.close).split(":").map(Number);
  return minutes >= openH * 60 + openM && minutes <= closeH * 60 + closeM;
};

// The areas a store delivers to, as stored: every pincode in servicePincodes
// appears, with its named places where they were given. Stores saved before
// areas had names come back as bare pincodes.
storeSchema.methods.deliveryAreas = function deliveryAreas() {
  const named = (this.serviceAreas || []).map((a) => ({ pincode: a.pincode, name: a.name || "" }));
  const covered = new Set(named.map((a) => a.pincode));
  const bare = (this.servicePincodes || []).filter((p) => !covered.has(p)).map((pincode) => ({ pincode, name: "" }));
  return [...named, ...bare];
};

const Store = mongoose.model("Store", storeSchema);

module.exports = Store;
