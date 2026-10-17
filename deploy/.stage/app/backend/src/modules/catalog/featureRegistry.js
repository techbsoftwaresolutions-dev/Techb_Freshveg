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
    default: false,
    affects: ["cart.quantityStep", "product.unit", "pricing.perUnit"],
  },
  perishable: {
    label: "Perishable",
    default: false,
    affects: ["inventory.batches", "storefront.freshnessBadge"],
  },
  batchTracking: {
    label: "Batch tracked",
    default: false,
    affects: ["inventory.batches", "picking.batchSelection"],
  },
  expiryTracking: {
    label: "Expiry tracked",
    default: false,
    affects: ["inventory.batches", "reports.expiry"],
  },
  returnable: {
    label: "Returnable",
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
    default: false,
    affects: ["packing", "pricing.packaging"],
  },
  taxInclusivePricing: {
    label: "Prices include tax",
    default: true,
    affects: ["pricing.tax"],
  },
  allowSubstitution: {
    label: "Allow substitution",
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
