/* eslint-disable no-console */
// Read-only: lists every product with its category, photo status and creation
// date, so a damaged catalogue can be repaired knowing what survived.
//
//   node src/seed/showProducts.js

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const Product = require("../modules/catalog/product.model");
const Category = require("../modules/catalog/category.model");

async function main() {
  await connectDb();

  const categories = new Map((await Category.find({}).select("slug name").lean()).map((c) => [String(c._id), c]));
  const products = await Product.find({}).sort({ createdAt: 1 }).lean();

  console.log(`${products.length} products\n`);
  for (const p of products) {
    const cat = categories.get(String(p.category));
    console.log(
      `${new Date(p.createdAt).toISOString().slice(0, 16).replace("T", " ")}  ${String(p.name).padEnd(34)} ` +
        `${(cat ? cat.slug : "(missing category)").padEnd(20)} ${String(p.status).padEnd(8)} ` +
        `photos:${(p.media || []).length}  from ₹${(p.priceFrom || 0) / 100}`
    );
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
