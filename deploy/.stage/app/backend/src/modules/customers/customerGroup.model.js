const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// A named set of customers, either hand-picked or defined by a rule. Offers
// and campaigns target groups rather than individuals, so "20% for our top
// 100 customers" is a query, not a spreadsheet.

const customerGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    colour: { type: String, default: "#2547C8" },

    kind: { type: String, enum: ["manual", "dynamic"], default: "manual" },

    // For dynamic groups: recomputed on a schedule rather than on every read,
    // because "customers who spent over ₹5,000" is an aggregation, not a filter.
    rules: {
      minOrders: { type: Number, default: null },
      minSpend: { type: Number, default: null },
      lastOrderWithinDays: { type: Number, default: null },
      inactiveForDays: { type: Number, default: null },
      pincodes: { type: [String], default: [] },
    },

    members: [objectId("User")],
    memberCount: { type: Number, default: 0 },
    lastComputedAt: Date,

    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
  },
  baseOptions
);

customerGroupSchema.index({ members: 1 });

module.exports = mongoose.model("CustomerGroup", customerGroupSchema);
