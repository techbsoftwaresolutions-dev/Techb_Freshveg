const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// Every change to stock writes one of these. `onHand` on the Inventory row is
// a running total; this collection is the history that explains it, which is
// what makes a discrepancy investigable instead of just wrong.

const MOVEMENT_TYPES = [
  "receive",        // goods in from a supplier
  "adjust",         // manual correction after a count
  "reserve",        // promised to an order, still physically present
  "release",        // reservation cancelled, stock freed
  "dispatch",       // picked and sent out; leaves onHand
  "return",         // came back from a customer
  "damage",         // written off
  "transfer_out",
  "transfer_in",
  "count",          // stock take result
];

const stockMovementSchema = new mongoose.Schema(
  {
    store: objectId("Store", { required: true, index: true }),
    variant: objectId("Variant", { required: true, index: true }),
    product: objectId("Product", { index: true }),

    type: { type: String, enum: MOVEMENT_TYPES, required: true, index: true },
    // Signed: +20 received, -3 dispatched. Reserve/release move `reserved`
    // rather than `onHand`, which is why both totals are recorded below.
    quantity: { type: Number, required: true },

    onHandBefore: { type: Number, default: 0 },
    onHandAfter: { type: Number, default: 0 },
    reservedBefore: { type: Number, default: 0 },
    reservedAfter: { type: Number, default: 0 },

    batchNo: { type: String, default: "" },
    costPrice: money(0),

    // What caused it — an order, a transfer, a purchase receipt.
    refType: { type: String, default: "" },
    refId: { type: mongoose.Schema.Types.ObjectId },
    refCode: { type: String, default: "" }, // human-readable, e.g. ORD-1042

    reason: { type: String, default: "" },
    note: { type: String, default: "" },
    actor: objectId("User"),
    actorName: { type: String, default: "" },
  },
  baseOptions
);

stockMovementSchema.index({ store: 1, variant: 1, createdAt: -1 });
stockMovementSchema.index({ refType: 1, refId: 1 });
stockMovementSchema.index({ createdAt: -1 });

stockMovementSchema.statics.TYPES = MOVEMENT_TYPES;

module.exports = mongoose.model("StockMovement", stockMovementSchema);
