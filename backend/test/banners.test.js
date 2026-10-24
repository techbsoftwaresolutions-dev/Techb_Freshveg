// Banner 1 / Banner 2 framing — zoom, fade reach, fade opacity and height
// (Admin → Banners) — run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("banner framing", () => {
  let api;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
  });

  after(async () => api?.stop());

  it("saves it and hands it to the storefront", async () => {
    const body = {
      title: "Fresh picks", image: "https://example.com/a.jpg", placement: "home_strip", status: "active",
      imageScale: 250, fade: 60, fadeOpacity: 40, height: 360,
    };
    const created = await api.call("POST", "/banners", { token: api.adminToken, body });
    assert.equal(created.status, 201);

    const live = (await api.call("GET", "/banners/live?placement=home_strip")).banners.find((b) => b.id === created.banner.id);
    assert.deepEqual(
      { imageScale: live.imageScale, fade: live.fade, fadeOpacity: live.fadeOpacity, height: live.height },
      { imageScale: 250, fade: 60, fadeOpacity: 40, height: 360 }
    );

    for (const bad of [{ imageScale: 50 }, { imageScale: 400 }, { fade: -5 }, { fadeOpacity: 101 }, { height: 50 }]) {
      const res = await api.call("PATCH", `/banners/${created.banner.id}`, { token: api.adminToken, body: bad });
      assert.ok(res.status >= 400 && res.status < 500, `accepted ${JSON.stringify(bad)} (${res.status})`);
    }
  });

  it("keeps the background and fade colours, hex only", async () => {
    const body = { title: "Colours", image: "https://example.com/c.jpg", placement: "home_story", status: "active", backgroundColor: "#123abc", fadeColor: "#FFEEDD" };
    const created = await api.call("POST", "/banners", { token: api.adminToken, body });
    assert.equal(created.status, 201);
    const live = (await api.call("GET", "/banners/live?placement=home_story")).banners.find((b) => b.id === created.banner.id);
    assert.equal(live.backgroundColor, "#123abc");
    assert.equal(live.fadeColor, "#FFEEDD");

    // These end up inside the page's styles, so only a plain hex colour gets in.
    for (const bad of ["red", "#abc", "#12345g", "#fff; background:url(x)"]) {
      for (const field of ["backgroundColor", "fadeColor"]) {
        const res = await api.call("PATCH", `/banners/${created.banner.id}`, { token: api.adminToken, body: { [field]: bad } });
        assert.ok(res.status >= 400 && res.status < 500, `accepted ${field}=${bad} (${res.status})`);
      }
    }
    const reset = await api.call("PATCH", `/banners/${created.banner.id}`, { token: api.adminToken, body: { fadeColor: "" } });
    assert.equal(reset.banner.fadeColor, "", "empty goes back to the site's colour");
  });

  it("defaults to the whole photo, the site's wash and the site's height", async () => {
    const res = await api.call("POST", "/banners", { token: api.adminToken, body: { title: "Defaults", placement: "home_story" } });
    assert.equal(res.banner.imageScale, 100);
    assert.equal(res.banner.fade, 45);
    assert.equal(res.banner.fadeOpacity, 100);
    assert.equal(res.banner.height, null);
  });
});
