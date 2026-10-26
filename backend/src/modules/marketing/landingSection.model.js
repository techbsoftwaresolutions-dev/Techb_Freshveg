const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// One block on the customer landing page (Admin → Landing Page → Sections).
// It only says *what* to show and *where*: the products themselves, and their
// order inside the block, come from the catalog — a category's own order, a
// classification's order (Product.positions, see catalog/sections.service), or
// the hand-picked list of a curated section. Nothing here copies a product.
const landingSectionSchema = new mongoose.Schema(
  {
    // Stable identifier, made from the first name and never changed after.
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", trim: true, maxlength: 200 },

    type: { type: String, enum: ["category", "classification", "curated"], required: true },
    // Only the field matching `type` is read. The others are kept rather than
    // cleared on a type change, so switching back restores what was there.
    source: {
      category: objectId("Category", { default: null }),
      classification: { type: String, default: null },
      products: { type: [objectId("Product")], default: [] },
    },

    // Place on the landing page, 1..n with no gaps (landing.service keeps it so).
    seq: { type: Number, default: 0, index: true },

    // Each platform is its own switch; `status` is separate from both and
    // wins over them — an inactive section shows nowhere.
    showOnWebsite: { type: Boolean, default: true },
    showOnApp: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },

    // Best Seller, Trending and On Discount: other features lean on those
    // classifications, so their sections can be switched off but not deleted.
    system: { type: Boolean, default: false },

    createdBy: objectId("User"),
    updatedBy: objectId("User"),
  },
  baseOptions
);

module.exports = mongoose.model("LandingSection", landingSectionSchema);
