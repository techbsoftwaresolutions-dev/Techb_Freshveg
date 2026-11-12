// Read-only: downloads small thumbnails of the Hosur_Basket Cloudinary images and
// builds numbered contact sheets in backend/contact-sheets/ (plus index.json) so the
// catalogue can be rebuilt by recognising each photo.   node src/seed/makeSheets.js
const fs = require("fs");
const path = require("path");
const sharp = require("../../../website/node_modules/sharp");

const T = 200, COLS = 6, ROWS = 5, PER = COLS * ROWS;
const out = path.join(__dirname, "../../contact-sheets");
fs.mkdirSync(out, { recursive: true });

function parseCsv(text) {
  return text.trim().split("\n").slice(1).map((l) => {
    const c = l.match(/"([^"]*)"/g).map((s) => s.slice(1, -1));
    return { id: c[0], folder: c[1], created: c[2], url: c[5] };
  });
}
const rows = parseCsv(fs.readFileSync(path.join(__dirname, "../../cloudinary-assets.csv"), "utf8")).filter((r) => r.folder.startsWith("Hosur_Basket"));
const groups = {};
for (const r of rows) (groups[r.folder.split("/")[1]] ||= []).push(r);
const index = {};

async function thumb(url) {
  const t = url.replace("/upload/", `/upload/w_${T},h_${T},c_pad,b_white,f_jpg/`).replace(/\.(webp|png|jpeg)$/i, ".jpg");
  const res = await fetch(t);
  if (!res.ok) throw new Error(res.status + " " + t);
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  for (const [name, list] of Object.entries(groups)) {
    list.sort((a, b) => a.created.localeCompare(b.created));
    index[name] = list.map((r, i) => ({ n: i + 1, id: r.id, created: r.created, url: r.url }));
    for (let s = 0; s * PER < list.length; s++) {
      const part = list.slice(s * PER, (s + 1) * PER);
      const comps = [];
      for (let i = 0; i < part.length; i++) {
        const n = s * PER + i + 1;
        let buf;
        try { buf = await thumb(part[i].url); } catch (e) { console.log("skip", n, e.message); continue; }
        const x = (i % COLS) * T, y = Math.floor(i / COLS) * T;
        comps.push({ input: buf, left: x, top: y });
        const svg = `<svg width="64" height="30"><rect width="64" height="30" fill="#000" opacity=".75"/><text x="6" y="22" font-size="20" font-family="Arial" font-weight="bold" fill="#fff">${n}</text></svg>`;
        comps.push({ input: Buffer.from(svg), left: x, top: y });
      }
      const file = path.join(out, `${name}-${String(s + 1).padStart(2, "0")}.jpg`);
      await sharp({ create: { width: COLS * T, height: ROWS * T, channels: 3, background: "#eee" } }).composite(comps).jpeg({ quality: 78 }).toFile(file);
      console.log("wrote", path.basename(file));
    }
  }
  fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(index, null, 1));
  console.log("done. sheets in backend/contact-sheets");
})();
