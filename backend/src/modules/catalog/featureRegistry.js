// Category "features" are capability switches that change how the engine
// treats a product, without any category ever being named in code.
//
// The registry below is metadata for the admin UI — label, help text, default.
// The stored value is a free-form map, so a feature added here (or by an
// integration) starts working the moment something reads it; nothing validates
// the key set, on purpose.

const FEATURES = {
  weightBased: {
    label: "Sold by weight",
    help: "Quantity can be fractional (0.5 kg) and the cart shows a weight stepper.",
    default: false,
    affects: ["cart.quantityStep", "product.unit", "pricing.perUnit"],
  },
  perishable: {
    label: "Perishable",
    help: "Tracks harvest / received dates and surfaces a freshness badge.",
    default: false,
    affects: ["inventory.batches", "storefront.freshnessBadge"],
  },
  batchTracking: {
    label: "Batch tracked",
    help: "Stock is held per batch with its own cost and dates.",
    default: false,
    affects: ["inventory.batches", "picking.batchSelection"],
  },
  expiryTracking: {
    label: "Expiry tracked",
    help: "Batches require an expiry date; near-expiry stock is reported.",
    default: false,
    affects: ["inventory.batches", "reports.expiry"],
  },
  returnable: {
    label: "Returnable",
    help: "Customer may raise a return within the category's return window.",
    default: true,
    affects: ["orders.returns"],
  },
  codAllowed: {
    label: "Cash on delivery allowed",
    default: true,
    affects: ["checkout.paymentMethods"],
  },
  ageRestricted: {
    label: "Age restricted",
    help: "Delivery requires an age check at handover.",
    default: false,
    affects: ["delivery.proofOfDelivery"],
  },
  prescriptionRequired: {
    label: "Prescription required",
    default: false,
    affects: ["checkout.documentUpload"],
  },
  fragile: {
    label: "Fragile",
    help: "Flags the packing slip and adds protective packaging charge rules.",
    default: false,
    affects: ["packing", "pricing.packaging"],
  },
  taxInclusivePricing: {
    label: "Prices include tax",
    help: "Selling price is treated as gross; tax is split out on the invoice.",
    default: true,
    affects: ["pricing.tax"],
  },
  allowSubstitution: {
    label: "Allow substitution",
    help: "Picker may substitute a comparable item when out of stock.",
    default: false,
    affects: ["picking.substitution"],
  },
};

const defaults = () =>
  Object.fromEntries(Object.entries(FEATURES).map(([key, def]) => [key, def.default]));

// Nearest-wins inheritance: a child category that says nothing about a feature
// takes its parent's answer, so "Fruits & Vegetables is perishable" is stated
// once and every leaf beneath it inherits.
function resolveFeatures(chain = []) {
  const resolved = defaults();
  for (const category of chain) {
    const own = category.features instanceof Map
      ? Object.fromEntries(category.features)
      : category.features || {};
    for (const [key, value] of Object.entries(own)) {
      if (value !== null && value !== undefined) resolved[key] = value;
    }
  }
  return resolved;
}

module.exports = { FEATURES, defaults, resolveFeatures };
