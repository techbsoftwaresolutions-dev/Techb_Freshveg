const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// "Notify me" on an out-of-stock item. One row per customer per variant while
// it is waiting; when the item is back the row turns "ready" (and the customer
// is notified once), then "seen" once the website has shown it.
const stockAlertSchema = new mongoose.Schema(
  {
    customer: objectId("User", { required: true, index: true }),
    product: objectId("Product", { required: true, index: true }),
    variant: objectId("Variant", { required: true, index: true }),
    status: { type: String, enum: ["waiting", "ready", "seen"], default: "waiting", index: true },
    readyAt: Date,
  },
  baseOptions
);

// At most one live ("waiting") request per customer and variant.
stockAlertSchema.index(
  { customer: 1, variant: 1 },
  { unique: true, partialFilterExpression: { status: "waiting" } }
);

module.exports = mongoose.models.StockAlert || mongoose.model("StockAlert", stockAlertSchema);
