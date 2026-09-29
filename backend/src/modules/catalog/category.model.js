const { mongoose, baseOptions, objectId } = require("../../core/schemaBase");

// Categories are an arbitrary-depth tree. "Fruits & Vegetables > Leafy Greens"
// and "Grocery > Staples > Rice" are the same structure at different depths —
// nothing in the engine assumes two levels, so a new department is a row.

const bindingSchema = new mongoose.Schema(
  {
    attribute: objectId("Attribute", { required: true }),
    required: { type: Boolean, default: false },
    // A category may promote an attribute to a variant axis even when the
    // attribute itself is not one by default (weight is an axis for Rice, a
    // plain spec for a Hair Clip).
    isVariantAxis: { type: Boolean, default: null },
    filterable: { type: Boolean, default: null },
    label: { type: String, default: "" },      // overrides Attribute.name here
    defaultValue: { type: mongoose.Schema.Types.Mixed },
    seq: { type: Number, default: 0 },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },

    parent: objectId("Category", { default: null, index: true }),
    // Root-first list of every ancestor. Denormalised so a subtree query is a
    // single indexed lookup instead of a recursive walk, and so a product can
    // be found under any level of its category chain.
    ancestors: { type: [objectId("Category")], default: [] },
    path: { type: String, default: "", index: true }, // "/grocery/staples/rice"
    level: { type: Number, default: 0, index: true },

    icon: { type: String, default: "" },   // emoji or icon name
    image: { type: String, default: "" },
    banner: { type: String, default: "" },
    color: { type: String, default: "" },  // tile background on the app home

    seq: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "hidden", "archived"], default: "active", index: true },
    showInNav: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },

    // Capability switches — see featureRegistry.js. Stored loose (Mixed) and
    // resolved nearest-wins down the chain, so a child overrides one flag
    // without restating the rest.
    features: { type: mongoose.Schema.Types.Mixed, default: {} },

    attributeBindings: { type: [bindingSchema], default: [] },

    // Inherited the same way features are: a product picks these up unless it
    // states its own.
    //
    // Every field here defaults to null rather than to a value, because
    // inheritance has to tell "this category says nothing, ask my parent"
    // apart from "this category says zero". 0% tax is a real answer for fresh
    // produce and must beat Grocery's 5%; an unset rate on Rice must not.
    defaults: {
      unit: { type: String, default: null },      // pcs, kg, g, l, ml, pack
      taxRatePct: { type: Number, default: null, min: 0, max: 100 },
      hsnCode: { type: String, default: null },
      shelfLifeDays: { type: Number, default: null },
      lowStockThreshold: { type: Number, default: null },
      returnWindowDays: { type: Number, default: null },
      minOrderQty: { type: Number, default: null },
      maxOrderQty: { type: Number, default: null },
      stepQty: { type: Number, default: null },   // 0.25 for loose vegetables
    },

    displayConfig: {
      layout: { type: String, enum: ["grid", "list", "carousel", "banner-grid"], default: "grid" },
      columns: { type: Number, default: 2, min: 1, max: 6 },
      cardStyle: { type: String, enum: ["compact", "tall", "wide"], default: "compact" },
      showBrandFilter: { type: Boolean, default: true },
    },

    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: { type: [String], default: [] },
    },

    productCount: { type: Number, default: 0 }, // denormalised, refreshed on write
  },
  baseOptions
);

categorySchema.index({ parent: 1, seq: 1 });
categorySchema.index({ ancestors: 1, status: 1 });
categorySchema.index({ name: "text" });

categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Keeps ancestors / path / level correct whenever a category is created or
// reparented. Descendants are fixed up by the service layer, which is the only
// place that knows how to walk them.
categorySchema.methods.recomputeLineage = async function recomputeLineage() {
  if (!this.parent) {
    this.ancestors = [];
    this.level = 0;
    this.path = `/${this.slug}`;
    return this;
  }
  const Category = this.constructor;
  const parent = await Category.findById(this.parent).select("ancestors path level slug");
  if (!parent) throw new Error("Parent category not found");

  this.ancestors = [...parent.ancestors, parent._id];
  this.level = parent.level + 1;
  this.path = `${parent.path}/${this.slug}`;
  return this;
};

// Root-first chain including this category — what feature and attribute
// inheritance is resolved over.
categorySchema.methods.chain = async function chain() {
  const Category = this.constructor;
  if (!this.ancestors.length) return [this];
  const ancestors = await Category.find({ _id: { $in: this.ancestors } });
  const byId = new Map(ancestors.map((c) => [c._id.toString(), c]));
  const ordered = this.ancestors.map((id) => byId.get(id.toString())).filter(Boolean);
  return [...ordered, this];
};

module.exports = mongoose.model("Category", categorySchema);
