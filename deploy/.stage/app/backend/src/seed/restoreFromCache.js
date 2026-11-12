/* eslint-disable no-console */
// Rebuilds the Hosur Basket catalogue from the storefront responses the website cached
// (website/.next*/cache/fetch-cache) before the database was reset. Original ids are kept,
// so reviews, wishlists and payments that point at products attach to them again.
//
//   node src/seed/restoreFromCache.js            -> dry run, prints what it found, touches nothing
//   node src/seed/restoreFromCache.js --apply    -> replaces the sample catalogue with the recovered one
// Run `node src/seed/backupDb.js` first so this can be undone.
const fs = require("fs");
const path = require("path");
const seedData = require("./data");

const APPLY = process.argv.includes("--apply");
const WIPE = Date.parse("2026-11-03T11:20:00Z"); // when the sample data was seeded — anything newer is not real
const CACHE_DIRS = [".next/cache/fetch-cache", ".next-dev/cache/fetch-cache"].map((d) => path.join(__dirname, "../../../website", d));

function loadCache() {
  const byUrl = new Map();
  for (const dir of CACHE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      try {
        const p = path.join(dir, file);
        const t = fs.statSync(p).mtimeMs;
        if (t >= WIPE) continue;
        const data = JSON.parse(fs.readFileSync(p, "utf8")).data || {};
        if (!data.body || !data.url) continue;
        const text = Buffer.from(data.body, "base64").toString("utf8").trim();
        if (!/^[[{]/.test(text)) continue;
        const prev = byUrl.get(data.url);
        if (!prev || t > prev.t) byUrl.set(data.url, { t, body: JSON.parse(text) });
      } catch (e) { /* unreadable cache entry */ }
    }
  }
  return byUrl;
}
const find = (cache, suffix) => [...cache].filter(([u]) => u.endsWith(suffix)).sort((a, b) => b[1].t - a[1].t)[0]?.[1].body;

// which seed department supplies features / defaults / attribute bindings for a recovered root
const ROOT_SEED = { "fruits-vegetables": "fruits", "fresh-vegetables": "vegetables", grocery: "grocery", "fancy-personal-care": "fancy-personal-care", household: "household", "general-store": "general-store", "milk-and-ice-cream": "grocery" };

function buildPlan() {
  const cache = loadCache();
  const tree = find(cache, "/storefront/categories?depth=3")?.categories;
  const snapshot = find(cache, "/storefront/products?limit=100&page=1");
  if (!tree || !snapshot) throw new Error("Cache is missing the category tree or product list — cannot restore.");

  // categories, parent first
  const cats = [];
  (function walk(nodes, parent, ancestors, level, base) {
    nodes.forEach((n, i) => {
      const lineage = [...ancestors];
      const doc = {
        _id: n.id, name: n.name, slug: n.slug, parent: parent ? parent._id : null, ancestors: lineage, level,
        path: `${parent ? parent.path : ""}/${n.slug}`, icon: n.icon || "", image: n.image || "", color: n.color || "",
        description: n.description || "", seq: i + 1, status: "active", showInNav: true, isFeatured: level === 0,
      };
      cats.push(doc);
      walk(n.children || [], doc, [...lineage, doc._id], level + 1);
    });
  })(tree, null, [], 0);
  const catIds = new Set(cats.map((c) => c._id));

  const products = [], variants = [], brands = new Map(), orphanCats = new Set();
  for (const item of snapshot.items) {
    const detail = find(cache, `/storefront/products/${item.slug}`);
    const d = detail?.product || item;
    const categoryId = typeof d.category === "object" ? d.category.id : d.category;
    if (!catIds.has(categoryId)) orphanCats.add(`${item.name} -> ${categoryId}`);
    if (d.brand?.id) brands.set(d.brand.id, { _id: d.brand.id, name: d.brand.name, slug: d.brand.slug, logo: d.brand.logo || "", status: "active" });
    const prod = {
      _id: d.id || item.id, name: d.name, slug: d.slug, shortDescription: d.shortDescription || "", description: d.description || d.shortDescription || "",
      category: categoryId, categoryPath: d.categoryPath || [], brand: d.brand?.id || null,
      productType: d.productType || (item.variantCount > 1 ? "variable" : "simple"), unit: d.unit || "pcs", taxRatePct: d.taxRatePct ?? 0,
      hsnCode: d.hsnCode || "", returnWindowDays: d.returnWindowDays ?? null, shelfLifeDays: d.shelfLifeDays ?? null,
      media: (d.media || []).map((m) => ({ url: m.url, alt: m.alt || d.name, type: m.type || "image", seq: m.seq || 0, focalX: m.focalX ?? 50, focalY: m.focalY ?? 50 })),
      attributes: d.attributes || {}, variantAxes: d.variantAxes || [], ingredients: d.ingredients || "", tags: d.tags || [], searchKeywords: d.searchKeywords || [],
      status: d.status || "active", publishedAt: new Date(d.createdAt || Date.now()), isFeatured: Boolean(d.isFeatured), sortOrder: d.sortOrder,
      offer: d.offer && d.offer.kind ? d.offer : undefined, specifications: d.specifications || [],
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined, _full: Boolean(detail),
    };
    products.push(prod);
    if (detail?.variants?.length) {
      for (const v of detail.variants) {
        variants.push({
          _id: v.id, product: prod._id, category: categoryId, categoryPath: v.categoryPath || prod.categoryPath, sku: v.sku, barcode: v.barcode || "", name: v.name || "",
          axisValues: v.axisValues || [], packSize: v.packSize || { value: 1, unit: d.unit || "pcs" }, mrp: v.mrp, sellingPrice: v.sellingPrice,
          costPrice: Math.round(v.sellingPrice * 0.8), taxRatePct: v.taxRatePct ?? 0, taxInclusive: v.taxInclusive !== false, media: v.media || [],
          weightGrams: v.weightGrams || 0, minOrderQty: v.minOrderQty || 1, maxOrderQty: v.maxOrderQty || 50, stepQty: v.stepQty || 1,
          lowStockThreshold: v.lowStockThreshold ?? 5, status: v.status || "active", isDefault: Boolean(v.isDefault), _stock: v.availability?.onHand ?? v.totalStock ?? 0,
          createdAt: v.createdAt ? new Date(v.createdAt) : undefined,
        });
      }
    } else {
      variants.push({
        _id: item.defaultVariant, product: prod._id, category: categoryId, categoryPath: prod.categoryPath, sku: `${item.slug.toUpperCase().replace(/[^A-Z0-9]/g, "")}-1`,
        name: item.packLabel || "", axisValues: [], packSize: { value: 1, unit: d.unit || "pcs" }, mrp: item.mrpFrom || item.priceFrom, sellingPrice: item.priceFrom,
        costPrice: Math.round(item.priceFrom * 0.8), taxRatePct: prod.taxRatePct, isDefault: true, status: "active", _stock: item.inStock ? 25 : 0,
      });
    }
  }

  const heroes = find(cache, "/banners/live?placement=home_hero")?.banners || [];
  const strips = find(cache, "/banners/live?placement=home_strip")?.banners || [];
  const offers = find(cache, "/storefront/home")?.offers || [];
  return { cats, products, variants, brands: [...brands.values()], heroes, strips, offers, orphanCats: [...orphanCats] };
}

async function apply(plan) {
  const mongoose = require("mongoose");
  const { connectDb } = require("../config/db");
  const Attribute = require("../modules/catalog/attribute.model");
  const Category = require("../modules/catalog/category.model");
  const Brand = require("../modules/catalog/brand.model");
  const Product = require("../modules/catalog/product.model");
  const Variant = require("../modules/catalog/variant.model");
  const Store = require("../modules/stores/store.model");
  const Banner = require("../modules/marketing/banner.model");
  const Offer = require("../modules/pricing/offer.model");
  const Inventory = require("../modules/inventory/inventory.model");
  const StockMovement = require("../modules/inventory/stockMovement.model");
  const inventoryService = require("../modules/inventory/inventory.service");
  const productService = require("../modules/catalog/product.service");
  const categoryService = require("../modules/catalog/category.service");

  await connectDb();
  const store = await Store.findOne({}).sort({ createdAt: 1 });
  if (!store) throw new Error("No store found — run the app once / seed stores first.");
  const attrs = new Map((await Attribute.find({})).map((a) => [a.code, a._id]));

  console.log("Removing the sample catalogue …");
  await Promise.all([Inventory.deleteMany({}), StockMovement.deleteMany({}), Variant.deleteMany({}), Product.deleteMany({}), Brand.deleteMany({}), Category.deleteMany({})]);
  await Banner.deleteMany({ placement: { $in: ["home_hero", "home_strip"] } });

  const seedBySlug = new Map(seedData.categories.map((c) => [c.slug, c]));
  for (const c of plan.cats) {
    const seed = c.level === 0 ? seedBySlug.get(ROOT_SEED[c.slug]) : null;
    const extra = seed ? {
      features: seed.features || {}, defaults: seed.defaults || {},
      attributeBindings: (seed.bind || []).filter((b) => attrs.get(b.code)).map((b, i) => ({ attribute: attrs.get(b.code), required: b.required ?? false, isVariantAxis: b.isVariantAxis ?? null, filterable: b.filterable ?? null, label: "", defaultValue: b.defaultValue, seq: b.seq ?? i })),
    } : {};
    await Category.create({ ...c, ...extra });
  }
  console.log(`  ${plan.cats.length} categories`);

  const brandCats = new Map();
  for (const p of plan.products) if (p.brand) (brandCats.get(p.brand) || brandCats.set(p.brand, new Set()).get(p.brand)).add(p.category);
  for (const b of plan.brands) await Brand.create({ ...b, categories: [...(brandCats.get(b._id) || [])] });
  console.log(`  ${plan.brands.length} brands`);

  for (const { _full, ...p } of plan.products) await Product.create(p);
  for (const { _stock, ...v } of plan.variants) await Variant.create(v);
  for (const p of plan.products) await productService.refreshRollup(p._id);
  console.log(`  ${plan.products.length} products, ${plan.variants.length} variants`);

  let stocked = 0;
  for (const v of plan.variants) {
    if (v._stock > 0) { await inventoryService.receive(store._id, v._id, v._stock, { reason: "Restored from website cache" }); stocked += 1; }
  }
  console.log(`  stock restored for ${stocked} variants at ${store.name}`);

  const placements = [["home_hero", plan.heroes], ["home_strip", plan.strips]];
  for (const [placement, list] of placements) {
    for (const [i, b] of list.entries()) {
      await Banner.create({ _id: b.id, title: b.title, subtitle: b.subtitle || "", image: b.image || "", mobileImage: b.mobileImage || "", focalX: b.focalX ?? 50, focalY: b.focalY ?? 50, backgroundColor: b.backgroundColor || "", placement, target: b.target || { kind: "none", value: "" }, seq: i + 1, status: "active" });
    }
  }
  console.log(`  ${plan.heroes.length} hero + ${plan.strips.length} strip banners`);

  for (const o of plan.offers) if (o.image) await Offer.updateOne({ title: o.title }, { $set: { image: o.image } });
  try { await categoryService.refreshProductCounts(); } catch (e) { console.log("  (product counts will refresh on next edit)"); }
  await mongoose.disconnect();
  console.log("\nDone. Restart the backend and refresh the website.");
}

(async () => {
  const plan = buildPlan();
  console.log(`Found in cache: ${plan.cats.length} categories, ${plan.products.length} products (${plan.products.filter((p) => p._full).length} with full detail), ${plan.variants.length} variants, ${plan.brands.length} brands, ${plan.heroes.length} hero banners`);
  for (const root of plan.cats.filter((c) => c.level === 0)) {
    console.log(`\n${root.name}  [${root.slug}]`);
    for (const c of plan.cats.filter((x) => x.parent === root._id)) console.log(`   - ${c.name}  [${c.slug}]`);
  }
  console.log("\nProducts:");
  for (const p of plan.products) {
    const vs = plan.variants.filter((v) => v.product === p._id);
    console.log(` ${p._full ? " " : "~"} ${p.name} — ${vs.map((v) => `${v.name || "pack"} ₹${v.sellingPrice / 100} (stock ${v._stock})`).join(", ")}`);
  }
  if (plan.orphanCats.length) console.log("\nProducts whose category is not in the tree:", plan.orphanCats);
  console.log("\n('~' = only the list entry was cached, so description and sizes are approximate)");
  if (!APPLY) { console.log("\nDry run only. Back up, then run again with --apply."); return; }
  await apply(plan);
})().catch((e) => { console.error(e); process.exit(1); });
