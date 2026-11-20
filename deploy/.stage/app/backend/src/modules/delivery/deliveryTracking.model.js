const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// Location pings from a delivery partner's phone during a run.
//
// Stored as a capped history per order rather than a single "current position",
// so a dispute about where a rider actually went has an answer. Old pings are
// swept by a TTL index — this is operational data, not a permanent record.

const deliveryTrackingSchema = new mongoose.Schema(
  {
    order: objectId("Order", { required: true, index: true }),
    partner: objectId("User", { required: true, index: true }),

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },

    accuracyMetres: { type: Number, default: 0 },
    speedKmph: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    // Distance left to the drop, computed when the ping is recorded so the
    // customer's screen does not have to.
    distanceToCustomerKm: { type: Number, default: null },
    etaMinutes: { type: Number, default: null },

    status: { type: String, default: "" }, // the order status at ping time
    batteryPct: { type: Number, default: null },
  },
  baseOptions
);

deliveryTrackingSchema.index({ order: 1, createdAt: -1 });
deliveryTrackingSchema.index({ location: "2dsphere" });
// Pings are useful for a few days, not forever.
deliveryTrackingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

module.exports = mongoose.model("DeliveryTracking", deliveryTrackingSchema);
