// Brand images (Admin → Settings → Branding) — run with `npm test`. Real HTTP
// API on a throwaway in-memory MongoDB; Cloudinary is replaced by a stub that
// answers like its upload API, so no real account or network is needed.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const CLOUD = "brandtest";

// The smallest file each sniffer accepts: the magic bytes plus a header
// carrying width × height.
function png(width, height) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
function jpeg(width, height) {
  // SOI, an APP0 segment to skip, then SOF0 with the size.
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03,
    ...Array(12).fill(0),
  ]);
}
function webp(width, height) {
  const b = Buffer.alloc(32);
  b.write("RIFF", 0, "ascii");
  b.write("WEBP", 8, "ascii");
  b.write("VP8X", 12, "ascii");
  b.writeUIntLE(width - 1, 24, 3);
  b.writeUIntLE(height - 1, 27, 3);
  return b;
}

describe("branding: image checks", () => {
  const branding = require("../src/modules/settings/branding");

  it("reads width and height from PNG, JPEG and WebP headers", () => {
    assert.deepEqual(branding.imageSize(png(1024, 512), "png"), { width: 1024, height: 512 });
    assert.deepEqual(branding.imageSize(jpeg(640, 480), "jpg"), { width: 640, height: 480 });
    assert.deepEqual(branding.imageSize(webp(300, 200), "webp"), { width: 300, height: 200 });
    assert.equal(branding.imageSize(Buffer.from([0xff, 0xd8]), "jpg"), null);
  });

  it("holds each asset to its own size and shape", () => {
    for (const kind of ["customerAppIcon", "deliveryAppIcon"]) {
      assert.doesNotThrow(() => branding.checkUpload(kind, png(1024, 1024), "png"));
      assert.doesNotThrow(() => branding.checkUpload(kind, jpeg(2048, 2048), "jpg"));
      assert.throws(() => branding.checkUpload(kind, png(1100, 1024), "png"), /square/);
      assert.throws(() => branding.checkUpload(kind, png(512, 512), "png"), /at least 1024×1024/);
      assert.throws(() => branding.checkUpload(kind, png(5000, 5000), "png"), /at most 4096×4096/);
    }
    assert.throws(() => branding.checkUpload("appIcon", png(1024, 1024), "png"), /Unknown branding asset/);
    assert.throws(() => branding.checkUpload("splash", jpeg(1024, 1024), "jpg"), /PNG, WEBP/);
    assert.throws(() => branding.checkUpload("favicon", png(400, 100), "png"), /square/);
    assert.doesNotThrow(() => branding.checkUpload("logo", jpeg(600, 200), "jpg"));
    assert.throws(() => branding.checkUpload("logo", png(100, 40), "png"), /at least 200×60/);
    assert.throws(() => branding.checkUpload("banner", png(800, 800), "png"), /Unknown branding asset/);
  });
});

describe("branding: upload, save and serve", () => {
  let api;
  let Settings;
  const realFetch = global.fetch;
  const saved = {};
  let uploads = 0;

  const upload = (buffer, kind, token, type = "image/png") =>
    realFetch(`${api.base}/uploads?folder=branding&kind=${kind}`, {
      method: "POST",
      headers: { "Content-Type": type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: buffer,
    }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  const patch = (body, token) => api.call("PATCH", "/settings/branding", { token, body });
  const publicBranding = async () => (await api.call("GET", "/settings/public")).settings.branding;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    for (const [key, value] of Object.entries({
      CLOUDINARY_CLOUD_NAME: CLOUD,
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    })) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
    // Cloudinary's upload API, stubbed; everything else is the real network.
    global.fetch = async (url, init) => {
      if (String(url).startsWith(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`)) {
        uploads += 1;
        const id = `branding/test${uploads}`;
        return new Response(
          JSON.stringify({ secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/${id}.png`, public_id: id, bytes: 33 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return realFetch(url, init);
    };
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Settings = require("../src/modules/settings/settings.model");
  });

  after(async () => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await api?.stop();
  });

  it("is empty — every client's bundled default — until something is uploaded", async () => {
    assert.deepEqual(await publicBranding(), {
      logo: "", symbol: "", favicon: "", shareImage: "", customerAppIcon: "", deliveryAppIcon: "", splash: "",
    });
  });

  it("only admins who can change settings may upload brand images", async () => {
    for (const kind of ["customerAppIcon", "deliveryAppIcon"]) {
      assert.equal((await upload(png(1024, 1024), kind)).status, 401);
      assert.equal((await upload(png(1024, 1024), kind, api.customerToken)).status, 403);
      // A supervisor can upload product photos, but not brand images.
      assert.equal((await upload(png(1024, 1024), kind, api.supervisorToken)).status, 403);
    }
    assert.equal(uploads, 0, "nothing reached Cloudinary");
  });

  it("turns away wrong-sized or wrong-type images before storing them", async () => {
    const small = await upload(png(512, 512), "customerAppIcon", api.adminToken);
    assert.equal(small.status, 400);
    assert.match(small.error.message, /customer app icon must be at least 1024×1024px \(this one is 512×512\)/);
    assert.equal((await upload(png(1024, 900), "deliveryAppIcon", api.adminToken)).status, 400);
    assert.equal((await upload(Buffer.alloc(6 * 1024 * 1024), "deliveryAppIcon", api.adminToken)).status, 413);
    assert.equal((await upload(Buffer.from("<svg></svg>"), "logo", api.adminToken, "image/png")).status, 400);
    assert.equal((await upload(png(800, 800), "nonsense", api.adminToken)).status, 400);
    assert.equal(uploads, 0, "nothing reached Cloudinary");
  });

  it("saves an uploaded logo and app icon, served to every client", async () => {
    const logo = await upload(png(800, 300), "logo", api.adminToken);
    const icon = await upload(png(1024, 1024), "customerAppIcon", api.adminToken);
    assert.equal(logo.status, 201);
    assert.equal(icon.status, 201);

    const res = await patch({ logo: logo.url, customerAppIcon: icon.url }, api.adminToken);
    assert.equal(res.status, 200);
    const branding = await publicBranding();
    assert.equal(branding.logo, logo.url);
    assert.equal(branding.customerAppIcon, icon.url);
    assert.equal(branding.deliveryAppIcon, "", "the delivery app keeps its default");
    assert.equal((await api.call("GET", "/settings/public")).settings.company.logo, logo.url, "old field still answers");
  });

  it("refuses links that are not this store's uploads, and keeps the old image", async () => {
    const before = await publicBranding();
    for (const bad of ["https://evil.example/logo.png", "javascript:alert(1)", `https://res.cloudinary.com/othercloud/image/upload/x.png`, 42]) {
      const res = await patch({ logo: bad }, api.adminToken);
      assert.equal(res.status, 400, `accepted ${JSON.stringify(bad)}`);
    }
    assert.deepEqual(await publicBranding(), before);
  });

  it("only staff with settings access can save branding", async () => {
    const url = (await publicBranding()).logo;
    assert.equal((await patch({ logo: "" })).status, 401);
    assert.equal((await patch({ logo: "" }, api.customerToken)).status, 403);
    assert.equal((await patch({ logo: "" }, api.supervisorToken)).status, 403);
    assert.equal((await publicBranding()).logo, url);
  });

  it("a null keeps the saved image; an empty string resets it to the default", async () => {
    const before = await publicBranding();
    assert.equal((await patch({ logo: null, favicon: null }, api.adminToken)).status, 200);
    assert.equal((await publicBranding()).logo, before.logo);

    assert.equal((await patch({ logo: "" }, api.adminToken)).status, 200);
    const after = await publicBranding();
    assert.equal(after.logo, "");
    assert.equal(after.customerAppIcon, before.customerAppIcon, "the other assets are untouched");
  });

  it("still serves a logo saved in the original company.logo field", async () => {
    const legacy = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/legacy.png`;
    await Settings.updateOne({ key: "global" }, { $set: { "company.logo": legacy, "branding.logo": "" } });
    assert.equal((await publicBranding()).logo, legacy);

    // An uploaded branding logo takes over from it.
    const fresh = await upload(png(600, 200), "logo", api.adminToken);
    await patch({ logo: fresh.url }, api.adminToken);
    assert.equal((await publicBranding()).logo, fresh.url);
  });

  it("keeps the customer and delivery icons independent", async () => {
    const customer = (await upload(png(1024, 1024), "customerAppIcon", api.adminToken)).url;
    const delivery = (await upload(png(2048, 2048), "deliveryAppIcon", api.adminToken)).url;
    assert.notEqual(customer, delivery);

    // Saving one leaves the other as it was — including when the admin page
    // sends the whole branding draft.
    assert.equal((await patch({ deliveryAppIcon: delivery }, api.adminToken)).status, 200);
    const afterDelivery = await publicBranding();
    assert.equal(afterDelivery.deliveryAppIcon, delivery);
    assert.notEqual(afterDelivery.customerAppIcon, delivery);

    assert.equal((await patch({ ...afterDelivery, customerAppIcon: customer }, api.adminToken)).status, 200);
    let now = await publicBranding();
    assert.equal(now.customerAppIcon, customer);
    assert.equal(now.deliveryAppIcon, delivery, "changing the customer icon kept the delivery icon");

    // Resetting one resets only that one.
    assert.equal((await patch({ deliveryAppIcon: "" }, api.adminToken)).status, 200);
    now = await publicBranding();
    assert.equal(now.deliveryAppIcon, "");
    assert.equal(now.customerAppIcon, customer);
    assert.equal((await patch({ deliveryAppIcon: delivery }, api.adminToken)).status, 200);
    assert.equal((await patch({ customerAppIcon: "" }, api.adminToken)).status, 200);
    now = await publicBranding();
    assert.equal(now.customerAppIcon, "");
    assert.equal(now.deliveryAppIcon, delivery);

    // A bad link for one is refused and changes neither.
    assert.equal((await patch({ customerAppIcon: "https://evil.example/i.png" }, api.adminToken)).status, 400);
    assert.deepEqual(await publicBranding(), now);
  });

  it("moves an old shared app icon to both apps once, on boot", async () => {
    const { migrateLegacyAppIcon } = require("../src/modules/settings/branding");
    const db = require("mongoose").connection.db;
    const legacy = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/old-icon.png`;
    const before = await publicBranding();
    await db.collection("settings").updateOne(
      { key: "global" },
      { $set: { "branding.appIcon": legacy, "branding.customerAppIcon": "", "branding.deliveryAppIcon": "" } }
    );
    assert.equal(await migrateLegacyAppIcon(db), true);
    let now = await publicBranding();
    assert.equal(now.customerAppIcon, legacy);
    assert.equal(now.deliveryAppIcon, legacy);
    assert.equal(now.logo, before.logo, "other branding untouched");
    assert.equal((await db.collection("settings").findOne({ key: "global" })).branding.appIcon, undefined);
    assert.equal(await migrateLegacyAppIcon(db), false, "nothing to do the second time");

    // An icon already set per app is never overwritten by the old one.
    await db.collection("settings").updateOne({ key: "global" }, { $set: { "branding.appIcon": "x", "branding.deliveryAppIcon": "" } });
    await migrateLegacyAppIcon(db);
    now = await publicBranding();
    assert.equal(now.customerAppIcon, legacy);
    assert.equal(now.deliveryAppIcon, "x");
  });

  it("leaves the rest of the settings alone", async () => {
    const before = (await api.call("GET", "/settings/public")).settings;
    await patch({ favicon: "" }, api.adminToken);
    const after = (await api.call("GET", "/settings/public")).settings;
    assert.deepEqual(after.app, before.app);
    assert.deepEqual(after.payment, before.payment);
    assert.equal(after.company.name, before.company.name);
  });
});
