const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// A zone refines a store's coarse pincode list: the far side of a pincode can
// cost more to reach and take longer, and some pockets are not worth serving
// at all. Zones are what the checkout actually prices against when they exist.

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    store: objectId("Store", { required: true, index: true }),

    // Two ways to describe a zone. Pincodes are what a small operation
    // maintains by hand; a polygon is what you draw once you care about the
    // difference between two ends of the same pincode.
    pincodes: { type: [String], default: [], index: true },
    polygon: {
      type: { type: String, enum: ["Polygon"], default: undefined },
      coordinates: { type: [[[Number]]], default: undefined }, // [[[lng, lat], …]]
    },

    // Distance band from the store, when neither of the above is set.
    radiusKm: { type: Number, default: 0 },

    deliveryCharge: money(0),
    freeDeliveryAbove: money(0),
    minOrderValue: money(0),
    // Added to the store's prep time to give an honest promise.
    extraMinutes: { type: Number, default: 0 },

    codEnabled: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "paused"], default: "active", index: true },
    // Checked in order, so a specific zone can sit inside a general one.
    priority: { type: Number, default: 0 },
    colour: { type: String, default: "#2547C8" }, // for the admin map
  },
  baseOptions
);

deliveryZoneSchema.index({ store: 1, status: 1, priority: -1 });
deliveryZoneSchema.index({ polygon: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("DeliveryZone", deliveryZoneSchema);
