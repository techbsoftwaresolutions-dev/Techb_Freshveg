const { mongoose, baseOptions, subdocOptions, objectId } = require("../../core/schemaBase");

// The cart holds *intent* — which variant, how many, at which store. Prices are
// never stored here: they are recomputed by the pricing service on every read,
// so a cart left open overnight shows this morning's price rather than a stale
// one the business would then have to honour.

const cartItemSchema = new mongoose.Schema(
  {
    variant: objectId("Variant", { required: true }),
    product: objectId("Product", { required: true }),
    quantity: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
    // "Saved for later" items stay in the cart document but are excluded from
    // pricing and checkout.
    savedForLater: { type: Boolean, default: false },
    note: { type: String, default: "" },
  },
  subdocOptions
);

const cartSchema = new mongoose.Schema(
  {
    customer: objectId("User", { default: null, index: true }),
    // Guests get a cart keyed by a client-generated id, which is merged into
    // their account cart when they sign in.
    sessionId: { type: String, default: "", index: true },

    store: objectId("Store", { required: true, index: true }),
    items: { type: [cartItemSchema], default: [] },

    couponCode: { type: String, default: "", uppercase: true, trim: true },
    walletRequested: { type: Number, default: 0 },
    loyaltyPointsRequested: { type: Number, default: 0 },

    // Subdocument id of the chosen address on the user — deliberately not a
    // ref, because addresses are embedded rather than a collection of their own.
    deliveryAddress: { type: mongoose.Schema.Types.ObjectId, default: null },
    deliverySlot: {
      date: Date,
      startTime: String,
      endTime: String,
      label: String,
    },

    status: {
      type: String,
      enum: ["active", "converted", "abandoned"],
      default: "active",
      index: true,
    },
    convertedOrder: objectId("Order"),
    // Drives the abandoned-cart reminder: "no activity for 30 minutes and the
    // cart is not empty".
    lastActivityAt: { type: Date, default: Date.now, index: true },
    remindersSent: { type: Number, default: 0 },
  },
  baseOptions
);

cartSchema.index({ customer: 1, store: 1, status: 1 });
cartSchema.index({ status: 1, lastActivityAt: 1 });

cartSchema.virtual("activeItems").get(function activeItems() {
  return this.items.filter((i) => !i.savedForLater && i.quantity > 0);
});

cartSchema.methods.touch = function touch() {
  this.lastActivityAt = new Date();
  this.remindersSent = 0;
  return this;
};

cartSchema.methods.findItem = function findItem(variantId) {
  return this.items.find((i) => String(i.variant) === String(variantId));
};

module.exports = mongoose.model("Cart", cartSchema);
