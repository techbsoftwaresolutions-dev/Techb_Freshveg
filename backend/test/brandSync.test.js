// The build-time icon sync (scripts/sync-brand-assets.js) — run with
// `npm test`. Each app folder is a temp dir with its package.json; the API
// and Cloudinary are stubbed, so nothing touches the real apps or network.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { sync } = require("../../scripts/sync-brand-assets");

const CLOUD = "https://res.cloudinary.com/demo/image/upload";
const ICONS = {
  customerAppIcon: `${CLOUD}/v1/customer-icon.png`,
  deliveryAppIcon: `${CLOUD}/v1/delivery-icon.png`,
  splash: `${CLOUD}/v1/splash.png`,
};

// A PNG header of the given size, tagged with which source it came from.
function png(width, height, tag) {
  const b = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  b.write(tag.padEnd(12).slice(0, 12), 28, "ascii");
  return b;
}

describe("brand:sync — one icon per app", () => {
  const realFetch = global.fetch;
  let branding;
  let broken = false;
  let root;

  function appDir(name) {
    const dir = fs.mkdtempSync(path.join(root, `${name}-`));
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name }));
    fs.writeFileSync(path.join(dir, ".env"), "API_BASE_URL=http://api.test\n");
    return dir;
  }
  const read = (dir, file) => fs.readFileSync(path.join(dir, "assets", "brand", file));
  const tagOf = (buffer) => buffer.toString("ascii", 28, 40).trim();
  const quiet = () => {};

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-sync-"));
    delete process.env.API_BASE_URL;
    global.fetch = async (url) => {
      url = String(url);
      if (url === "http://api.test/api/v1/settings/public") {
        return new Response(JSON.stringify({ success: true, settings: { branding } }), { status: 200 });
      }
      const source = Object.entries(ICONS).find(([, u]) => url.endsWith(path.basename(u)));
      if (!source) return new Response("", { status: 404 });
      const isIcon = source[0] !== "splash";
      const body = broken && isIcon ? Buffer.from("<html>not an image</html>") : png(isIcon ? 1024 : 800, isIcon ? 1024 : 600, source[0]);
      return new Response(body, { status: 200 });
    };
  });

  after(() => {
    global.fetch = realFetch;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("builds the customer app with the customer icon and the delivery app with the delivery icon", async () => {
    branding = { ...ICONS };
    const customer = appDir("commerce-customer-app");
    const delivery = appDir("commerce-delivery-app");

    const c = await sync({ app: "customer", appDir: customer, log: quiet });
    const d = await sync({ app: "delivery", appDir: delivery, log: quiet });

    assert.equal(tagOf(read(customer, "icon.png")), "customerAppI");
    assert.equal(tagOf(read(customer, "adaptive-icon.png")), "customerAppI");
    assert.equal(tagOf(read(delivery, "icon.png")), "deliveryAppI");
    assert.equal(tagOf(read(delivery, "adaptive-icon.png")), "deliveryAppI");
    // The splash is shared.
    assert.equal(tagOf(read(customer, "splash.png")), "splash");
    assert.equal(tagOf(read(delivery, "splash.png")), "splash");

    assert.deepEqual(c.icon, { setting: "customerAppIcon", url: ICONS.customerAppIcon });
    assert.deepEqual(d.icon, { setting: "deliveryAppIcon", url: ICONS.deliveryAppIcon });
    assert.equal(JSON.parse(read(delivery, "brand.json")).app, "delivery");
  });

  it("refuses to run for the wrong app or without one", async () => {
    branding = { ...ICONS };
    const customer = appDir("commerce-customer-app");
    await assert.rejects(sync({ app: "delivery", appDir: customer, log: quiet }), /not the delivery app/);
    await assert.rejects(sync({ appDir: customer, log: quiet }), /Say which app/);
    assert.equal(fs.existsSync(path.join(customer, "assets", "brand")), false, "nothing written");
  });

  it("falls back to the bundled icon for an app with none saved, without touching the other", async () => {
    branding = { ...ICONS, deliveryAppIcon: "" };
    const delivery = appDir("commerce-delivery-app");
    fs.mkdirSync(path.join(delivery, "assets", "brand"), { recursive: true });
    fs.writeFileSync(path.join(delivery, "assets", "brand", "icon.png"), "old");
    await sync({ app: "delivery", appDir: delivery, log: quiet });
    assert.equal(fs.existsSync(path.join(delivery, "assets", "brand", "icon.png")), false, "app.config.js uses assets/icon.png");
    assert.equal(fs.existsSync(path.join(delivery, "assets", "brand", "splash.png")), true);

    const customer = appDir("commerce-customer-app");
    await sync({ app: "customer", appDir: customer, log: quiet });
    assert.equal(tagOf(read(customer, "icon.png")), "customerAppI");
  });

  it("keeps the last good files when a download is not a valid icon", async () => {
    branding = { ...ICONS };
    const customer = appDir("commerce-customer-app");
    await sync({ app: "customer", appDir: customer, log: quiet });
    const good = read(customer, "icon.png");

    broken = true;
    try {
      await assert.rejects(sync({ app: "customer", appDir: customer, log: quiet }), /not a PNG image/);
    } finally {
      broken = false;
    }
    assert.deepEqual(read(customer, "icon.png"), good);
    assert.equal(fs.existsSync(path.join(customer, "assets", "brand", "icon.png.tmp")), false);
  });

  it("each Expo config reads its own folder's assets", () => {
    for (const app of ["customer-app", "delivery-app"]) {
      const config = fs.readFileSync(path.join(__dirname, "..", "..", app, "app.config.js"), "utf8");
      assert.match(config, /path\.join\(__dirname, "assets", "brand", file\)/);
      assert.match(config, /icon: brandAsset\("icon\.png", "\.\/assets\/icon\.png"\)/);
    }
    const scripts = ["customer-app", "delivery-app"].map(
      (app) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", app, "package.json"), "utf8")).scripts["brand:sync"]
    );
    assert.deepEqual(scripts, ["node ../scripts/sync-brand-assets.js customer", "node ../scripts/sync-brand-assets.js delivery"]);
  });
});
