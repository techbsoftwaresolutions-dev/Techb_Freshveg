const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// The physical kit a grocery business runs on. A freezer that fails overnight
// is a whole day of stock, so the point of this module is the *schedule* —
// knowing a service is due before the thing breaks.

const TYPES = [
  "refrigerator", "freezer", "cold_room", "pos_machine", "weighing_machine",
  "delivery_vehicle", "cctv", "generator", "air_conditioner", "computer", "other",
];

const maintenanceAssetSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: TYPES, default: "other", index: true },

    store: objectId("Store", { required: true, index: true }),
    location: { type: String, default: "" }, // "Back room", "Van 2"

    make: { type: String, default: "" },
    model: { type: String, default: "" },
    serialNumber: { type: String, default: "" },

    purchasedOn: Date,
    purchaseCost: money(0),
    warrantyUntil: Date,
    supplier: { type: String, default: "" },

    // How often it needs looking at, and when that was last done.
    serviceIntervalDays: { type: Number, default: 90 },
    lastServicedOn: Date,
    nextServiceDue: { type: Date, index: true },

    status: {
      type: String,
      enum: ["operational", "needs_attention", "under_repair", "retired"],
      default: "operational",
      index: true,
    },

    notes: { type: String, default: "" },
    // Running total from completed requests, so cost-per-asset is a read not a join.
    lifetimeMaintenanceCost: money(0),
  },
  baseOptions
);

maintenanceAssetSchema.index({ store: 1, status: 1 });
maintenanceAssetSchema.statics.TYPES = TYPES;

// Keeps the due date in step whenever a service is recorded.
maintenanceAssetSchema.methods.scheduleNext = function scheduleNext(from = new Date()) {
  if (!this.serviceIntervalDays) return this;
  this.lastServicedOn = from;
  this.nextServiceDue = new Date(from.getTime() + this.serviceIntervalDays * 86400000);
  return this;
};

maintenanceAssetSchema.virtual("isOverdue").get(function isOverdue() {
  return Boolean(this.nextServiceDue && this.nextServiceDue < new Date());
});

module.exports = mongoose.model("MaintenanceAsset", maintenanceAssetSchema);
