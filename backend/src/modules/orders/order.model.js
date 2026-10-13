const { mongoose, baseOptions, subdocOptions, money, percent, objectId } = require("../../core/schemaBase");
const { STATUS_KEYS } = require("./orderStatus");

// An order is a *snapshot*, not a set of references. Product names, prices,
// tax rates and the delivery address are all copied in at placement, because
// renaming a product or changing its price next week must not rewrite what a
// customer already bought — and an invoice has to stay reproducible.

const orderItemSchema = new mongoose.Schema(
  {
    variant: objectId("Variant", { required: true }),
    product: objectId("Product", { required: true }),
    category: objectId("Category"),

    // --- Snapshot ---
    name: { type: String, required: true },
    variantName: { type: String, default: "" },
    sku: { type: String, default: "" },
    image: { type: String, default: "" },
    unit: { type: String, default: "pcs" },
    packSize: {
      value: { type: Number, default: 1 },
      unit: { type: String, default: "pcs" },
    },
    // Snapshotted from Variant.weightGrams at order time (same multiplier
    // basis as unitPrice: weightGrams * quantity = this line's shipping
    // weight), so a real "total weight" figure can be shown without
    // re-deriving it from a catalogue that may have since changed.
    weightGrams: { type: Number, default: 0, min: 0 },

    quantity: { type: Number, required: true, min: 0 },
    unitPrice: money(0),
    mrp: money(0),
    lineTotal: money(0),
    discount: money(0),
    payable: money(0),
    taxRatePct: percent(0),
    tax: money(0),

    // Filled during picking — what was actually put in the bag. For loose
    // produce the picked weight rarely matches the ordered weight exactly, and
    // the invoice has to bill what was supplied.
    pickedQuantity: { type: Number, default: null },
    pickedBatchNo: { type: String, default: "" },
    substitutedWith: objectId("Variant"),
    itemStatus: {
      type: String,
      enum: ["pending", "picked", "unavailable", "substituted", "returned"],
      default: "pending",
    },
  },
  subdocOptions
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_KEYS, required: true },
    at: { type: Date, default: Date.now },
    by: objectId("User"),
    byName: { type: String, default: "" },
    byRole: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },

    customer: objectId("User", { required: true, index: true }),
    customerSnapshot: {
      name: String,
      phone: String,
      email: String,
    },

    store: objectId("Store", { required: true, index: true }),
    source: { type: String, enum: ["app", "web", "pos", "phone"], default: "app" },

    status: { type: String, enum: STATUS_KEYS, default: "ORDER_PLACED", index: true },
    statusHistory: { type: [statusEventSchema], default: [] },

    items: { type: [orderItemSchema], default: [] },

    // Mirrors pricing.service's summary block exactly, so the invoice and the
    // checkout screen are guaranteed to agree.
    pricing: {
      itemCount: Number,
      unitCount: Number,
      mrpTotal: money(0),
      subtotal: money(0),
      catalogueSavings: money(0),
      offerDiscount: money(0),
      deliveryCharge: money(0),
      deliveryFree: Boolean,
      packagingCharge: money(0),
      taxTotal: money(0),
      taxBreakup: {
        type: [
          new mongoose.Schema(
            { rate: Number, taxableValue: Number, tax: Number },
            { _id: false }
          ),
        ],
        default: [],
      },
      walletApplied: money(0),
      loyaltyApplied: money(0),
      loyaltyPointsUsed: { type: Number, default: 0 },
      roundOff: { type: Number, default: 0 },
      total: money(0),
      totalSavings: money(0),
      cashbackEarned: money(0),
    },

    appliedOffers: {
      type: [
        new mongoose.Schema(
          {
            offer: objectId("Offer"),
            code: String,
            title: String,
            type: String,
            discount: Number,
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    payment: {
      method: {
        type: String,
        enum: ["cod", "upi", "online", "card", "netbanking", "wallet", "paylater", "store_credit"],
        default: "cod",
      },
      status: {
        type: String,
        enum: ["pending", "authorized", "paid", "failed", "refunded", "partially_refunded"],
        default: "pending",
        index: true,
      },
      provider: { type: String, default: "" },
      transactionId: { type: String, default: "" },
      amountPaid: money(0),
      amountRefunded: money(0),
      paidAt: Date,
      failureReason: { type: String, default: "" },
    },

    delivery: {
      // Snapshot, not a reference — editing a saved address later must not
      // change where a past order was sent.
      address: {
        label: String,
        contactName: String,
        contactPhone: String,
        line1: String,
        line2: String,
        landmark: String,
        city: String,
        state: String,
        pincode: String,
        location: {
          type: { type: String, enum: ["Point"], default: "Point" },
          coordinates: { type: [Number], default: undefined },
        },
      },
      // The delivery area (Admin → Delivery Areas) the order went to — the id
      // to find it, the rest as it was at checkout, so renaming or removing
      // the area later does not rewrite this order.
      area: {
        id: objectId("DeliveryArea", { index: true }),
        name: String,
        city: String,
        state: String,
        pincode: String,
      },
      slot: {
        date: Date,
        startTime: String,
        endTime: String,
        label: String,
      },
      partner: objectId("User", { index: true }),
      partnerName: { type: String, default: "" },
      partnerPhone: { type: String, default: "" },
      assignedAt: Date,
      pickedUpAt: Date,
      arrivedAt: Date,
      deliveredAt: Date,
      expectedBy: Date,

      // Proof of delivery.
      otp: { type: String, default: "" },
      otpVerifiedAt: Date,
      proofPhoto: { type: String, default: "" },
      signature: { type: String, default: "" },
      deliveredLocation: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: undefined },
      },
      instructions: { type: String, default: "" },
      distanceKm: { type: Number, default: 0 },
    },

    cancellation: {
      reason: String,
      by: objectId("User"),
      byRole: String,
      at: Date,
    },

    customerNote: { type: String, default: "" },
    internalNote: { type: String, default: "" },
    rating: {
      order: { type: Number, min: 1, max: 5 },
      delivery: { type: Number, min: 1, max: 5 },
      packaging: { type: Number, min: 1, max: 5 },
      comment: String,
      ratedAt: Date,
    },

    placedAt: { type: Date, default: Date.now, index: true },
  },
  baseOptions
);

// "My orders", newest first.
orderSchema.index({ customer: 1, placedAt: -1 });
// The admin order board, and the per-store delivery queue.
orderSchema.index({ store: 1, status: 1, placedAt: -1 });
orderSchema.index({ "delivery.partner": 1, status: 1 });
orderSchema.index({ code: "text", "customerSnapshot.phone": "text" });

orderSchema.virtual("isOpen").get(function isOpen() {
  return !["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"].includes(this.status);
});

// When a status was reached — what the tracker timestamps each step with.
orderSchema.methods.reachedAt = function reachedAt(status) {
  return this.statusHistory.find((h) => h.status === status)?.at || null;
};

module.exports = mongoose.model("Order", orderSchema);
