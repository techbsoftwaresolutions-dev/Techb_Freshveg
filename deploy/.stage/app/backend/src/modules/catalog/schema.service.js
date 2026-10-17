const Category = require("./category.model");
const Attribute = require("./attribute.model");
const ApiError = require("../../core/ApiError");
const { resolveFeatures } = require("./featureRegistry");

// Resolving a category into a *form schema* is the single idea this engine is
// built on. The admin product form, the storefront filter bar and the
// validation on writes all read this one structure, so adding a category — or
// binding a new attribute to an existing one — changes all three at once with
// nothing to rebuild or redeploy.

const DEFAULT_KEYS = [
  "unit",
  "taxRatePct",
  "hsnCode",
  "shelfLifeDays",
  "lowStockThreshold",
  "returnWindowDays",
  "minOrderQty",
  "maxOrderQty",
  "stepQty",
];

// Nearest-wins, same rule as features: the deepest category that states a
// value supplies it.
function resolveDefaults(chain) {
  const out = {};
  for (const key of DEFAULT_KEYS) out[key] = null;
  for (const category of chain) {
    const own = category.defaults || {};
    for (const key of DEFAULT_KEYS) {
      const value = own[key];
      if (value !== null && value !== undefined && value !== "") out[key] = value;
    }
  }
  return out;
}

// Attribute bindings accumulate down the chain. A deeper category re-binding
// the same attribute wins, which is how "Grocery marks Brand optional, Rice
// makes it required" works without Rice restating the rest.
function collectBindings(chain) {
  const leafId = chain[chain.length - 1]._id.toString();
  const merged = new Map();

  for (const category of chain) {
    for (const binding of category.attributeBindings || []) {
      const plain = typeof binding.toObject === "function" ? binding.toObject() : binding;
      const key = String(plain.attribute?._id || plain.attribute);
      merged.set(key, {
        ...(merged.get(key) || {}),
        ...plain,
        inheritedFromName: category.name,
        isOwn: category._id.toString() === leafId,
      });
    }
  }
  return merged;
}

function toField(attribute, binding) {
  // A binding may leave these unset (null), meaning "take the attribute's own
  // answer". Only an explicit true/false on the binding overrides.
  const isVariantAxis =
    binding.isVariantAxis === null || binding.isVariantAxis === undefined
      ? attribute.isVariantAxis
      : binding.isVariantAxis;

  const filterable =
    binding.filterable === null || binding.filterable === undefined
      ? attribute.isFilterable
      : binding.filterable;

  return {
    attributeId: attribute._id.toString(),
    code: attribute.code,
    label: binding.label || attribute.name,
    helpText: attribute.helpText,
    placeholder: attribute.placeholder,
    inputType: attribute.inputType,
    options: attribute.options,
    unit: attribute.unit,
    unitOptions: attribute.unitOptions,
    group: attribute.group,
    seq: binding.seq ?? attribute.seq ?? 0,
    // A variant axis is stored per variant even when the attribute's own scope
    // says "product" — the binding is the authority.
    scope: isVariantAxis ? "variant" : attribute.scope,
    isVariantAxis,
    filterable,
    filterUi: attribute.filterUi,
    showOnCard: attribute.showOnCard,
    showInSpecs: attribute.showInSpecs,
    required: Boolean(binding.required),
    defaultValue: binding.defaultValue ?? null,
    validation: attribute.validation || {},
    inheritedFrom: binding.isOwn ? null : binding.inheritedFromName,
  };
}

async function resolveCategorySchema(categoryIdOrSlug) {
  const query = /^[0-9a-fA-F]{24}$/.test(String(categoryIdOrSlug))
    ? { _id: categoryIdOrSlug }
    : { slug: categoryIdOrSlug };

  const category = await Category.findOne(query);
  if (!category) throw ApiError.notFound("Category not found");

  const chain = await category.chain();
  const bindings = collectBindings(chain);

  const attributes = await Attribute.find({
    _id: { $in: [...bindings.keys()] },
    status: "active",
  });

  const fields = attributes
    .map((attribute) => toField(attribute, bindings.get(attribute._id.toString())))
    .sort((a, b) => a.seq - b.seq || a.label.localeCompare(b.label));

  // Grouped copy so the admin form can render sections without regrouping.
  const groups = [];
  for (const field of fields) {
    let group = groups.find((g) => g.name === field.group);
    if (!group) {
      group = { name: field.group, fields: [] };
      groups.push(group);
    }
    group.fields.push(field);
  }

  return {
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      path: category.path,
      level: category.level,
      icon: category.icon,
    },
    chain: chain.map((c) => ({ id: c.id, name: c.name, slug: c.slug, level: c.level })),
    features: resolveFeatures(chain),
    defaults: resolveDefaults(chain),
    displayConfig: category.displayConfig,
    fields,
    groups,
    variantAxes: fields.filter((f) => f.isVariantAxis),
    filters: fields.filter((f) => f.filterable),
  };
}

// Checks a product's or variant's attribute values against the resolved
// schema. Returns a cleaned { code: value } map plus per-field errors, so a
// write can be rejected with messages the form shows inline.
function validateAgainstSchema(values = {}, fields, { scope } = {}) {
  const errors = {};
  const clean = {};

  for (const field of fields) {
    if (scope && field.scope !== scope) continue;

    let value = values[field.code];
    if (value === undefined || value === null || value === "") {
      if (field.defaultValue !== null && field.defaultValue !== undefined) {
        value = field.defaultValue;
      } else {
        if (field.required) errors[field.code] = `${field.label} is required`;
        continue;
      }
    }

    switch (field.inputType) {
      case "number":
      case "measure": {
        const n = Number(value);
        if (Number.isNaN(n)) {
          errors[field.code] = `${field.label} must be a number`;
          continue;
        }
        const { min, max } = field.validation || {};
        if (min !== undefined && min !== null && n < min) {
          errors[field.code] = `${field.label} must be at least ${min}`;
          continue;
        }
        if (max !== undefined && max !== null && n > max) {
          errors[field.code] = `${field.label} must be at most ${max}`;
          continue;
        }
        clean[field.code] = n;
        break;
      }

      case "boolean":
        clean[field.code] = Boolean(value);
        break;

      case "select": {
        const allowed = field.options.map((o) => o.value);
        if (!allowed.includes(String(value))) {
          errors[field.code] = `${field.label} must be one of: ${allowed.join(", ")}`;
          continue;
        }
        clean[field.code] = String(value);
        break;
      }

      case "multiselect": {
        const allowed = new Set(field.options.map((o) => o.value));
        const list = Array.isArray(value) ? value.map(String) : [String(value)];
        const unknown = list.filter((v) => !allowed.has(v));
        if (unknown.length) {
          errors[field.code] = `${field.label}: unknown option(s) ${unknown.join(", ")}`;
          continue;
        }
        clean[field.code] = list;
        break;
      }

      case "date": {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          errors[field.code] = `${field.label} must be a date`;
          continue;
        }
        clean[field.code] = date;
        break;
      }

      default: {
        const str = String(value);
        const { minLength, maxLength, pattern } = field.validation || {};
        if (minLength && str.length < minLength) {
          errors[field.code] = `${field.label} must be at least ${minLength} characters`;
          continue;
        }
        if (maxLength && str.length > maxLength) {
          errors[field.code] = `${field.label} must be at most ${maxLength} characters`;
          continue;
        }
        if (pattern && !new RegExp(pattern).test(str)) {
          errors[field.code] = `${field.label} is not in the expected format`;
          continue;
        }
        clean[field.code] = str;
      }
    }
  }

  return { clean, errors, ok: Object.keys(errors).length === 0 };
}

module.exports = { resolveCategorySchema, validateAgainstSchema, resolveDefaults };
