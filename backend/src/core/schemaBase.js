const mongoose = require("mongoose");

// Shared schema options for every model in the engine.
//
// `id` in API responses is the ObjectId as a string — clients never see `_id`
// or `__v`. Indexes are declared on the schemas but built deliberately
// (`npm run sync-indexes`) rather than on every boot, so a cold start never
// blocks on an index build against a large collection.
const baseOptions = {
  timestamps: true,
  autoIndex: false,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

// Subdocuments that carry their own _id need the same treatment, and do NOT
// inherit it from the parent schema's options.
//
// Without this an embedded address serialises as `_id` while every client
// reads `id`: the checkout address picker silently never selects anything (so
// "Place order" stays disabled), and React renders the list with `key`
// undefined. One missing transform, two symptoms that look unrelated.
const subdocOptions = {
  _id: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

// Money is stored in the smallest currency unit (paise) as an integer.
// Floating-point rupees drift once you multiply by a quantity and then apply a
// percentage discount, and those fractions of a paisa end up as invoice
// mismatches — so every price field in the engine is `paise`.
const money = (defaultValue = 0) => ({
  type: Number,
  default: defaultValue,
  min: 0,
  // Guard against a caller passing 49.5 rupees where paise are expected.
  validate: {
    validator: Number.isInteger,
    message: "{PATH} must be an integer number of paise",
  },
});

const percent = (defaultValue = 0) => ({
  type: Number,
  default: defaultValue,
  min: 0,
  max: 100,
});

const objectId = (ref, options = {}) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref,
  ...options,
});

module.exports = { mongoose, baseOptions, subdocOptions, money, percent, objectId };
