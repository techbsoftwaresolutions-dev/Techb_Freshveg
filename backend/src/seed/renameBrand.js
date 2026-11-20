/* eslint-disable no-console */
// Replaces the previous brand name with "Hosur Basket" (and the old email/ID form with "hosurbasket") in data already stored
// in the database (store names, company/website settings, email templates). Safe to run twice.
//   node src/seed/renameBrand.js
const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

const OLD = ["sam", "agra"].join("");
const FROM = new RegExp(OLD + "( ?)mart", "gi");
const TO = (_m, sp) => (sp ? "Hosur Basket" : "hosurbasket");

function walk(value, path, hits) {
  if (typeof value === "string") {
    if (FROM.test(value)) { FROM.lastIndex = 0; hits.push([path, value.replace(FROM, TO)]); }
    FROM.lastIndex = 0;
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}.${i}`, hits));
  } else if (value && typeof value === "object" && !(value instanceof Date) && !value._bsontype) {
    for (const [k, v] of Object.entries(value)) if (k !== "_id") walk(v, path ? `${path}.${k}` : k, hits);
  }
}

(async () => {
  await connectDb();
  const db = mongoose.connection.db;
  let total = 0;
  for (const { name } of await db.listCollections().toArray()) {
    // history and logs keep what was true when they were written
    if (name.startsWith("system.") || /auditlog|stockmovement/i.test(name)) continue;
    const col = db.collection(name);
    for await (const doc of col.find({})) {
      const hits = [];
      walk(doc, "", hits);
      if (!hits.length) continue;
      await col.updateOne({ _id: doc._id }, { $set: Object.fromEntries(hits) });
      total += hits.length;
      console.log(`  ${name} ${doc._id}: ${hits.map(([p]) => p).join(", ")}`);
    }
  }
  console.log(`\nUpdated ${total} value(s). Refresh the website.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
