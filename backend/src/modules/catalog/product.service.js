const crypto = require("crypto");
const Product = require("./product.model");
const Variant = require("./variant.model");
const Category = require("./category.model");
const ApiError = require("../../core/ApiError");
const { uniqueSlug, slugify } = require("../../core/slugify");
const { resolveCategorySchema, validateAgainstSchema } = require("./schema.service");

// Products are written *through* their category's resolved schema. Nothing here
// knows what a vegetable or a hair clip is — it asks the category what fields
// exist, validates against that answer, and stores whatever comes back.

// Fills in unit, tax rate, HSN and the rest from the category chain wherever
// the product itself is silent, so a category is configured once instead of
// every product repeating it.
//
// "Silent" is judged from the incoming payload, not from the document: by the
// time a Mongoose document exists its own schema defaults have already filled
// `taxRatePct` with 0, which is indistinguishable from someone deliberately
// entering 0% — and would shadow the category's rate on every product.
const INHERITED_FIELDS = ["unit", "taxRatePct", "hsnCode", "returnWindowDays", "shelfLifeDays"];

function applyCategoryDefaults(product, defaults, payload = {}) {
  for (const field of INHERITED_FIELDS) {
    const stated = payload[field];
    const wasStated = stated !== undefined && stated !== null && stated !== "";
    if (wasStated) continue;

    const inherited = defaults[field];
    if (inherited !== null && inherited !== undefined && inherited !== "") {
      product[field] = inherited;
    }
  }
  return product;
}

function buildSku(product, axisValues, sequence) {
  const base = slugify(product.name).toUpperCase().replace(/-/g, "").slice(0, 10);
  const axis = axisValues
    .map((a) => slugify(a.value).toUpperCase().replace(/-/g, "").slice(0, 6))
    .join("-");
  // name + axis + sequence alone are deterministic: if a variant is ever
  // (re)created instead of matched to its existing row below — the axis
  // fingerprint match can miss, e.g. after a variant's axis fields are
  // edited — the exact same SKU is generated again and collides with the
  // one already stored, which is exactly the "record with this sku already
  // exists" error this was producing. A short random tail makes every
  // generated SKU unique regardless, so a missed match can never collide.
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return [base, axis, sequence ? String(sequence) : "", suffix].filter(Boolean).join("-");
}

async function createProduct(payload, actor = null) {
  const category = await Category.findById(payload.category);
  if (!category) throw ApiError.badRequest("Category not found");

  const schema = await resolveCategorySchema(payload.category);

  const { clean, errors, ok } = validateAgainstSchema(payload.attributes || {}, schema.fields, {
    scope: "product",
  });
  if (!ok) throw ApiError.unprocessable("Some product details are missing or invalid", errors);

  const slug = await uniqueSlug(Product, payload.slug || payload.name);
  const categoryPath = [...category.ancestors, category._id];

  const product = new Product({
    ...payload,
    slug,
    categoryPath,
    attributes: clean,
    // The axes come from the category unless the caller overrides them, which
    // is how "Rice varies by pack size" is configured rather than coded.
    variantAxes: payload.variantAxes?.length
      ? payload.variantAxes
      : schema.variantAxes.map((f) => f.code),
    createdBy: actor?.id,
  });

  applyCategoryDefaults(product, schema.defaults, payload);
  await product.save();

  // A product with no variants cannot be sold, so one is always created —
  // either from the supplied list or as a single default.
  const variantPayloads = payload.variants?.length
    ? payload.variants
    : [{ sellingPrice: payload.sellingPrice || 0, mrp: payload.mrp || 0, isDefault: true }];

  await replaceVariants(product, variantPayloads, schema);
  await refreshRollup(product._id);

  return Product.findById(product._id);
}

async function updateProduct(id, payload, actor = null) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound("Product not found");

  const categoryId = payload.category || product.category;
  const schema = await resolveCategorySchema(categoryId);

  if (payload.attributes) {
    const merged = { ...(product.attributes || {}), ...payload.attributes };
    const { clean, errors, ok } = validateAgainstSchema(merged, schema.fields, { scope: "product" });
    if (!ok) throw ApiError.unprocessable("Some product details are missing or invalid", errors);
    payload.attributes = clean;
  }

  if (payload.slug && payload.slug !== product.slug) {
    payload.slug = await uniqueSlug(Product, payload.slug, product._id);
  }

  if (payload.category && String(payload.category) !== String(product.category)) {
    const category = await Category.findById(payload.category);
    if (!category) throw ApiError.badRequest("Category not found");
    payload.categoryPath = [...category.ancestors, category._id];
  }

  Object.assign(product, payload, { updatedBy: actor?.id });
  // Re-resolve inherited fields too: moving a product to another category has
  // to pick up that category's tax rate and unit unless the caller overrode them.
  applyCategoryDefaults(product, schema.defaults, payload);
  await product.save();

  if (payload.variants) {
    await replaceVariants(product, payload.variants, schema);
  } else if (payload.categoryPath) {
    await Variant.updateMany(
      { product: product._id },
      { category: product.category, categoryPath: payload.categoryPath }
    );
  }

  await refreshRollup(product._id);
  return Product.findById(product._id);
}

// Reconciles the variant set: matching axis combinations are updated in place
// (so their stock rows and order history stay attached), new ones are created,
// and ones no longer listed are archived rather than deleted — a deleted
// variant would orphan the order lines that point at it.
// A category may say "sold in quarter kilos". That applies to a product sold
// as one loose thing; once a product is split into discrete packs, the pack is
// the unit and the step is one pack. Returns 1 in that case, rounding up any
// fractional minimum to a whole pack.
function soldLoose(categoryValue, isSplitIntoPacks) {
  if (categoryValue === null || categoryValue === undefined) return 1;
  if (!isSplitIntoPacks) return categoryValue;
  return categoryValue < 1 ? 1 : categoryValue;
}

async function replaceVariants(product, variantPayloads, schema = null) {
  const resolved = schema || (await resolveCategorySchema(product.category));
  const axisFields = resolved.variantAxes;
  // More than one variant means the product is merchandised as packs/options.
  const isSplitIntoPacks = variantPayloads.length > 1;
  const existing = await Variant.find({ product: product._id });
  const byAxisKey = new Map(existing.map((v) => [v.axisKey, v]));

  const keptKeys = new Set();
  let sequence = 0;

  for (const payload of variantPayloads) {
    sequence += 1;

    const axisValues = (payload.axisValues || []).map((a) => {
      const field = axisFields.find((f) => f.code === a.code);
      const option = field?.options?.find((o) => o.value === String(a.value));
      return { code: a.code, value: String(a.value), label: a.label || option?.label || String(a.value) };
    });

    // Validate the non-axis variant attributes the same way product ones are.
    let attributes = payload.attributes || {};
    if (Object.keys(attributes).length) {
      const { clean, errors, ok } = validateAgainstSchema(attributes, resolved.fields, { scope: "variant" });
      if (!ok) throw ApiError.unprocessable(`Variant "${payload.name || sequence}" has invalid details`, errors);
      attributes = clean;
    }

    const axisKey = axisValues.map((a) => `${a.code}=${a.value}`).sort().join("|");
    keptKeys.add(axisKey);

    const fields = {
      product: product._id,
      category: product.category,
      categoryPath: product.categoryPath,
      axisValues,
      attributes,
      name: payload.name || "",
      barcode: payload.barcode || "",
      packSize: payload.packSize || { value: 1, unit: product.unit },
      mrp: payload.mrp ?? 0,
      sellingPrice: payload.sellingPrice ?? 0,
      costPrice: payload.costPrice ?? 0,
      taxRatePct: payload.taxRatePct ?? product.taxRatePct ?? 0,
      taxInclusive: payload.taxInclusive ?? true,
      weightGrams: payload.weightGrams ?? 0,
      minOrderQty: payload.minOrderQty ?? soldLoose(resolved.defaults.minOrderQty, isSplitIntoPacks),
      maxOrderQty: payload.maxOrderQty ?? resolved.defaults.maxOrderQty ?? 50,
      // The variant model rounds both of these to whole units on save.
      stepQty: payload.stepQty ?? soldLoose(resolved.defaults.stepQty, isSplitIntoPacks),
      lowStockThreshold: payload.lowStockThreshold ?? resolved.defaults.lowStockThreshold ?? 5,
      media: payload.media || [],
      status: payload.status || "active",
      isDefault: Boolean(payload.isDefault),
    };

    const found = byAxisKey.get(axisKey);
    if (found) {
      Object.assign(found, fields);
      await found.save();
    } else {
      await Variant.create({
        ...fields,
        sku: payload.sku || buildSku(product, axisValues, existing.length + sequence),
      });
    }
  }

  const removed = existing.filter((v) => !keptKeys.has(v.axisKey));
  if (removed.length) {
    await Variant.updateMany({ _id: { $in: removed.map((v) => v._id) } }, { status: "archived" });
  }

  return Variant.find({ product: product._id, status: { $ne: "archived" } });
}

// Recomputes the denormalised price band and stock flag that listing pages sort
// and filter on.
async function refreshRollup(productId) {
  const variants = await Variant.find({ product: productId, status: "active" });

  if (!variants.length) {
    await Product.findByIdAndUpdate(productId, {
      priceFrom: 0, priceTo: 0, mrpFrom: 0, maxDiscountPct: 0,
      variantCount: 0, inStock: false, defaultVariant: null,
    });
    return null;
  }

  const prices = variants.map((v) => v.sellingPrice);
  const mrps = variants.map((v) => v.mrp || v.sellingPrice);
  const preferred = variants.find((v) => v.isDefault) || variants.reduce(
    (cheapest, v) => (v.sellingPrice < cheapest.sellingPrice ? v : cheapest),
    variants[0]
  );

  const update = {
    priceFrom: Math.min(...prices),
    priceTo: Math.max(...prices),
    mrpFrom: Math.min(...mrps),
    maxDiscountPct: Math.max(...variants.map((v) => v.discountPct)),
    variantCount: variants.length,
    // A product switched to "sold out" stays out whatever the counts say.
    inStock: !(await Product.exists({ _id: productId, soldOut: true })) && variants.some((v) => v.inStock),
    defaultVariant: preferred._id,
  };

  await Product.findByIdAndUpdate(productId, update);
  return update;
}

module.exports = {
  createProduct,
  updateProduct,
  replaceVariants,
  refreshRollup,
  applyCategoryDefaults,
  buildSku,
};
