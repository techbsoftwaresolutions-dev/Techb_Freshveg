/* eslint-disable no-console */
// Puts the database back exactly as a backupDb.js snapshot saved it (collections in the
// snapshot are emptied and refilled; collections not in the snapshot are left alone).
//   node src/seed/restoreBackup.js backups/<timestamp>
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { EJSON } = require("bson");
const { connectDb } = require("../config/db");

(async () => {
  const dir = path.resolve(process.argv[2] || "");
  if (!process.argv[2] || !fs.existsSync(dir)) { console.error("Usage: node src/seed/restoreBackup.js backups/<timestamp>"); process.exit(1); }
  await connectDb();
  const db = mongoose.connection.db;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const name = file.replace(/\.json$/, "");
    const docs = EJSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs);
    console.log(`  ${name}: ${docs.length}`);
  }
  console.log("\nRestored from", dir);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
