// Admin → Landing Page → Sections, and what /storefront/home serves from it
// to the website and the app — run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("landing page sections", () => {
  let api;
  let Product;
  let tomato;
  let picks; // three active products for a curated section

  const asAdmin = (method, path, body) => api.call(method, path, { token: api.adminToken, body });
  const list = async () => (await asAdmin("GET", "/marketing/landing-sections")).items;
  const byName = async (name) => (await list()).find((s) => s.name === name);
  const home = (platform) => api.call("GET", `/storefront/home?platform=${platform}`);
  const shown = async (platform) => (await home(platform)).landing.map((s) => s.name);
  const edit = (section, body) => asAdmin("PATCH", `/marketing/landing-sections/${section.id}`, body);

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Product = require("../src/modules/catalog/product.model");
    tomato = await Product.findOne({ slug: "tomato" });
    picks = (await Product.find({ status: "active" }).sort({ name: 1 }).limit(3)).map((p) => p.id);
  });

  after(async () => api?.stop());

  it("starts from the landing page as it was: Best Seller from the featured products, then the departments", async () => {
    const items = await list();
    assert.deepEqual(items.slice(0, 3).map((s) => s.name), ["Best Seller", "Trending", "On Discount"]);
    assert.ok(items.slice(3).every((s) => s.type === "category"));
    assert.deepEqual(items.map((s) => s.seq), items.map((_, i) => i + 1));

    const featured = await Product.countDocuments({ status: "active", isFeatured: true });
    assert.ok(featured > 0);
    assert.ok((await Product.countDocuments({ sections: "best_seller" })) > 0);
    // Reading again doesn't seed twice.
    assert.equal((await list()).length, items.length);
    // Empty sections aren't sent; Best Seller is.
    const web = await shown("web");
    assert.ok(web.includes("Best Seller"));
    assert.ok(!web.includes("Trending"));
  });

  it("creates category, classification and curated sections, and rejects incomplete ones", async () => {
    const leafCategory = String(tomato.category);
    const cat = await asAdmin("POST", "/marketing/landing-sections", {
      name: "  Tomato Shelf ", type: "category", source: { category: leafCategory }, position: 1,
    });
    assert.equal(cat.status, 201, JSON.stringify(cat.error));
    assert.equal(cat.section.name, "Tomato Shelf");
    assert.equal(cat.section.seq, 1);
    assert.equal(cat.section.showOnWebsite, true);
    assert.equal(cat.section.showOnApp, true);

    const cls = await asAdmin("POST", "/marketing/landing-sections", {
      name: "Hot Right Now", type: "classification", source: { classification: "best_seller" },
    });
    assert.equal(cls.status, 201, JSON.stringify(cls.error));

    const cur = await asAdmin("POST", "/marketing/landing-sections", {
      name: "Staff Picks", type: "curated", source: { products: [picks[2], picks[0]] }, description: "Our favourites",
    });
    assert.equal(cur.status, 201, JSON.stringify(cur.error));

    for (const bad of [
      { name: "", type: "category", source: { category: leafCategory } },
      { name: "No Source", type: "category" },
      { name: "Bad Class", type: "classification", source: { classification: "clearance" } },
      { name: "Empty Picks", type: "curated", source: { products: [] } },
      { name: "Ghost Pick", type: "curated", source: { products: ["0123456789abcdef01234567"] } },
    ]) {
      const res = await asAdmin("POST", "/marketing/landing-sections", bad);
      assert.equal(res.status, 422, `${bad.name}: ${res.status}`);
    }
    const dup = await asAdmin("POST", "/marketing/landing-sections", {
      name: "staff picks", type: "curated", source: { products: [picks[1]] },
    });
    assert.equal(dup.status, 409);

    // Each shows its own products, in its own order.
    const app = (await home("app")).landing;
    const tomatoShelf = app.find((s) => s.name === "Tomato Shelf");
    assert.equal(app[0].name, "Tomato Shelf");
    assert.ok(tomatoShelf.products.some((p) => p.slug === "tomato"));
    assert.ok(tomatoShelf.products.every((p) => p.categoryPath.map(String).includes(leafCategory)));
    assert.deepEqual(app.find((s) => s.name === "Staff Picks").products.map((p) => p.id), [picks[2], picks[0]]);
    const bestIds = (await Product.find({ sections: "best_seller" })).map((p) => p.id).sort();
    assert.deepEqual(app.find((s) => s.name === "Hot Right Now").products.map((p) => p.id).sort(), bestIds);
  });

  it("keeps the website and the app switches independent", async () => {
    const best = await byName("Best Seller");
    assert.equal((await edit(best, { showOnWebsite: false })).status, 200);
    assert.ok(!(await shown("web")).includes("Best Seller"));
    assert.ok((await shown("app")).includes("Best Seller"));
    assert.equal((await byName("Best Seller")).showOnApp, true);

    await edit(best, { showOnWebsite: true });
    await edit(best, { showOnApp: false });
    assert.ok((await shown("web")).includes("Best Seller"));
    assert.ok(!(await shown("app")).includes("Best Seller"));

    // Hiding a section leaves the classification itself alone.
    assert.ok((await Product.countDocuments({ sections: "best_seller" })) > 0);
    await edit(best, { showOnApp: true });
  });

  it("an inactive section shows nowhere and comes back as it was", async () => {
    const picksSection = await byName("Staff Picks");
    await edit(picksSection, { status: "inactive" });
    assert.ok(!(await shown("web")).includes("Staff Picks"));
    assert.ok(!(await shown("app")).includes("Staff Picks"));

    await edit(picksSection, { status: "active" });
    const back = await byName("Staff Picks");
    assert.equal(back.seq, picksSection.seq);
    assert.deepEqual(back.source.products.map((p) => p.id), [picks[2], picks[0]]);
    assert.equal(back.description, "Our favourites");
  });

  it("moves sections without touching the products inside them", async () => {
    const best = await byName("Best Seller");
    const shelf = await byName("Tomato Shelf");
    const before = (await home("web")).landing.find((s) => s.name === "Best Seller").products.map((p) => p.id);
    const positionsBefore = (await Product.find({ sections: "best_seller" }).lean()).map((p) => p.positions);

    // Best Seller above the Tomato Shelf, which was first.
    const moved = await asAdmin("PATCH", `/marketing/landing-sections/${best.id}/position`, { position: shelf.seq });
    assert.equal(moved.position, 1);
    for (const platform of ["web", "app"]) {
      const names = await shown(platform);
      assert.ok(names.indexOf("Best Seller") < names.indexOf("Tomato Shelf"), platform);
    }
    const items = await list();
    assert.deepEqual(items.map((s) => s.seq), items.map((_, i) => i + 1));

    const after = (await home("web")).landing.find((s) => s.name === "Best Seller").products.map((p) => p.id);
    assert.deepEqual(after, before);
    assert.deepEqual((await Product.find({ sections: "best_seller" }).lean()).map((p) => p.positions), positionsBefore);
  });

  it("asks before an edit repoints a section, and keeps the curated picks when it does", async () => {
    const picksSection = await byName("Staff Picks");
    const unconfirmed = await edit(picksSection, { type: "classification", source: { classification: "trending" } });
    assert.equal(unconfirmed.status, 409);
    assert.equal(unconfirmed.error.details.needsConfirm, true);
    assert.equal((await byName("Staff Picks")).type, "curated");

    // A rename alone needs no confirmation.
    assert.equal((await edit(picksSection, { name: "Staff Favourites" })).status, 200);

    const confirmed = await edit(picksSection, { type: "classification", source: { classification: "trending" }, confirmSourceChange: true });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.error));
    // The picks are kept, so switching back restores them.
    const back = await edit(picksSection, { type: "curated", confirmSourceChange: true });
    assert.equal(back.status, 200, JSON.stringify(back.error));
    assert.deepEqual(back.section.source.products.map((p) => p.id), [picks[2], picks[0]]);
  });

  it("deletes custom sections only, and never a product or a category", async () => {
    const best = await byName("Best Seller");
    const refused = await asAdmin("DELETE", `/marketing/landing-sections/${best.id}`);
    assert.equal(refused.status, 409);
    assert.equal((await edit(best, { type: "curated", source: { products: [picks[0]] }, confirmSourceChange: true })).status, 422);

    const shelf = await byName("Tomato Shelf");
    const productsBefore = await Product.countDocuments();
    const tomatoBefore = await Product.findById(tomato._id).lean();
    assert.equal((await asAdmin("DELETE", `/marketing/landing-sections/${shelf.id}`)).status, 200);

    assert.equal(await byName("Tomato Shelf"), undefined);
    assert.equal(await Product.countDocuments(), productsBefore);
    const tomatoAfter = await Product.findById(tomato._id).lean();
    assert.deepEqual(tomatoAfter.positions, tomatoBefore.positions);
    assert.equal(String(tomatoAfter.category), String(tomatoBefore.category));
    const items = await list();
    assert.deepEqual(items.map((s) => s.seq), items.map((_, i) => i + 1));
  });

  it("only staff with marketing access can change sections", async () => {
    const res = await api.call("POST", "/marketing/landing-sections", {
      token: api.customerToken,
      body: { name: "Sneaky", type: "curated", source: { products: [picks[0]] } },
    });
    assert.ok([401, 403].includes(res.status));
  });
});
