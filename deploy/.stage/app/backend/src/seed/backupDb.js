/* eslint-disable no-console */
// Saves every collection of the database to backups/<timestamp>/*.json — a snapshot you can
// put back with:  node src/seed/restoreBackup.js backups/<timestamp>
//   node src/seed/backupDb.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { EJSON } = require("bson");
const { connectDb } = require("../config/db");

(async () => {
  await connectDb();
  const db = mongoose.connection.db;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(__dirname, "../../backups", stamp);
  fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const { name } of await db.listCollections().toArray()) {
    if (name.startsWith("system.")) continue;
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs, { relaxed: false }));
    console.log(`  ${name}: ${docs.length}`);
    total += docs.length;
  }
  console.log(`\nBackup saved: backups/${stamp}  (${total} documents)`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
