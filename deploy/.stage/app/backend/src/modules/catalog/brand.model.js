const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },
    // Which departments this brand shows up under, so a brand filter on a
    // category page can be built without scanning products.
    categories: [objectId("Category")],
    isFeatured: { type: Boolean, default: false },
    seq: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "hidden", "archived"], default: "active", index: true },
    productCount: { type: Number, default: 0 },
  },
  baseOptions
);

brandSchema.index({ name: "text" });
brandSchema.index({ categories: 1, status: 1 });

module.exports = mongoose.model("Brand", brandSchema);
