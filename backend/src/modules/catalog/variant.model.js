const { mongoose, baseOptions, money, percent, objectId } = require("../../core/schemaBase");

// A Variant is the sellable unit — the thing with a SKU, a price and stock.
// "Tomato 1 KG", "India Gate Basmati 5 KG", "Hair Clip / Pink".
//
// Cart lines, inventory rows and order lines all point at a Variant, never at a
// Product, so nothing downstream has to ask "which size did they mean?".

const axisValueSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },   // Attribute.code, e.g. "pack_size"
    value: { type: String, required: true },  // "5kg"
    label: { type: String, default: "" },     // "5 KG" — what the UI shows
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    product: objectId("Product", { required: true, index: true }),
    // Denormalised from the product so stock and price filters can run without
    // a join; kept in step by product.service.
    category: objectId("Category", { index: true }),
    categoryPath: { type: [objectId("Category")], default: [] },

    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true }, // "5 KG", "Pink"

    axisValues: { type: [axisValueSchema], default: [] },
    // Deterministic fingerprint of the axis values, so the same combination
    // cannot be created twice for one product. Built in the pre-validate hook.
    axisKey: { type: String, default: "" },

    // Variant-scope attribute values that are not axes (e.g. per-size HSN).
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },

    // What one unit of this variant physically is — 1 kg, 500 g, a pack of 6.
    packSize: {
      value: { type: Number, default: 1, min: 0 },
      unit: { type: String, default: "pcs" },
    },

    mrp: money(0),          // printed price, what the strikethrough shows
    sellingPrice: money(0), // what the customer pays
    costPrice: money(0),    // for margin reports; never sent to storefront clients
    taxRatePct: percent(0),
    taxInclusive: { type: Boolean, default: true },

    media: {
      type: [
        new mongoose.Schema(
          { url: String, alt: { type: String, default: "" }, seq: { type: Number, default: 0 } },
          { _id: false }
        ),
      ],
      default: [],
    },

    weightGrams: { type: Number, default: 0, min: 0 }, // shipping / slot capacity

    // Order quantity rules. Loose vegetables use stepQty 0.25 with unit "kg";
    // packaged goods leave it at 1.
    minOrderQty: { type: Number, default: 1, min: 0 },
    maxOrderQty: { type: Number, default: 50, min: 0 },
    stepQty: { type: Number, default: 1, min: 0 },

    lowStockThreshold: { type: Number, default: 5 },

    status: { type: String, enum: ["active", "hidden", "archived"], default: "active", index: true },
    isDefault: { type: Boolean, default: false },

    // Denormalised across every store, so a listing can say "out of stock"
    // without summing the inventory collection. Per-store availability still
    // comes from Inventory at cart and checkout time.
    totalStock: { type: Number, default: 0 },
    inStock: { type: Boolean, default: false, index: true },
  },
  baseOptions
);

variantSchema.index({ product: 1, axisKey: 1 }, { unique: true });
variantSchema.index({ product: 1, sellingPrice: 1 });
variantSchema.index({ categoryPath: 1, status: 1, sellingPrice: 1 });

variantSchema.virtual("discountPct").get(function discountPct() {
  if (!this.mrp || this.mrp <= this.sellingPrice) return 0;
  return Math.round(((this.mrp - this.sellingPrice) / this.mrp) * 100);
});

variantSchema.virtual("savings").get(function savings() {
  return Math.max(0, (this.mrp || 0) - (this.sellingPrice || 0));
});

// Price per base unit, so a listing can show "₹64 / kg" under a 5 KG pack and
// let customers compare pack sizes honestly.
variantSchema.virtual("unitPrice").get(function unitPrice() {
  const size = this.packSize?.value;
  if (!size || size <= 0) return null;
  return {
    amount: Math.round(this.sellingPrice / size),
    unit: this.packSize.unit,
  };
});

variantSchema.pre("validate", function buildAxisKey(next) {
  // Sorted by code so { colour, size } and { size, colour } fingerprint the
  // same — otherwise the uniqueness index would let a duplicate through.
  this.axisKey = (this.axisValues || [])
    .map((a) => `${a.code}=${a.value}`)
    .sort()
    .join("|");

  if (!this.name && this.axisValues?.length) {
    this.name = this.axisValues.map((a) => a.label || a.value).join(" / ");
  }

  // MRP below selling price would render as a negative discount.
  if (this.mrp && this.mrp < this.sellingPrice) this.mrp = this.sellingPrice;

  return next();
});

module.exports = mongoose.model("Variant", variantSchema);
