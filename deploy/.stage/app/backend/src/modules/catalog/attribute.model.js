const { mongoose, baseOptions } = require("../../core/schemaBase");

// An Attribute is a reusable field definition. Categories bind attributes;
// products and variants carry values for whatever their category binds.
//
// This is what lets a new category ship without a deploy: "Fancy > Hair
// Accessories" needs Colour and Material, "Grocery > Rice" needs Grain Length
// and Polish — both are rows here, not branches in the product form.

const optionSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    // Swatch colour for colour-style filters, image for pattern swatches.
    hex: { type: String, default: "" },
    image: { type: String, default: "" },
    seq: { type: Number, default: 0 },
  },
  { _id: false }
);

const INPUT_TYPES = [
  "text",
  "textarea",
  "richtext",
  "number",
  "measure", // number + unit, e.g. 500 g
  "select",
  "multiselect",
  "boolean",
  "date",
  "color",
];

const attributeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z][a-z0-9_]*$/, "Code must be snake_case, starting with a letter"],
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    inputType: { type: String, enum: INPUT_TYPES, default: "text" },
    options: { type: [optionSchema], default: [] },

    unit: { type: String, default: "" },
    unitOptions: { type: [String], default: [] },

    // product-scope values live on the Product; variant-scope values live on
    // each Variant and are what a variant axis is built from.
    scope: { type: String, enum: ["product", "variant"], default: "product" },
    isVariantAxis: { type: Boolean, default: false },

    isFilterable: { type: Boolean, default: false },
    filterUi: {
      type: String,
      enum: ["checkbox", "swatch", "range", "toggle"],
      default: "checkbox",
    },
    isSearchable: { type: Boolean, default: false },
    isComparable: { type: Boolean, default: false },

    showOnCard: { type: Boolean, default: false },
    showInSpecs: { type: Boolean, default: true },

    // Groups the admin form into sections without any layout code per category.
    group: { type: String, default: "General", trim: true },
    seq: { type: Number, default: 0 },
    placeholder: { type: String, default: "" },
    helpText: { type: String, default: "" },

    validation: {
      min: Number,
      max: Number,
      step: Number,
      minLength: Number,
      maxLength: Number,
      pattern: String,
    },

    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    isSystem: { type: Boolean, default: false }, // seeded; UI hides the delete button
  },
  baseOptions
);

attributeSchema.index({ scope: 1, status: 1 });
attributeSchema.index({ name: "text", code: "text" });

// A select-type attribute is useless without options — catch it at write time
// rather than when a product form renders an empty dropdown.
attributeSchema.pre("validate", function requireOptions(next) {
  const needsOptions = ["select", "multiselect"].includes(this.inputType);
  if (needsOptions && this.options.length === 0) {
    return next(new Error(`Attribute "${this.code}" is a ${this.inputType} and needs at least one option`));
  }
  if (this.isVariantAxis && this.scope !== "variant") {
    this.scope = "variant";
  }
  return next();
});

attributeSchema.statics.INPUT_TYPES = INPUT_TYPES;

module.exports = mongoose.model("Attribute", attributeSchema);
