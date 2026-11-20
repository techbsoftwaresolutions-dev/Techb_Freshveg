const { mongoose, baseOptions, money, objectId } = require("../../core/schemaBase");

// A saved list per customer. The price at the time of saving is kept so the
// engine can tell them when something they wanted gets cheaper.

const wishlistItemSchema = new mongoose.Schema(
  {
    product: objectId("Product", { required: true }),
    variant: objectId("Variant"),
    addedAt: { type: Date, default: Date.now },
    priceWhenAdded: money(0),
    // Set when the customer asks to hear about an out-of-stock item.
    notifyOnRestock: { type: Boolean, default: true },
    notifyOnPriceDrop: { type: Boolean, default: true },
    lastNotifiedAt: Date,
  },
  { _id: true }
);

const wishlistSchema = new mongoose.Schema(
  {
    customer: objectId("User", { required: true, unique: true }),
    items: { type: [wishlistItemSchema], default: [] },
  },
  baseOptions
);

wishlistSchema.index({ "items.product": 1 });

module.exports = mongoose.model("Wishlist", wishlistSchema);
