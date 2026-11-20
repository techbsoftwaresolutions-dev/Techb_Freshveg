// Read-only: lists every image in your Cloudinary account (folder, name, link)
// and writes cloudinary-assets.csv so photos can be re-attached to products.
// Run: node src/seed/listCloudinary.js
require("dotenv").config();
const fs = require("fs");

const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET;
if (!cloud || !key || !secret) {
  console.error("Cloudinary env vars missing in backend/.env");
  process.exit(1);
}
const auth = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
(async () => {
const rows = [];
let cursor = "";
do {
  const url = `https://api.cloudinary.com/v1_1/${cloud}/resources/image?max_results=500${cursor ? "&next_cursor=" + cursor : ""}`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    console.error("Cloudinary error", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  for (const r of data.resources || []) {
    rows.push({ id: r.public_id, folder: r.asset_folder || r.public_id.split("/").slice(0, -1).join("/"), created: r.created_at, w: r.width, h: r.height, url: r.secure_url });
  }
  cursor = data.next_cursor || "";
} while (cursor);

const byFolder = {};
for (const r of rows) byFolder[r.folder || "(root)"] = (byFolder[r.folder || "(root)"] || 0) + 1;
console.log(`Total images: ${rows.length}`);
console.log(byFolder);
const csv = ["public_id,folder,created,width,height,url", ...rows.map((r) => [r.id, r.folder, r.created, r.w, r.h, r.url].map((v) => `"${v ?? ""}"`).join(","))].join("\n");
fs.writeFileSync("cloudinary-assets.csv", csv);
console.log("Wrote cloudinary-assets.csv");
})();
