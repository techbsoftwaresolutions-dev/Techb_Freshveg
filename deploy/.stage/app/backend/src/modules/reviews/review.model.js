const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// Ratings for a product, and for the delivery experience, are different
// questions with different owners: a bruised apple is the buyer's problem with
// the produce, a late handover is a problem with the run. Keeping them on one
// document but separately scored lets the admin act on each.

const reviewSchema = new mongoose.Schema(
  {
    customer: objectId("User", { required: true, index: true }),
    customerName: { type: String, default: "" },

    // A review is always tied to an order — no review without a purchase, which
    // is what keeps the ratings meaningful.
    order: objectId("Order", { required: true, index: true }),
    orderCode: { type: String, default: "" },

    product: objectId("Product", { index: true }),
    variant: objectId("Variant"),

    productRating: { type: Number, min: 1, max: 5 },
    deliveryRating: { type: Number, min: 1, max: 5 },
    packagingRating: { type: Number, min: 1, max: 5 },

    title: { type: String, default: "", trim: true },
    comment: { type: String, default: "", trim: true },
    images: { type: [String], default: [] },

    status: {
      type: String,
      enum: ["pending", "published", "rejected"],
      default: "pending",
      index: true,
    },
    moderatedBy: objectId("User"),
    moderatedAt: Date,
    moderationNote: { type: String, default: "" },

    helpfulCount: { type: Number, default: 0 },
    // Always true here, since a review requires an order — kept explicit so the
    // storefront can badge it.
    verifiedPurchase: { type: Boolean, default: true },
  },
  baseOptions
);

// One review per product per order: a customer can review each thing they
// bought, once.
reviewSchema.index({ order: 1, product: 1 }, { unique: true, sparse: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
