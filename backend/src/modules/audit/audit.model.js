const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// Who changed what, when, and from where.
//
// The value is in the diff, not the fact: "Raj updated Apple" is noise,
// "Raj changed Apple's price from ₹120 to ₹130" is the thing you go looking
// for six weeks later when the margin report looks wrong.

const auditLogSchema = new mongoose.Schema(
  {
    actor: objectId("User", { index: true }),
    actorName: { type: String, default: "" },
    actorRole: { type: String, default: "" },

    action: { type: String, required: true, index: true }, // create | update | delete | custom verb
    entity: { type: String, required: true, index: true }, // Product, Order, Offer…
    entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
    entityLabel: { type: String, default: "" },            // human name at the time

    // Only the fields that actually changed, as { field: { from, to } }.
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    summary: { type: String, default: "" },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
  },
  baseOptions
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
