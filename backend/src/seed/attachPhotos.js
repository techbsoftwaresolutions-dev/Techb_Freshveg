/* eslint-disable no-console */
// Attaches the Hosur Basket photos that are still on Cloudinary to the products and
// categories in the database, matching by name. Only sets photos; touches nothing else.
//   node src/seed/attachPhotos.js
const path = require("path");
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const Product = require("../modules/catalog/product.model");
const Category = require("../modules/catalog/category.model");

const idx = require(path.join(__dirname, "../../contact-sheets/index.json"));
const P = Object.fromEntries(idx.products.map((x) => [x.n, x.url]));
const C = Object.fromEntries(idx.categories.map((x) => [x.n, x.url]));

// product name (lowercase, matched as "contains") -> product photo numbers
const PRODUCTS = {
  tomato: [19], onion: [1], potato: [20], "apple shimla": [77, 78, 2], banana: [21, 80, 81],
  palak: [22, 89, 90], spinach: [22, 89, 90], "india gate": [23], aashirvaad: [24],
  "fortune sunflower": [14, 25, 26], "amul gold": [8, 13, 27], "hair clip": [29, 152],
  "neem face wash": [7, 17, 32], "surf excel": [16, 3],
  papaya: [4, 10, 12], orange: [5, 9, 43], mango: [71, 72], "dragon fruit": [15, 50], carrot: [104, 38],
  broccoli: [110], beetroot: [95, 42], cabbage: [37], capsicum: [41], coriander: [40], radish: [98],
  "green peas": [86], "green beans": [83], zucchini: [107], watermelon: [44], "passion fruit": [74],
  "chilli powder": [131, 134], turmeric: [128], groundnut: [140], sunfoil: [137], "chia": [143], flax: [146],
  "toned milk": [59], taaza: [176], "vanilla": [62], "ponni": [122], "savrdh": [125],
};
// category name (lowercase, exact) -> category photo number
const CATS = {
  "fruits & vegetables": 19, "fresh fruits": 32, "fresh vegetables": 44, "leafy greens": 38,
  "exotic & imported": 33, "grocery & daily needs": 2, rice: 45, "dairy & eggs": 5,
  "fancy & personal care": 9, "staples & grains": 70, "atta & flours": 2, "dals & pulses": 31, "oils & ghee": 49, "spices & masala": 4, "snacks & beverages": 6, "hair accessories": 53, "hair care": 10, cosmetics: 56, "cleaning supplies": 57, detergents: 58, "kitchen essentials": 59, stationery: 61, "pooja items": 62, "skin care": 7, household: 13, "general store": 16,
};

(async () => {
  await connectDb();
  let p = 0, c = 0;
  for (const prod of await Product.find({}).select("name media").lean()) {
    const key = Object.keys(PRODUCTS).find((k) => prod.name.toLowerCase().includes(k));
    if (!key) { console.log("no photo for product:", prod.name); continue; }
    const media = PRODUCTS[key].map((n, i) => ({ url: P[n], alt: prod.name, type: "image", seq: i })).filter((m) => m.url);
    await Product.updateOne({ _id: prod._id }, { $set: { media } });
    p++; console.log("product", prod.name, "->", media.length, "photo(s)");
  }
  for (const cat of await Category.find({}).select("name").lean()) {
    const n = CATS[cat.name.toLowerCase()];
    if (!n || !C[n]) { console.log("no photo for category:", cat.name); continue; }
    await Category.updateOne({ _id: cat._id }, { $set: { image: C[n] } });
    c++; console.log("category", cat.name, "-> photo", n);
  }
  console.log(`\nDone: ${p} products, ${c} categories updated. Refresh the website (cache is ~30s).`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
