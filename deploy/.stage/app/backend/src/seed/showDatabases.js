/* eslint-disable no-console */
// Read-only: lists every database on the cluster with its size, and what is in
// the one the API uses (collections, document counts, newest order), to find
// where the real data lives.
//
//   node src/seed/showDatabases.js                 # the API's own database
//   node src/seed/showDatabases.js farmers-basket  # look inside another one

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

async function main() {
  await connectDb();
  const current = mongoose.connection.name;

  try {
    const { databases } = await mongoose.connection.db.admin().listDatabases();
    console.log("\nDatabases on this cluster:");
    for (const d of databases) {
      console.log(`  ${d.name.padEnd(28)} ${(d.sizeOnDisk / 1024 / 1024).toFixed(2)} MB${d.name === current ? "   <- the API uses this one" : ""}`);
    }
  } catch (err) {
    console.log(`\n(Could not list databases: ${err.message})`);
  }

  for (const dbName of [process.argv[2] || current]) {
    const db = mongoose.connection.client.db(dbName);
    console.log(`\nCollections in "${dbName}":`);
    const cols = await db.listCollections().toArray();
    for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  ${c.name.padEnd(28)} ${await db.collection(c.name).estimatedDocumentCount()}`);
    }
    const orders = await db.collection("orders").find({}, { projection: { code: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(3).toArray();
    console.log("\nNewest orders:", orders.map((o) => `${o.code} (${new Date(o.createdAt).toISOString()})`).join(", ") || "none");

    const names = async (col, limit = 40) =>
      (await db.collection(col).find({}, { projection: { name: 1, title: 1 } }).limit(limit).toArray())
        .map((d) => d.name || d.title).filter(Boolean);
    console.log("\nCategories:", (await names("categories", 60)).join(", ") || "none");
    console.log("\nProducts:", (await names("products", 60)).join(", ") || "none");

    // What the audit trail recorded about catalogue changes: it can rebuild
    // products and categories if nothing else can.
    const audit = await db.collection("auditlogs").aggregate([
      { $group: { _id: { entity: "$entity", action: "$action" }, n: { $sum: 1 }, first: { $min: "$createdAt" }, last: { $max: "$createdAt" } } },
      { $sort: { "_id.entity": 1 } },
    ]).toArray();
    console.log("\nAudit log (entity / action: count, first - last):");
    for (const row of audit) {
      console.log(`  ${String(row._id.entity).padEnd(18)} ${String(row._id.action).padEnd(10)} ${String(row.n).padStart(4)}   ${new Date(row.first).toISOString().slice(0, 16)} - ${new Date(row.last).toISOString().slice(0, 16)}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
