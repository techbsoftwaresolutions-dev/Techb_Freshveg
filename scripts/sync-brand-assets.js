#!/usr/bin/env node
// Pulls an Expo app's launcher icon and the shared splash artwork, saved in
// Admin → Settings → Branding, into that app's assets/brand/, where its
// app.config.js picks them up. Run it in the app's folder before a build:
//
//   cd customer-app && npm run brand:sync     (customer app icon)
//   cd delivery-app && npm run brand:sync     (delivery app icon)
//
// Each app's package.json passes its name ("customer" or "delivery"), and the
// script checks that against the folder's package.json, so one app can never
// be built with the other's icon.
//
// A launcher icon and splash screen are compiled into the app, so an installed
// app only changes when a build made after this is installed. A cleared
// setting removes the file here, and the app goes back to its bundled
// assets/icon.png and assets/splash.png. The API address comes from
// API_BASE_URL (or the app's .env), as for the app itself; only the public
// settings endpoint is read, so no credentials are involved. No dependencies:
// Node 18+ fetch.

const fs = require("fs");
const path = require("path");

const APPS = {
  customer: { iconKey: "customerAppIcon", packageName: "commerce-customer-app" },
  delivery: { iconKey: "deliveryAppIcon", packageName: "commerce-delivery-app" },
};

function apiBase(appDir) {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  const envFile = path.join(appDir, ".env");
  if (!fs.existsSync(envFile)) return "";
  const line = fs.readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => /^\s*API_BASE_URL\s*=/.test(l));
  return line ? line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") : "";
}

// Cloudinary resizes on the way out; `t` is the transformation.
const transformed = (url, t) => url.replace("/image/upload/", `/image/upload/${t}/`);

// What each saved image becomes, at the sizes Expo asks for. `size` is what
// the downloaded PNG must measure before it may replace the file in use.
function outputsFor(iconKey) {
  return [
    // 1024px square, no transparency (iOS paints it black).
    { file: "icon.png", from: iconKey, t: "c_pad,w_1024,h_1024,b_white,f_png", size: 1024 },
    // Android's adaptive icon: the icon inside the 66% safe zone, as launchers
    // crop the rest to a circle or squircle. Drawn over a white background.
    { file: "adaptive-icon.png", from: iconKey, t: "c_pad,w_680,h_680,b_white/c_pad,w_1024,h_1024,b_transparent,f_png", size: 1024 },
    // The splash artwork whole, centred by Expo on the splash background.
    { file: "splash.png", from: "splash", t: "c_limit,w_1242,h_1242,f_png" },
  ];
}

// A real PNG of the expected size, or an explanation.
function checkPng(buffer, size) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length < 24 || signature.some((byte, i) => buffer[i] !== byte)) return "not a PNG image";
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (size && (width !== size || height !== size)) return `expected ${size}×${size}px, got ${width}×${height}`;
  if (!width || !height) return "unreadable dimensions";
  return null;
}

async function sync({ app, appDir = process.cwd(), log = console.log } = {}) {
  const target = APPS[app];
  if (!target) throw new Error(`Say which app this is: sync-brand-assets.js ${Object.keys(APPS).join(" | ")}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8"));
  if (pkg.name !== target.packageName) {
    throw new Error(`This folder is ${pkg.name}, not the ${app} app (${target.packageName}) — run it in the right app`);
  }

  const base = apiBase(appDir);
  if (!base) throw new Error("Set API_BASE_URL (or add it to this app's .env)");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/settings/public`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(`Couldn't read the settings from ${base} (HTTP ${response.status})`);
  const branding = payload.settings?.branding || {};

  // Everything is downloaded and checked first; files are replaced only once
  // all of them are good, so a failure leaves the last working set in place.
  const outDir = path.join(appDir, "assets", "brand");
  const ready = [];
  for (const output of outputsFor(target.iconKey)) {
    const url = branding[output.from];
    if (!url) {
      ready.push({ output, buffer: null });
      continue;
    }
    if (!url.includes("/image/upload/")) throw new Error(`${output.from} is not a Cloudinary image: ${url}`);
    const image = await fetch(transformed(url, output.t));
    if (!image.ok) throw new Error(`Couldn't download ${output.from} (HTTP ${image.status})`);
    const buffer = Buffer.from(await image.arrayBuffer());
    const problem = checkPng(buffer, output.size);
    if (problem) throw new Error(`${output.file} from ${output.from}: ${problem}`);
    ready.push({ output, buffer });
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const { output, buffer } of ready) {
    const file = path.join(outDir, output.file);
    if (!buffer) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      log(`  ${output.file}: none saved, using the bundled default`);
      continue;
    }
    fs.writeFileSync(`${file}.tmp`, buffer);
    fs.renameSync(`${file}.tmp`, file);
    log(`  ${output.file}: from ${output.from}`);
  }

  const record = {
    app,
    syncedAt: new Date().toISOString(),
    icon: { setting: target.iconKey, url: branding[target.iconKey] || null },
    splash: branding.splash || null,
  };
  fs.writeFileSync(path.join(outDir, "brand.json"), JSON.stringify(record, null, 2) + "\n");
  log(`Done (${app} app). Build and publish a new version of the app for the change to reach phones.`);
  return record;
}

module.exports = { sync, checkPng, APPS };

if (require.main === module) {
  sync({ app: process.argv[2] }).catch((error) => {
    console.error(`brand:sync failed: ${error.message}`);
    process.exit(1);
  });
}
