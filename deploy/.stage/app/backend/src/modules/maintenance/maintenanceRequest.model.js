const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// One job on one asset: raised, assigned to someone, worked on, closed with a
// cost. Parts are itemised because "what did this freezer cost us this year"
// is the question that decides whether to replace it.

const maintenanceRequestSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    asset: objectId("MaintenanceAsset", { required: true, index: true }),
    assetName: { type: String, default: "" },
    store: objectId("Store", { required: true, index: true }),

    type: {
      type: String,
      enum: ["scheduled", "breakdown", "inspection", "installation"],
      default: "breakdown",
      index: true,
    },
    priority: { type: String, enum: ["low", "normal", "high", "critical"], default: "normal", index: true },

    title: { type: String, required: true },
    description: { type: String, default: "" },
    images: { type: [String], default: [] },

    status: {
      type: String,
      enum: ["open", "assigned", "in_progress", "on_hold", "completed", "cancelled"],
      default: "open",
      index: true,
    },

    reportedBy: objectId("User"),
    reportedByName: { type: String, default: "" },

    technician: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      company: { type: String, default: "" },
      isInternal: { type: Boolean, default: false },
      user: objectId("User"),
    },

    scheduledFor: Date,
    startedAt: Date,
    completedAt: Date,
    // How long the asset was actually unusable — the number that matters for a
    // freezer, separate from how long the job took.
    downtimeMinutes: { type: Number, default: 0 },

    partsUsed: {
      type: [
        new mongoose.Schema(
          { name: String, quantity: Number, unitCost: Number, total: Number },
          { _id: false }
        ),
      ],
      default: [],
    },
    labourCost: money(0),
    partsCost: money(0),
    totalCost: money(0),

    resolutionNote: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
  },
  baseOptions
);

maintenanceRequestSchema.index({ store: 1, status: 1, createdAt: -1 });
maintenanceRequestSchema.index({ asset: 1, createdAt: -1 });

// From the shared atomic counter, not a row count: a count repeats a code
// after a delete, and hands two simultaneous requests the same one.
maintenanceRequestSchema.statics.nextCode = async function nextCode() {
  const { nextSequence, highestIssued } = require("../../core/sequence");
  // Numbering starts at MNT-1001, as it always has.
  const floor = Math.max(1000, await highestIssued(this, "MNT-"));
  const seq = await nextSequence("maintenance-request", { floor });
  return `MNT-${String(seq).padStart(4, "0")}`;
};

// Costs are derived from the parts list, never entered twice.
maintenanceRequestSchema.pre("save", function totalCosts(next) {
  this.partsCost = (this.partsUsed || []).reduce(
    (sum, part) => sum + (part.total || (part.unitCost || 0) * (part.quantity || 0)),
    0
  );
  this.totalCost = this.partsCost + (this.labourCost || 0);
  next();
});

module.exports = mongoose.model("MaintenanceRequest", maintenanceRequestSchema);
