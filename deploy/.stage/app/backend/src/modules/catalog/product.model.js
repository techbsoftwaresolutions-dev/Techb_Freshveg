const { mongoose, baseOptions, money, percent, objectId } = require("../../core/schemaBase");

// A Product is the thing a customer recognises — "Tomato", "India Gate Basmati
// Rice", "Hair Clip". What they actually buy is a Variant of it. Even a product
// with one size has exactly one variant, so pricing, stock and cart lines never
// need a special case for "products without variants".

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: "" },
    type: { type: String, enum: ["image", "video"], default: "image" },
    seq: { type: Number, default: 0 },
    // Where object-fit: cover should keep its focus, as a percentage of the
    // photo (50/50 is dead center). Source photos are rarely framed with the
    // subject centered — a wide product shot or one with a second item near
    // the edge crops badly at the square card size otherwise, and there is
    // no crop that works for every photo, so this lets whoever uploads it
    // nudge the visible crop instead of the card always guessing center.
    focalX: { type: Number, default: 50, min: 0, max: 100 },
    focalY: { type: Number, default: 50, min: 0, max: 100 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, default: "", trim: true },
    description: { type: String, default: "" },

    category: objectId("Category", { required: true, index: true }),
    // The full chain including the leaf. Browsing "Grocery" must return things
    // filed under "Grocery > Staples > Rice", and this makes that one indexed
    // query rather than a category subtree lookup on every request.
    categoryPath: { type: [objectId("Category")], default: [], index: true },
    brand: objectId("Brand", { default: null, index: true }),

    productType: {
      type: String,
      enum: ["simple", "variable", "weight", "combo"],
      default: "simple",
    },

    // Resolved from the category chain when not set explicitly — see
    // product.service.applyCategoryDefaults.
    unit: { type: String, default: "pcs" },
    taxRatePct: percent(0),
    hsnCode: { type: String, default: "" },
    returnWindowDays: { type: Number, default: null },
    shelfLifeDays: { type: Number, default: null },

    media: { type: [mediaSchema], default: [] },

    // Product-scope attribute values, keyed by Attribute.code. Loose on
    // purpose: the shape is whatever the category's schema says it is.
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Attribute codes that split this product into variants, in axis order.
    variantAxes: { type: [String], default: [] },

    ingredients: { type: String, default: "" },
    nutrition: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Free-form rows for anything the category schema does not model.
    specifications: {
      type: [
        new mongoose.Schema(
          { label: String, value: String, seq: { type: Number, default: 0 } },
          { _id: false }
        ),
      ],
      default: [],
    },

    tags: { type: [String], default: [], index: true },
    searchKeywords: { type: [String], default: [] },

    relatedProducts: [objectId("Product")],
    frequentlyBoughtTogether: [objectId("Product")],

    status: {
      type: String,
      enum: ["draft", "active", "hidden", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: Date,
    isFeatured: { type: Boolean, default: false, index: true },

    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },

    // Denormalised from the variants so a listing page can sort and filter by
    // price without joining. Rebuilt by product.service.refreshRollup whenever
    // a variant changes.
    priceFrom: money(0),
    priceTo: money(0),
    mrpFrom: money(0),
    maxDiscountPct: percent(0),
    variantCount: { type: Number, default: 0 },
    defaultVariant: objectId("Variant", { default: null }),
    inStock: { type: Boolean, default: false, index: true },
    // A manual "sold out" switch. It takes the product off sale — listed as
    // sold out, can't be carted or ordered — without touching the stock
    // counts, so turning it off again puts back exactly what was there. A
    // count forced to 0 instead would lose the real figure and come back as
    // "in stock" the next time a delivery was received.
    soldOut: { type: Boolean, default: false },

    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: { type: [String], default: [] },
    },

    createdBy: objectId("User"),
    updatedBy: objectId("User"),
  },
  baseOptions
);

// Storefront listing: "active products in this category, cheapest first".
productSchema.index({ categoryPath: 1, status: 1, priceFrom: 1 });
productSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ brand: 1, status: 1 });
// Search. Name is weighted hardest so "rice" finds the product before it finds
// everything that merely mentions rice in a description.
productSchema.index(
  { name: "text", searchKeywords: "text", shortDescription: "text", tags: "text" },
  { weights: { name: 10, searchKeywords: 6, tags: 3, shortDescription: 1 }, name: "product_search" }
);

productSchema.virtual("variants", {
  ref: "Variant",
  localField: "_id",
  foreignField: "product",
});

productSchema.virtual("primaryImage").get(function primaryImage() {
  const image = this.media?.find((m) => m.type === "image");
  return image?.url || "";
});

module.exports = mongoose.model("Product", productSchema);
