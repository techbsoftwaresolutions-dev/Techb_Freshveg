// The customer app's header style (Admin → Settings → Apps) — run with
// `npm test`. Real HTTP API on a throwaway in-memory MongoDB (see helpers).

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("customer app header style", () => {
  let api;
  let Settings;

  const patchApp = (body, token) => api.call("PATCH", "/settings/app", { token, body });
  const publicSettings = async () => (await api.call("GET", "/settings/public")).settings;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Settings = require("../src/modules/settings/settings.model");
  });

  after(async () => api?.stop());

  it("defaults to the classic banner and is public", async () => {
    assert.equal((await publicSettings()).app.homeHero, "classic");
  });

  it("only staff with settings access can change it", async () => {
    assert.equal((await patchApp({ homeHero: "classic" })).status, 401);
    assert.equal((await patchApp({ homeHero: "classic" }, api.customerToken)).status, 403);
  });

  it("rejects values other than classic and video", async () => {
    for (const homeHero of ["carousel", "", null, 1]) {
      const res = await patchApp({ homeHero }, api.adminToken);
      assert.equal(res.status, 400, `accepted ${JSON.stringify(homeHero)}`);
    }
    assert.equal((await publicSettings()).app.homeHero, "classic");
  });

  it("saves the app's own hero text and button label", async () => {
    const res = await patchApp({ heroText: "  Fresh from 800+ farms\nevery morning  ", heroCtaLabel: "Order now" }, api.adminToken);
    assert.equal(res.status, 200);
    const { app, website } = await publicSettings();
    assert.equal(app.heroText, "Fresh from 800+ farms\nevery morning");
    assert.equal(app.heroCtaLabel, "Order now");
    assert.notEqual(website.videoHero.text, app.heroText, "website hero text untouched");

    assert.equal((await patchApp({ heroText: "x".repeat(301) }, api.adminToken)).status, 422);
    assert.equal((await patchApp({ heroCtaLabel: "x".repeat(31) }, api.adminToken)).status, 422);
    assert.equal((await publicSettings()).app.heroText, "Fresh from 800+ farms\nevery morning");
  });

  it("needs the website's video playlist before video can go live", async () => {
    const res = await patchApp({ homeHero: "video" }, api.adminToken);
    assert.equal(res.status, 400);
    assert.match(res.error.message, /video hero/i);
  });

  it("saves video independently of the website's homepage design", async () => {
    // Set straight in the database: the upload check wants a real Cloudinary account.
    await Settings.updateOne(
      { key: "global" },
      { $set: { "website.videoHero.videos": [{ url: "https://res.cloudinary.com/demo/video/upload/farm.mp4" }] } }
    );

    const res = await patchApp({ homeHero: "video" }, api.adminToken);
    assert.equal(res.status, 200);
    let settings = await publicSettings();
    assert.equal(settings.app.homeHero, "video");
    assert.equal(settings.website.homeTemplate, "classic");
    assert.equal(settings.app.wishlistEnabled, true, "other app settings kept");

    // And changing the website's design leaves the app's alone. (The playlist
    // is emptied in the same save: the test URL is not this store's Cloudinary.)
    const website = await api.call("PATCH", "/settings/website", {
      token: api.adminToken,
      body: { homeTemplate: "fresh", videoHero: { text: "Fresh", ctaLabel: "Shop", videos: [] } },
    });
    assert.equal(website.status, 200);
    settings = await publicSettings();
    assert.equal(settings.website.homeTemplate, "fresh");
    assert.equal(settings.app.homeHero, "video");

    assert.equal((await patchApp({ homeHero: "classic" }, api.adminToken)).status, 200);
    assert.equal((await publicSettings()).app.homeHero, "classic");
  });
});
