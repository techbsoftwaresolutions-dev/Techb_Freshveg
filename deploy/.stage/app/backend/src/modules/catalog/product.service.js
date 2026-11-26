const Product = require("./product.model");
const Variant = require("./variant.model");
const Category = require("./category.model");
const ApiError = require("../../core/ApiError");
const { uniqueSlug, slugify } = require("../../core/slugify");
const { nextSequence } = require("../../core/sequence");
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


// Product codes: a short form of the product's name, a dash, and a running
// number that is unique across the whole catalogue:
//   Oreo Cream Biscuits -> OCB-001, Apple -> APP-002, Banana -> BANA-003
// Short form: one word -> its first 3 letters (4 for a word of 6+ letters);
// several words -> the first letter of each. Anything in brackets ("(500 g)")
// and apostrophes are ignored.
function shortCode(name) {
  const words = String(name || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/['’`]/g, "") // Haldiram's -> Haldirams
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (!words.length) return "ITEM";
  if (words.length === 1) {
    const w = words[0];
    return w.slice(0, w.length >= 6 ? 4 : 3);
  }
  return words.map((w) => w[0]).join("").slice(0, 6);
}

// The running number comes from one counter ("productCode"), started above
// the highest number already on a code, so a number is never handed out twice.
async function nextProductCode(name) {
  const base = shortCode(name);
  const [top] = await Variant.aggregate([
    { $match: { sku: { $regex: /-\d+$/ } } },
    { $project: { n: { $toLong: { $arrayElemAt: [{ $split: ["$sku", "-"] }, -1] } } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const n = await nextSequence("productCode", { floor: top?.n || 0 });
    const code = `${base}-${String(n).padStart(3, "0")}`;
    if (!(await Variant.exists({ $or: [{ sku: code }, { barcode: code }] }))) return code;
  }
  return `${base}-${Date.now().toString().slice(-6)}`;
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

// Product codes must be unique: a barcode or SKU already used by another
// product (or twice in this one) is refused before anything is saved —
// scanning at the till and the QR code both look a product up by it, so two
// products sharing one would ring up the wrong item.
async function assertCodesUnique(product, variantPayloads) {
  const seen = new Map();
  for (const payload of variantPayloads) {
    for (const raw of [payload.barcode, payload.sku]) {
      const code = String(raw || "").trim();
      if (!code) continue;
      const key = code.toUpperCase();
      if (seen.has(key) && seen.get(key) !== payload) {
        throw ApiError.conflict(`Product code ${code} is used twice in this product. Give each size its own code.`);
      }
      seen.set(key, payload);
    }
  }
  if (!seen.size) return;
  const codes = [...seen.keys()];
  const raw = variantPayloads.flatMap((p) => [p.barcode, p.sku]).map((c) => String(c || "").trim()).filter(Boolean);
  const clash = await Variant.findOne({
    product: { $ne: product._id },
    status: { $ne: "archived" },
    $or: [{ sku: { $in: codes } }, { barcode: { $in: [...new Set([...raw, ...codes])] } }],
  })
    .populate("product", "name status")
    .lean();
  if (clash && clash.product?.status !== "archived") {
    const taken = codes.find((c) => c === clash.sku) || raw.find((c) => c === clash.barcode) || clash.barcode || clash.sku;
    throw ApiError.conflict(
      `Product code ${taken} is already used by "${clash.product?.name || "another product"}". Product codes must be unique.`
    );
  }
}

async function replaceVariants(product, variantPayloads, schema = null) {
  const resolved = schema || (await resolveCategorySchema(product.category));
  const axisFields = resolved.variantAxes;
  // More than one variant means the product is merchandised as packs/options.
  const isSplitIntoPacks = variantPayloads.length > 1;
  const existing = await Variant.find({ product: product._id });
  const byId = new Map(existing.map((v) => [String(v._id), v]));
  const byAxisKey = new Map(existing.map((v) => [v.axisKey, v]));

  // Which stored variants this save has claimed, so two rows can never end up
  // writing to the same one (that is how a second pack used to overwrite the first).
  const keptIds = new Set();
  let sequence = 0;

  await assertCodesUnique(product, variantPayloads);

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

    const axisKey = Variant.keyFor(axisValues, payload.name);

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

    // Match the row to its stored variant by id first (the admin sends it), then
    // by fingerprint. A lone variant sent without either still lands on the
    // product's one existing variant, as it always has.
    let found = (payload.id && byId.get(String(payload.id))) || byAxisKey.get(axisKey) || null;
    if (!found && variantPayloads.length === 1) {
      const live = existing.filter((v) => v.status !== "archived");
      if (live.length === 1) found = live[0];
    }
    if (found && keptIds.has(String(found._id))) found = null;

    if (found) {
      Object.assign(found, fields);
      await found.save();
      keptIds.add(String(found._id));
    } else {
      const created = await Variant.create({
        ...fields,
        sku: payload.sku || (await nextProductCode(product.name)),
      });
      keptIds.add(String(created._id));
    }
  }

  const removed = existing.filter((v) => !keptIds.has(String(v._id)));
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
      variantCount: 0, totalStock: 0, inStock: false, defaultVariant: null,
    });
    return null;
  }

  const prices = variants.map((v) => v.sellingPrice);
  const mrps = variants.map((v) => v.mrp || v.sellingPrice);
  const preferred = variants.find((v) => v.isDefault) || variants.reduce(
    (cheapest, v) => (v.sellingPrice < cheapest.sellingPrice ? v : cheapest),
    variants[0]
  );
  const totalStock = variants.reduce((sum, v) => sum + (v.totalStock || 0), 0);

  const update = {
    priceFrom: Math.min(...prices),
    priceTo: Math.max(...prices),
    mrpFrom: Math.min(...mrps),
    maxDiscountPct: Math.max(...variants.map((v) => v.discountPct)),
    variantCount: variants.length,
    totalStock,
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
  nextProductCode,
  shortCode,
};
