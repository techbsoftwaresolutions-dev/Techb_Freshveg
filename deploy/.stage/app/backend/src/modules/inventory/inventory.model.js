const { mongoose, baseOptions, subdocOptions, money, objectId } = require("../../core/schemaBase");

// One row per (store, variant). Stock is never a number on the product: the
// same tomato is 40 kg in Hosur and out of stock in Bangalore, and a listing
// has to answer for the store serving *this* customer.

const batchSchema = new mongoose.Schema(
  {
    batchNo: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    costPrice: money(0),

    // Dates a grocery business actually tracks. Which of these are required is
    // decided by the category's features (batchTracking / expiryTracking /
    // perishable), not by this schema.
    manufacturedOn: Date,
    harvestedOn: Date,
    receivedOn: { type: Date, default: Date.now },
    expiresOn: { type: Date, index: true },
    bestBefore: Date,

    supplier: { type: String, default: "" },
    grade: { type: String, default: "" }, // A / B, for produce quality
  },
  subdocOptions
);

const inventorySchema = new mongoose.Schema(
  {
    store: objectId("Store", { required: true, index: true }),
    variant: objectId("Variant", { required: true, index: true }),
    product: objectId("Product", { required: true, index: true }),
    category: objectId("Category"),

    // onHand is physical stock. reserved is stock already promised to orders
    // that have not been picked yet — subtracting it is what stops two
    // customers buying the last packet in the same minute.
    onHand: { type: Number, default: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    damaged: { type: Number, default: 0, min: 0 },

    batches: { type: [batchSchema], default: [] },

    lowStockThreshold: { type: Number, default: 5 },
    binLocation: { type: String, default: "" },
    lastCountedAt: Date,
    lastReceivedAt: Date,
  },
  baseOptions
);

inventorySchema.index({ store: 1, variant: 1 }, { unique: true });
inventorySchema.index({ store: 1, product: 1 });
// Backs the low-stock report without a full scan.
inventorySchema.index({ store: 1, onHand: 1 });

inventorySchema.virtual("available").get(function available() {
  return Math.max(0, (this.onHand || 0) - (this.reserved || 0));
});

inventorySchema.virtual("isLow").get(function isLow() {
  return this.available <= (this.lowStockThreshold ?? 5);
});

// Oldest usable batch first — FEFO (first expired, first out) for anything with
// an expiry, falling back to receipt order. This is the order a picker should
// take stock in, and what the engine consumes on dispatch.
inventorySchema.methods.pickingOrder = function pickingOrder() {
  return [...(this.batches || [])]
    .filter((b) => b.quantity > 0)
    .sort((a, b) => {
      if (a.expiresOn && b.expiresOn) return a.expiresOn - b.expiresOn;
      if (a.expiresOn) return -1;
      if (b.expiresOn) return 1;
      return (a.receivedOn || 0) - (b.receivedOn || 0);
    });
};

// Batches at or past `days` from expiry — the "sell it today" report, and what
// an automatic markdown rule would read.
inventorySchema.methods.nearExpiry = function nearExpiry(days = 3) {
  const cutoff = new Date(Date.now() + days * 86400000);
  return (this.batches || []).filter(
    (b) => b.quantity > 0 && b.expiresOn && b.expiresOn <= cutoff
  );
};

module.exports = mongoose.model("Inventory", inventorySchema);
