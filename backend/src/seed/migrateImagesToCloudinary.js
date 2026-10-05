/* eslint-disable no-console */
// One-off: moves images that were saved to local disk (backend/uploads) into
// Cloudinary, and rewrites every stored URL that points at them.
//
//   npm run migrate:images -- --dry-run   # report only, changes nothing
//   npm run migrate:images                # upload + rewrite
//
// Old URLs look like http://<any host>:5055/uploads/<folder>/<file> — the host
// varies (localhost, whatever LAN IP the machine had at upload time), so they
// are matched on the /uploads/ path, not the host. Every collection and every
// field is scanned, so order-line snapshots, banners, reviews and settings are
// covered without listing them. Safe to re-run: Cloudinary URLs never match.
// The files on disk are left alone; delete backend/uploads once you have
// checked the images.

const fs = require("fs/promises");
const path = require("path");
const { connectDb } = require("../config/db");
const storage = require("../modules/storage/providers");

const dryRun = process.argv.includes("--dry-run");
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const LOCAL_URL = /^https?:\/\/[^/]+\/uploads\/([a-z0-9-]+)\/([^/?#]+)$/i;

// Replaces matching strings anywhere inside a document. Only plain objects and
// arrays are walked — ObjectIds, Dates and Buffers are left as they are.
function rewrite(value, swap) {
  if (typeof value === "string") return swap(value);
  if (Array.isArray(value)) return value.map((v) => rewrite(v, swap));
  if (value && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, swap)]));
  }
  return value;
}

async function main() {
  if (!dryRun && storage.missingConfig().length) {
    throw new Error(`Set ${storage.missingConfig().join(", ")} in .env first`);
  }

  const conn = await connectDb();
  const uploaded = new Map(); // "folder/file" -> Cloudinary URL, or null if the file is missing
  const totals = { documents: 0, references: 0, missing: new Set() };

  async function cloudUrlFor(folder, file) {
    const key = `${folder}/${file}`;
    if (uploaded.has(key)) return uploaded.get(key);

    let url = null;
    try {
      const buffer = await fs.readFile(path.join(UPLOAD_DIR, folder, file));
      const extension = path.extname(file).slice(1).toLowerCase().replace("jpeg", "jpg");
      url = dryRun ? `(cloudinary)/${key}` : (await storage.resolve().save(buffer, extension, folder)).url;
      if (!dryRun) console.log(`  uploaded ${key}`);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      totals.missing.add(key);
    }
    uploaded.set(key, url);
    return url;
  }

  for (const { name } of await conn.db.listCollections().toArray()) {
    const collection = conn.db.collection(name);

    for await (const doc of collection.find({})) {
      // First pass collects the URLs (uploads are async); second pass swaps them.
      const found = [];
      rewrite(doc, (s) => {
        const m = LOCAL_URL.exec(s);
        if (m) found.push(m);
        return s;
      });
      if (!found.length) continue;

      const replacements = new Map();
      for (const m of found) {
        const url = await cloudUrlFor(m[1], m[2]);
        if (url) replacements.set(m[0], url);
      }
      if (!replacements.size) continue;

      const updated = rewrite(doc, (s) => replacements.get(s) ?? s);
      const set = {};
      for (const key of Object.keys(doc)) {
        if (key !== "_id" && JSON.stringify(doc[key]) !== JSON.stringify(updated[key])) set[key] = updated[key];
      }

      totals.documents += 1;
      totals.references += found.filter((m) => replacements.has(m[0])).length;
      if (!dryRun) await collection.updateOne({ _id: doc._id }, { $set: set });
      console.log(`  ${dryRun ? "would update" : "updated"} ${name} ${doc._id} (${Object.keys(set).join(", ")})`);
    }
  }

  const filesMoved = [...uploaded.values()].filter(Boolean).length;
  console.log(`\n${dryRun ? "[dry run] " : ""}files ${dryRun ? "to upload" : "uploaded"}: ${filesMoved}`);
  console.log(`documents ${dryRun ? "to update" : "updated"}: ${totals.documents} (${totals.references} references)`);
  if (totals.missing.size) {
    console.log(`referenced but not on disk (left unchanged, re-upload these in the admin): ${totals.missing.size}`);
    for (const key of totals.missing) console.log(`  ${key}`);
  }

  await conn.close();
}

main().catch((err) => {
  console.error(`[migrate] ${err.message}`);
  process.exit(1);
});
