/* eslint-disable no-console */
// Read-only: prints the category tree with each category's slug, status, photo
// and product count, so a damaged tree can be repaired knowing what is there.
//
//   node src/seed/showCategories.js

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const Category = require("../modules/catalog/category.model");
const Product = require("../modules/catalog/product.model");

async function main() {
  await connectDb();

  const categories = await Category.find({}).lean();
  const counts = new Map();
  const rows = await Product.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }]);
  for (const row of rows) counts.set(String(row._id), row.n);

  const children = new Map();
  for (const c of categories) {
    const key = c.parent ? String(c.parent) : "root";
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(c);
  }
  for (const list of children.values()) list.sort((a, b) => (a.seq || 0) - (b.seq || 0) || a.name.localeCompare(b.name));

  const walk = (key, depth) => {
    for (const c of children.get(key) || []) {
      console.log(
        `${"  ".repeat(depth)}- ${c.name}  [${c.slug}]  ${c.status}  photo:${c.image ? "yes" : "NO"}  nav:${c.showInNav ? "y" : "n"}  ` +
          `products:${counts.get(String(c._id)) || 0}  created:${new Date(c.createdAt).toISOString().slice(0, 10)}`
      );
      walk(String(c._id), depth + 1);
    }
  };

  console.log(`${categories.length} categories, ${await Product.countDocuments({})} products\n`);
  walk("root", 0);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
