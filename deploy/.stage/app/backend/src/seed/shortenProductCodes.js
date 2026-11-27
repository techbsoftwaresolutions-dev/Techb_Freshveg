/* eslint-disable no-console */
// Gives every existing product variant the product code new products get:
// short form of the name, a dash, a running number unique across the
// catalogue (Oreo Cream Biscuits -> OCB-001, Apple -> APP-002 ...). See
// shortCode / nextProductCode in modules/catalog/product.service.js.
//
//   node src/seed/shortenProductCodes.js          # shows old -> new, changes nothing
//   node src/seed/shortenProductCodes.js --apply  # makes the change
//
// Live products are numbered first, archived ones after. Past orders keep the code they were sold
// under. Printed QR codes / labels show the old code until they are reprinted.
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const Product = require("../modules/catalog/product.model");
const Variant = require("../modules/catalog/variant.model");
const { shortCode } = require("../modules/catalog/product.service");
const { Counter } = require("../core/sequence");

const apply = process.argv.includes("--apply");

(async () => {
  await connectDb();
  // Live variants first, so they get the plain codes (POME, not POME2);
  // archived ones take whatever is left.
  const variants = (await Variant.find({}).select("sku barcode product status createdAt").sort({ createdAt: 1, _id: 1 }).lean())
    .sort((x, y) => (x.status === "archived") - (y.status === "archived"));
  const products = new Map(
    (await Product.find({ _id: { $in: variants.map((v) => v.product) } }).select("name").lean()).map((p) => [String(p._id), p.name])
  );

  // One running number across every product: 001, 002 ...
  const width = Math.max(3, String(variants.length).length);
  const plan = variants.map((v, i) => {
    const name = products.get(String(v.product)) || "Item";
    return { id: v._id, name, from: v.sku, to: `${shortCode(name)}-${String(i + 1).padStart(width, "0")}`, status: v.status };
  });

  for (const p of plan) console.log(`${p.from.padEnd(30)} -> ${p.to.padEnd(8)} ${p.name}${p.status === "archived" ? "  (archived)" : ""}`);
  console.log(`\n${plan.length} variant code(s).`);

  if (!apply) {
    console.log("Nothing changed. Run again with --apply to make the change.");
  } else {
    // Two steps so a new code never meets an old one still waiting to change
    // (the sku index is unique): first a temporary code, then the short one.
    await Variant.bulkWrite(plan.map((p) => ({ updateOne: { filter: { _id: p.id }, update: { $set: { sku: `TMP-${p.id}` } } } })));
    await Variant.bulkWrite(plan.map((p) => ({ updateOne: { filter: { _id: p.id }, update: { $set: { sku: p.to } } } })));
    // New products carry on from the last number used here.
    await Counter.updateOne({ _id: "productCode" }, { $set: { seq: plan.length } }, { upsert: true });
    console.log("Done - every product now has its short code. Reprint QR codes / labels you have on the shelves.");
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
