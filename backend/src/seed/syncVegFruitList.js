/* eslint-disable no-console */
// Makes the shop match the vegetable + fruit list:
//   1. every product on the list is switched ACTIVE (live, in stock to sell),
//   2. every other product is switched INACTIVE (hidden + sold-out — exactly what the
//      Active toggle on Admin → Catalog → Products does), nothing is deleted,
//   3. list items that have no product yet are CREATED as drafts with a price,
//      a pack size and opening stock, so you only need to upload the photo and
//      press "Save & publish".
//
//   node src/seed/syncVegFruitList.js           preview only (changes nothing)
//   node src/seed/syncVegFruitList.js --apply   do it
//
// Prices on newly created products are placeholders — check them before publishing.
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const Category = require("../modules/catalog/category.model");
const Product = require("../modules/catalog/product.model");
const Variant = require("../modules/catalog/variant.model");
const Store = require("../modules/stores/store.model");
const productService = require("../modules/catalog/product.service");
const inventoryService = require("../modules/inventory/inventory.service");
const categoryService = require("../modules/catalog/category.service");
const { resolveCategorySchema } = require("../modules/catalog/schema.service");
const { CATALOG, productAttributes, variantFor, OPENING_STOCK } = require("./addDailyProducts");

// [name, category slug, price in rupees, [other spellings that mean the same product]]
const LIST = [
  // ---- Vegetables
  ["Onion", "root-vegetables", 40, ["onions", "fresh onions"]],
  ["Garlic", "root-vegetables", 120, ["fresh garlic"]],
  ["Ginger", "root-vegetables", 90, []],
  ["Potato", "root-vegetables", 35, ["potatoes"]],
  ["Baby Potato", "root-vegetables", 50, []],
  ["Sweet Potato", "root-vegetables", 45, ["seet potato"]],
  ["Spring Onion", "green-leafy", 30, []],
  ["Tapioca", "root-vegetables", 40, []],
  ["Tomato Hybrid", "green-vegetables", 35, []],
  ["Tomato", "green-vegetables", 35, ["tomatoes"]],
  ["Cabbage", "green-vegetables", 35, []],
  ["Coccinia", "green-vegetables", 50, ["ivy gourd", "tindora"]],
  ["Local Tomato", "green-vegetables", 30, []],
  ["Broad Beans", "green-vegetables", 70, []],
  ["Radish", "root-vegetables", 30, ["fresh radish"]],
  ["Lady's Finger", "green-vegetables", 45, ["ladys finger", "lady finger", "okra"]],
  ["Haricot Beans", "green-vegetables", 70, []],
  ["Beetroot", "root-vegetables", 40, ["fresh beetroot"]],
  ["Parwal", "green-vegetables", 80, ["pointed gourd"]],
  ["Cowpea Beans", "green-vegetables", 60, ["cowpca beans", "cowpea"]],
  ["Broccoli", "exotic-vegetables", 90, []],
  ["Green Chilli", "green-vegetables", 55, ["green chille", "green chilly"]],
  ["Green Capsicum", "green-vegetables", 70, []],
  ["Red Capsicum", "exotic-vegetables", 150, []],
  ["Yellow Capsicum", "exotic-vegetables", 150, []],
  ["Green Peas", "green-vegetables", 90, ["fresh green peas"]],
  ["Bajji Chilli", "green-vegetables", 60, ["bajji chili"]],
  ["Amla", "green-vegetables", 65, ["amala"]],
  ["Lemon", "green-vegetables", 80, []],
  ["Carrot", "root-vegetables", 50, []],
  ["Beans", "green-vegetables", 60, ["fresh green beans", "green beans"]],
  ["Fenugreek Leaves", "green-leafy", 25, ["fenugreek (meethi leaves)", "meethi leaves", "methi leaves", "fenugreek"]],
  ["Red Amaranthus", "green-leafy", 25, []],
  ["Green Amaranthus", "green-leafy", 25, ["fresh amaranth leaves", "amaranth leaves"]],
  ["Spinach Leaves", "green-leafy", 20, ["spinach", "fresh spinach"]],
  ["Local Cucumber", "green-vegetables", 35, ["cucumber"]],
  ["English Cucumber", "exotic-vegetables", 60, []],
  ["Bottle Gourd", "green-vegetables", 35, ["bottle guard"]],
  ["Pumpkin", "green-vegetables", 35, []],
  ["Cauliflower", "green-vegetables", 40, []],
  ["Mint Leaves", "green-leafy", 20, ["mint"]],
  ["Coriander Leaves", "green-leafy", 20, ["coriander"]],
  ["Dill Leaves", "green-leafy", 25, ["dill"]],
  ["Bharta Brinjal", "green-vegetables", 50, []],
  ["Drumstick", "green-vegetables", 80, ["drum stick"]],
  ["Drumstick Leaves", "green-leafy", 30, ["drum stick leaves"]],
  ["Raw Banana", "green-vegetables", 35, []],
  ["Sweet Corn", "green-vegetables", 60, []],
  ["Brinjal", "green-vegetables", 45, ["eggplant"]],
  ["Knol Khol", "green-vegetables", 45, ["knol knol", "kohlrabi"]],
  ["Baby Corn", "exotic-vegetables", 100, []],
  // ---- Fruits
  ["Thai Pink Guava", "exotic-fruits", 90, []],
  ["Baby Shimla Apple", "daily-fruits", 180, ["shimla apple"]],
  ["Chilean Green Kiwi", "exotic-fruits", 400, ["kiwi", "kiwi fruit"]],
  ["Mosambi", "daily-fruits", 70, ["sweet lime", "mosambi"]],
  ["Orange", "daily-fruits", 90, []],
  ["Banana", "daily-fruits", 60, []],
  ["Musk Melon", "seasonal-fruits", 55, ["muskmelon"]],
  ["Pomegranate", "daily-fruits", 140, []],
  ["Mandarin Orange", "seasonal-fruits", 120, []],
  ["Sapota", "seasonal-fruits", 55, ["chikoo"]],
  ["Yelakki Banana", "daily-fruits", 80, ["yellaki banana", "yalucky banana", "elakki banana"]],
  ["Papaya", "daily-fruits", 50, []],
  ["Guava", "daily-fruits", 60, ["gvava"]],
  ["Kiran Watermelon", "seasonal-fruits", 35, ["watermelon"]],
  ["Dragon Fruit (White Flesh)", "exotic-fruits", 180, []],
  ["Dragon Fruit (Red Flesh)", "exotic-fruits", 200, ["dragon fruit"]],
  ["Tangerine Orange", "seasonal-fruits", 120, []],
  ["Royal Gala Apple", "daily-fruits", 220, []],
  ["Pink Lady Apple", "exotic-fruits", 260, []],
  ["Hass Avocado", "exotic-fruits", 450, ["hass avocada", "avocado"]],
  ["Grapes", "daily-fruits", 110, ["grape"]],
  ["Pineapple", "daily-fruits", 70, ["pinne apple"]],
];

const norm = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^fresh /, "");

async function main() {
  await connectDb();
  try {
    const apply = process.argv.includes("--apply");
    const products = await Product.find({ status: { $ne: "archived" } }).select("name status soldOut category").lean();

    // name -> list entry
    const byName = new Map();
    for (const entry of LIST) for (const n of [entry[0], ...entry[3]]) byName.set(norm(n), entry);

    const keep = new Map(); // product id -> entry
    for (const p of products) {
      const entry = byName.get(norm(p.name));
      if (entry) keep.set(String(p._id), entry);
    }
    const matchedEntries = new Set(keep.values());
    const toCreate = LIST.filter((entry) => !matchedEntries.has(entry));
    const toActivate = products.filter((p) => keep.has(String(p._id)) && !(p.status === "active" && !p.soldOut));
    const toDeactivate = products.filter(
      (p) => !keep.has(String(p._id)) && p.status !== "draft" && !(p.status === "hidden" && p.soldOut)
    );

    console.log(`List: ${LIST.length} items. ${keep.size} already exist in the shop, ${toCreate.length} to create.\n`);
    console.log(`ACTIVATE (${toActivate.length}):`);
    for (const p of toActivate) console.log(`  ${p.name}  [${p.status}${p.soldOut ? ", sold out" : ""}]  <- ${keep.get(String(p._id))[0]}`);
    console.log(`\nALREADY ACTIVE, matched (${keep.size - toActivate.length}):`);
    for (const p of products.filter((x) => keep.has(String(x._id)) && !toActivate.includes(x))) console.log(`  ${p.name}`);
    console.log(`\nCREATE as draft (${toCreate.length}):`);
    for (const [name, slug, price] of toCreate) console.log(`  ${name}  ->  ${slug}  ₹${price}`);
    console.log(`\nMAKE INACTIVE (${toDeactivate.length}):`);
    for (const p of toDeactivate) console.log(`  ${p.name}  [${p.status}]`);

    if (!apply) {
      console.log("\nPreview only. Re-run with --apply to make these changes.");
      return;
    }

    // 1. activate
    for (const p of toActivate) {
      await Product.updateOne({ _id: p._id }, { $set: { status: "active", soldOut: false, publishedAt: new Date() } });
      await productService.refreshRollup(p._id);
    }
    // 2. inactive
    for (const p of toDeactivate) {
      await Product.updateOne({ _id: p._id }, { $set: { status: "hidden", soldOut: true } });
      await productService.refreshRollup(p._id);
    }
    // 3. create the missing ones
    if (toCreate.length) {
      const store = await Store.findOne({ status: "active" }).sort({ isDefault: -1, createdAt: 1 });
      if (!store) throw new Error("No active store found; refusing to create unstocked products");
      for (const [name, slug, price] of toCreate) {
        const category = await Category.findOne({ slug, status: "active" });
        const base = CATALOG[slug];
        if (!category || !base) {
          console.warn(`Skipped ${name}: category "${slug}" not found.`);
          continue;
        }
        const schema = await resolveCategorySchema(category._id);
        const variant = variantFor(category, schema, { ...base, items: [[name, price]] }, name, 0);
        const description = `Fresh ${name}.`;
        const product = await productService.createProduct({
          name,
          category: category._id,
          unit: base.unit,
          shortDescription: description,
          description,
          media: [],
          attributes: productAttributes(schema, name),
          status: "draft",
          productType: "simple",
          tags: [slug.includes("fruit") ? "fruits" : "vegetables"],
          searchKeywords: norm(name).split(" ").filter(Boolean),
          variants: [variant],
        });
        const v = await Variant.findOne({ product: product._id, status: "active" });
        if (v) {
          await inventoryService.receive(store._id, v._id, OPENING_STOCK, {
            reason: "Opening stock for new catalogue product",
            batchNo: `LIST-${v.sku}`,
            costPrice: variant.costPrice,
          });
        }
        console.log(`created: ${name}`);
      }
    }
    await categoryService.refreshProductCounts();
    console.log(`\nDone. ${toActivate.length} activated, ${toDeactivate.length} made inactive, ${toCreate.length} created as drafts.`);
    if (toCreate.length) console.log("Upload photos for the new drafts, check the price, then Save & publish.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
