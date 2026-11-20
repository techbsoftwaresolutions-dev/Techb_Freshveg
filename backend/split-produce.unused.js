/* eslint-disable no-console */
// Splits the single "Fruits & Vegetables" department into two top-level
// departments, "Fruits" and "Vegetables", without touching anything else.
// Safe to run twice. Products, offers, banners and brands follow automatically.
//   node src/seed/splitProduce.js
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const Category = require("../modules/catalog/category.model");
const Product = require("../modules/catalog/product.model");
const Variant = require("../modules/catalog/variant.model");
const Banner = require("../modules/marketing/banner.model");
const Offer = require("../modules/pricing/offer.model");
const Brand = require("../modules/catalog/brand.model");
const { rebuildSubtree, syncProductPaths } = require("../modules/catalog/category.service");

async function makeRoot(old, fields) {
  let root = await Category.findOne({ slug: fields.slug });
  if (root) return root;
  const base = old.toObject();
  delete base._id; delete base.createdAt; delete base.updatedAt; delete base.__v;
  root = new Category({ ...base, ...fields, parent: null, ancestors: [], level: 0, path: `/${fields.slug}` });
  await root.save();
  return root;
}

(async () => {
  await connectDb();
  const old = await Category.findOne({ slug: "fruits-vegetables" });
  if (!old) { console.log("Nothing to do: 'Fruits & Vegetables' department not found (already split?)."); }
  else {
    const fruits = await makeRoot(old, { slug: "fruits", name: "Fruits", icon: "🍎", color: "#FEE2E2", description: "Fresh seasonal fruit, sourced daily from the local market.", seq: old.seq });
    const veg = await makeRoot(old, { slug: "vegetables", name: "Vegetables", icon: "🥦", color: "#DCFCE7", description: "Farm-fresh greens and vegetables, picked for everyday meals.", seq: old.seq + 1 });

    // make room: every other top-level department moves down one slot
    await Category.updateMany({ parent: null, _id: { $nin: [old._id, fruits._id, veg._id] }, seq: { $gt: old.seq } }, { $inc: { seq: 1 } });

    const move = { "fresh-fruits": fruits, "exotic-produce": fruits, "fresh-vegetables": veg, "leafy-greens": veg };
    let seq = { [fruits._id]: 0, [veg._id]: 0 };
    for (const [slug, target] of Object.entries(move)) {
      const c = await Category.findOne({ slug });
      if (!c) { console.log("skip (missing):", slug); continue; }
      c.parent = target._id; c.seq = ++seq[target._id];
      await c.recomputeLineage(); await c.save();
      await rebuildSubtree(c._id); await syncProductPaths(c._id);
      console.log("moved", c.name, "->", target.name);
    }
    // any other child still under the old department goes under Vegetables
    for (const c of await Category.find({ parent: old._id })) {
      c.parent = veg._id; await c.recomputeLineage(); await c.save();
      await rebuildSubtree(c._id); await syncProductPaths(c._id);
      console.log("moved (other)", c.name, "-> Vegetables");
    }
    // references to the old department
    await Product.updateMany({ category: old._id }, { category: veg._id, categoryPath: [veg._id] });
    await Variant.updateMany({ category: old._id }, { category: veg._id, categoryPath: [veg._id] });
    await Banner.updateMany({ category: old._id }, { category: veg._id });
    await Brand.updateMany({ categories: old._id }, { $addToSet: { categories: { $each: [fruits._id, veg._id] } } });
    await Brand.updateMany({ categories: old._id }, { $pull: { categories: old._id } });
    await Offer.updateMany({ "conditions.categories": old._id }, { $addToSet: { "conditions.categories": { $each: [fruits._id, veg._id] } } });
    await Offer.updateMany({ "conditions.categories": old._id }, { $pull: { "conditions.categories": old._id } });
    await Category.deleteOne({ _id: old._id });
    console.log("removed old 'Fruits & Vegetables' department");
  }
  // photos for the two new departments
  const idx = require("path").join(__dirname, "../../contact-sheets/index.json");
  try {
    const C = Object.fromEntries(require(idx).categories.map((x) => [x.n, x.url]));
    await Category.updateOne({ slug: "fruits" }, { $set: { image: C[32] } });
    await Category.updateOne({ slug: "vegetables" }, { $set: { image: C[19] } });
  } catch (e) { console.log("photos skipped:", e.message); }
  const roots = await Category.find({ parent: null }).sort({ seq: 1 }).select("name seq");
  console.log("Top-level departments:", roots.map((r) => `${r.seq}. ${r.name}`).join(" | "));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
