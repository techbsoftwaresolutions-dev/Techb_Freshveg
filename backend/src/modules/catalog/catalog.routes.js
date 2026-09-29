const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const ApiError = require("../../core/ApiError");
const { paginate, escapeRegex } = require("../../core/query");
const { requireAuth, requirePermission } = require("../../middleware/auth");

const Attribute = require("./attribute.model");
const Category = require("./category.model");
const Brand = require("./brand.model");
const Product = require("./product.model");
const Variant = require("./variant.model");

const categoryService = require("./category.service");
const productService = require("./product.service");
const audit = require("../audit/audit.service");
const { resolveCategorySchema } = require("./schema.service");
const { FEATURES } = require("./featureRegistry");
const { uniqueSlug } = require("../../core/slugify");

const router = express.Router();

// Everything in this file is admin-side. The storefront reads the same data
// through its own router, which never exposes cost price or draft records.
router.use(requireAuth);

const canView = requirePermission("catalog.view");
const canManage = requirePermission("catalog.manage");

// ---------------------------------------------------------------- attributes

router.get(
  "/attributes",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.scope) filter.scope = req.query.scope;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ name: rx }, { code: rx }];
    }
    const result = await paginate(Attribute, filter, req.query, { defaultSort: { group: 1, seq: 1 } });
    res.json({ success: true, ...result });
  })
);

router.get(
  "/attributes/input-types",
  canView,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, inputTypes: Attribute.INPUT_TYPES });
  })
);

router.post(
  "/attributes",
  canManage,
  asyncHandler(async (req, res) => {
    const attribute = await Attribute.create(req.body);
    res.status(201).json({ success: true, attribute });
  })
);

router.patch(
  "/attributes/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const attribute = await Attribute.findById(req.params.id);
    if (!attribute) throw ApiError.notFound("Attribute not found");
    // The code is what product documents are keyed by; changing it would
    // silently orphan every stored value.
    delete req.body.code;
    Object.assign(attribute, req.body);
    await attribute.save();
    res.json({ success: true, attribute });
  })
);

router.delete(
  "/attributes/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const inUse = await Category.countDocuments({ "attributeBindings.attribute": req.params.id });
    if (inUse) {
      throw ApiError.conflict(`This attribute is bound to ${inUse} categor${inUse === 1 ? "y" : "ies"}. Unbind it first.`);
    }
    // Archived rather than removed, so historic product values still resolve.
    await Attribute.findByIdAndUpdate(req.params.id, { status: "archived" });
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------- categories

router.get(
  "/categories/tree",
  canView,
  asyncHandler(async (req, res) => {
    const tree = await categoryService.buildTree({
      status: req.query.status || "all",
      rootId: req.query.root || null,
    });
    res.json({ success: true, tree });
  })
);

// The registry the admin renders its feature switches from — so a new
// capability appears in the UI as soon as it exists in the engine.
router.get(
  "/categories/features",
  canView,
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      features: Object.entries(FEATURES).map(([key, def]) => ({ key, ...def })),
    });
  })
);

router.get(
  "/categories",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.parent) filter.parent = req.query.parent === "root" ? null : req.query.parent;
    if (req.query.level !== undefined) filter.level = Number(req.query.level);
    if (req.query.search) filter.name = new RegExp(escapeRegex(req.query.search), "i");

    const result = await paginate(Category, filter, req.query, { defaultSort: { level: 1, seq: 1 } });
    res.json({ success: true, ...result });
  })
);

// The resolved form schema for a category — the endpoint the admin product
// form and the storefront filter bar are both built from.
router.get(
  "/categories/:id/schema",
  canView,
  asyncHandler(async (req, res) => {
    const schema = await resolveCategorySchema(req.params.id);
    res.json({ success: true, ...schema });
  })
);

router.get(
  "/categories/:id",
  canView,
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id).populate("attributeBindings.attribute");
    if (!category) throw ApiError.notFound("Category not found");
    res.json({ success: true, category });
  })
);

router.post(
  "/categories",
  canManage,
  asyncHandler(async (req, res) => {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json({ success: true, category });
  })
);

router.patch(
  "/categories/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.json({ success: true, category });
  })
);

// Binding an attribute to a category is the whole "new category without a
// rebuild" story, so it gets its own endpoint rather than being buried in a
// PATCH body.
router.post(
  "/categories/:id/attributes",
  canManage,
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) throw ApiError.notFound("Category not found");

    const attribute = await Attribute.findById(req.body.attribute);
    if (!attribute) throw ApiError.badRequest("Attribute not found");

    const existing = category.attributeBindings.find(
      (b) => String(b.attribute) === String(req.body.attribute)
    );
    if (existing) Object.assign(existing, req.body);
    else category.attributeBindings.push(req.body);

    await category.save();
    const schema = await resolveCategorySchema(category._id);
    res.json({ success: true, category, schema });
  })
);

router.delete(
  "/categories/:id/attributes/:attributeId",
  canManage,
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) throw ApiError.notFound("Category not found");

    category.attributeBindings = category.attributeBindings.filter(
      (b) => String(b.attribute) !== String(req.params.attributeId)
    );
    await category.save();
    res.json({ success: true, category });
  })
);

router.delete(
  "/categories/:id",
  canManage,
  asyncHandler(async (req, res) => {
    await categoryService.deleteCategory(req.params.id);
    res.json({ success: true });
  })
);

// ---------------------------------------------------------------- brands

router.get(
  "/brands",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.categories = req.query.category;
    if (req.query.search) filter.name = new RegExp(escapeRegex(req.query.search), "i");
    const result = await paginate(Brand, filter, req.query, { defaultSort: { seq: 1, name: 1 } });
    res.json({ success: true, ...result });
  })
);

router.post(
  "/brands",
  canManage,
  asyncHandler(async (req, res) => {
    const slug = await uniqueSlug(Brand, req.body.slug || req.body.name);
    const brand = await Brand.create({ ...req.body, slug });
    res.status(201).json({ success: true, brand });
  })
);

router.patch(
  "/brands/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!brand) throw ApiError.notFound("Brand not found");
    res.json({ success: true, brand });
  })
);

// ---------------------------------------------------------------- products

router.get(
  "/products",
  canView,
  asyncHandler(async (req, res) => {
    const filter = {};
    // "Delete" on the admin list just archives the product (order history
    // still points at it), so leaving it out of the default view is what
    // makes the delete actually stick across a refresh. Picking "Archived"
    // explicitly in the status filter still finds it.
    if (req.query.status) filter.status = req.query.status;
    else filter.status = { $ne: "archived" };
    if (req.query.brand) filter.brand = req.query.brand;
    if (req.query.category) {
      // Matches the whole subtree, so filtering by "Grocery" includes "Rice".
      filter.categoryPath = req.query.category;
    }
    if (req.query.inStock !== undefined) filter.inStock = req.query.inStock === "true";
    if (req.query.search) filter.name = new RegExp(escapeRegex(req.query.search), "i");

    const result = await paginate(Product, filter, req.query, {
      defaultSort: { createdAt: -1 },
      populate: [
        { path: "category", select: "name slug path" },
        { path: "brand", select: "name slug" },
      ],
    });
    res.json({ success: true, ...result });
  })
);

router.get(
  "/products/:id",
  canView,
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
      .populate("category", "name slug path")
      .populate("brand", "name slug");
    if (!product) throw ApiError.notFound("Product not found");

    const [variants, schema] = await Promise.all([
      Variant.find({ product: product._id, status: { $ne: "archived" } }).sort({ sellingPrice: 1 }),
      resolveCategorySchema(product.category._id || product.category),
    ]);

    res.json({ success: true, product, variants, schema });
  })
);

router.post(
  "/products",
  canManage,
  asyncHandler(async (req, res) => {
    const product = await productService.createProduct(req.body, req.user);
    const variants = await Variant.find({ product: product._id });
    res.status(201).json({ success: true, product, variants });
  })
);

router.patch(
  "/products/:id",
  canManage,
  asyncHandler(async (req, res) => {
    const product = await productService.updateProduct(req.params.id, req.body, req.user);
    const variants = await Variant.find({ product: product._id, status: { $ne: "archived" } });
    res.json({ success: true, product, variants });
  })
);

// The product list's quick switches: on sale or sold out, live or hidden —
// without opening the full form. Only these two fields are accepted here, and
// the permission is the same one the full form's save needs.
router.patch(
  "/products/:id/quick",
  canManage,
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product || product.status === "archived") throw ApiError.notFound("Product not found");

    const before = { soldOut: product.soldOut, status: product.status };

    if (typeof req.body.soldOut === "boolean") product.soldOut = req.body.soldOut;
    if (req.body.status !== undefined) {
      // Active or hidden only — drafting and archiving go through the form.
      if (!["active", "hidden"].includes(req.body.status)) {
        throw ApiError.badRequest("Status can be switched between active and hidden here");
      }
      product.status = req.body.status;
      if (req.body.status === "active" && !product.publishedAt) product.publishedAt = new Date();
    }
    await product.save();

    // inStock follows the switch (and the counts underneath it), and the
    // category counts follow the status.
    await productService.refreshRollup(product._id);
    if (before.status !== product.status) await categoryService.refreshProductCounts();

    await audit.record({
      req, action: "update", entity: "Product", entityId: product._id, label: product.name,
      before, after: { soldOut: product.soldOut, status: product.status },
    });

    const fresh = await Product.findById(product._id).select("status soldOut inStock");
    res.json({ success: true, product: fresh });
  })
);

router.post(
  "/products/:id/publish",
  requirePermission("catalog.publish"),
  asyncHandler(async (req, res) => {
    const publish = req.body.publish !== false;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      publish
        ? { status: "active", publishedAt: new Date() }
        : { status: "hidden" },
      { new: true }
    );
    if (!product) throw ApiError.notFound("Product not found");
    await categoryService.refreshProductCounts();
    res.json({ success: true, product });
  })
);

router.delete(
  "/products/:id",
  canManage,
  asyncHandler(async (req, res) => {
    // Archived, never deleted — order history points at these documents.
    await Product.findByIdAndUpdate(req.params.id, { status: "archived" });
    await Variant.updateMany({ product: req.params.id }, { status: "archived" });
    res.json({ success: true });
  })
);

module.exports = router;
