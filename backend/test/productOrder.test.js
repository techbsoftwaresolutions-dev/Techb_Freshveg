// Whole-section product ordering (the admin's Reorder view): read the full
// order, save a full new one, and what that does — and doesn't — touch.
// Run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("reordering a whole section", () => {
  let api;
  let Product;
  let members; // 15 product ids in Best Seller, in their saved order

  const asAdmin = (method, path, body) => api.call(method, path, { token: api.adminToken, body });
  const read = (key) => asAdmin("GET", `/catalog/orders/${encodeURIComponent(key)}`);
  const save = (key, ids, version) => asAdmin("PUT", `/catalog/orders/${encodeURIComponent(key)}`, { ids, version });
  const ids = async (key) => (await read(key)).items.map((p) => p.id);
  const moveTo = (list, from, to) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  const toggle = (id, section, enabled) =>
    asAdmin("PATCH", `/catalog/products/${id}/sections`, { section, enabled });

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Product = require("../src/modules/catalog/product.model");
    // The landing defaults put the featured products in Best Seller; start
    // from a known set of 15 instead.
    await asAdmin("GET", "/marketing/landing-sections");
    for (const p of await Product.find({ sections: "best_seller" })) await toggle(p.id, "best_seller", false);
    // The seed has fewer than 15 active products; top up through the API.
    const tomato = await Product.findOne({ slug: "tomato" });
    for (let n = 1; n <= 5; n += 1) {
      const made = await asAdmin("POST", "/catalog/products", {
        name: `Order Test Gourd ${n}`, category: String(tomato.category), status: "active",
        variants: [{ sellingPrice: 1000 + n, mrp: 1200, isDefault: true }],
      });
      assert.equal(made.status, 201, JSON.stringify(made.error));
    }
    const pool = await Product.find({ status: "active" }).sort({ name: 1 }).limit(15);
    assert.equal(pool.length, 15);
    for (const p of pool) await toggle(p.id, "best_seller", true);
    members = await ids("best_seller");
    assert.equal(members.length, 15);
  });

  after(async () => api?.stop());

  it("reads the whole section with 1..n positions and a version", async () => {
    const order = await read("best_seller");
    assert.deepEqual(order.items.map((p) => p.position), Array.from({ length: 15 }, (_, i) => i + 1));
    assert.ok(order.version);
    assert.ok(order.items.every((p) => p.name && "image" in p && !("variants" in p)));
  });

  it("moves position 15 to 1 across page boundaries, and paging follows", async () => {
    const trendingBefore = await ids("trending");
    const tomato = await Product.findOne({ slug: "tomato" });
    const categoryKey = `category:${tomato.categoryPath[0]}`;
    const categoryBefore = await ids(categoryKey);

    const { version } = await read("best_seller");
    const wanted = moveTo(members, 14, 0);
    const res = await save("best_seller", wanted, version);
    assert.equal(res.status, 200, JSON.stringify(res.error));
    assert.deepEqual(res.items.map((p) => p.id), wanted);
    assert.notEqual(res.version, version);

    // The paged product table shows the same order: page 2 of 10-per-page
    // is positions 11-15.
    const page2 = await asAdmin("GET", "/catalog/products?section=best_seller&limit=10&page=2");
    assert.deepEqual(page2.items.map((p) => p.id), wanted.slice(10));
    assert.deepEqual(page2.items.map((p) => p.positions.best_seller), [11, 12, 13, 14, 15]);

    // Nothing else moved.
    assert.deepEqual(await ids("trending"), trendingBefore);
    assert.deepEqual(await ids(categoryKey), categoryBefore);
    members = wanted;
  });

  it("moves 1 to 15, swaps neighbours, and moves to the last place", async () => {
    for (const [from, to] of [[0, 14], [3, 4], [6, 14]]) {
      const { version } = await read("best_seller");
      const wanted = moveTo(members, from, to);
      assert.equal((await save("best_seller", wanted, version)).status, 200);
      assert.deepEqual(await ids("best_seller"), wanted);
      members = wanted;
    }
    const rows = await Product.find({ sections: "best_seller" }).lean();
    assert.deepEqual(rows.map((p) => p.positions.best_seller).sort((a, b) => a - b), Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("refuses a stale version, a filtered subset, duplicates and junk — and changes nothing", async () => {
    const { version } = await read("best_seller");
    const stale = await save("best_seller", moveTo(members, 2, 0), "0000000000000000");
    assert.equal(stale.status, 409);
    assert.equal(stale.error.details.stale, true);

    // A search for one product must never stand in for the whole section.
    const subset = await save("best_seller", [members[5]], version);
    assert.equal(subset.status, 409);
    assert.equal((await save("best_seller", [...members.slice(0, 14), members[0]], version)).status, 400);
    assert.equal((await save("best_seller", "not a list", version)).status, 400);
    assert.deepEqual(await ids("best_seller"), members);
  });

  it("a retried save (timeout, double click) lands once, not twice", async () => {
    const { version } = await read("best_seller");
    const wanted = moveTo(members, 9, 1);
    assert.equal((await save("best_seller", wanted, version)).status, 200);
    // The same request again: refused as stale, order is still `wanted`.
    assert.equal((await save("best_seller", wanted, version)).status, 409);
    assert.deepEqual(await ids("best_seller"), wanted);
    members = wanted;
  });

  it("two admins saving from the same read: the second is refused", async () => {
    const { version } = await read("best_seller");
    const first = moveTo(members, 4, 0);
    const second = moveTo(members, 8, 0);
    const [a, b] = await Promise.all([save("best_seller", first, version), save("best_seller", second, version)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.deepEqual(await ids("best_seller"), a.status === 200 ? first : second);
    members = await ids("best_seller");
  });

  it("membership changes: join at the end, leave closes up, other orders untouched", async () => {
    const outsider = await Product.findOne({ status: "active", sections: { $ne: "best_seller" }, _id: { $nin: members } });
    const trendingBefore = await ids("trending");
    await toggle(outsider.id, "best_seller", true);
    const joined = await ids("best_seller");
    assert.deepEqual(joined, [...members, outsider.id]);

    await toggle(members[3], "best_seller", false);
    const left = await ids("best_seller");
    assert.deepEqual(left, [...members.slice(0, 3), ...members.slice(4), outsider.id]);
    assert.deepEqual((await read("best_seller")).items.map((p) => p.position), left.map((_, i) => i + 1));
    assert.deepEqual(await ids("trending"), trendingBefore);
    members = left;
  });

  it("moving a product to another category leaves its sections and their order alone", async () => {
    const moving = await Product.findById(members[0]);
    const Category = require("../src/modules/catalog/category.model");
    const target = await Category.findOne({ level: 0, _id: { $ne: moving.categoryPath[0] }, status: "active" });
    const leaf = (await Category.findOne({ ancestors: target._id, status: "active" })) || target;
    const oldKey = `category:${moving.categoryPath[0]}`;
    const newKey = `category:${target._id}`;

    const res = await asAdmin("PATCH", `/catalog/products/${moving.id}`, { category: String(leaf._id) });
    assert.equal(res.status, 200, JSON.stringify(res.error));
    assert.ok(!(await ids(oldKey)).includes(moving.id));
    assert.equal((await ids(newKey)).at(-1), moving.id);
    assert.deepEqual(await ids("best_seller"), members);
    const after = await Product.findById(moving.id).lean();
    assert.ok(after.sections.includes("best_seller"));
    assert.equal(after.positions[oldKey], undefined);
  });

  it("a hidden product keeps its place but leaves the storefront; it comes back where it was", async () => {
    const hidden = members[1];
    await asAdmin("PATCH", `/catalog/products/${hidden}/quick`, { status: "hidden" });
    assert.deepEqual(await ids("best_seller"), members);
    const listed = await api.call("GET", "/storefront/products?section=best_seller&limit=50");
    assert.ok(!listed.items.some((p) => p.id === hidden));

    await asAdmin("PATCH", `/catalog/products/${hidden}/quick`, { status: "active" });
    assert.deepEqual(await ids("best_seller"), members);
  });

  it("the website and the app get the saved order, with matching tags", async () => {
    const live = (await read("best_seller")).items.filter((p) => p.status === "active").map((p) => p.id);
    for (const platform of ["web", "app"]) {
      const home = await api.call("GET", `/storefront/home?platform=${platform}`);
      const row = home.landing.find((s) => s.classification === "best_seller");
      const inStock = row.products.filter((p) => p.inStock !== false).map((p) => p.id);
      assert.deepEqual(inStock, live.filter((id) => inStock.includes(id)), platform);
      assert.ok(row.products.every((p) => p.badges.includes("Best Seller")));
    }
    const listing = await api.call("GET", "/storefront/products?limit=50");
    for (const card of listing.items) {
      const saved = await Product.findById(card.id).lean();
      assert.equal(card.badges.includes("Best Seller"), saved.sections.includes("best_seller"), card.name);
      assert.ok(!card.badges.includes("On Discount"));
    }
  });

  it("curated sections keep their own order, with the same version checks", async () => {
    const created = await asAdmin("POST", "/marketing/landing-sections", {
      name: "Order Test Picks", type: "curated", source: { products: members.slice(0, 4) },
    });
    const key = created.section.orderKey;
    assert.match(key, /^curated:/);
    const order = await read(key);
    assert.deepEqual(order.items.map((p) => p.id), members.slice(0, 4));

    const wanted = moveTo(members.slice(0, 4), 3, 0);
    assert.equal((await save(key, wanted, order.version)).status, 200);
    assert.deepEqual(await ids(key), wanted);
    assert.equal((await save(key, members.slice(0, 4), order.version)).status, 409);
    assert.deepEqual(await ids("best_seller"), members);

    // The app shows the active picks in the saved order (sold-out ones last).
    const app = await api.call("GET", "/storefront/home?platform=app");
    const row = app.landing.find((s) => s.name === "Order Test Picks").products;
    const inStock = row.filter((p) => p.inStock !== false).map((p) => p.id);
    assert.deepEqual(inStock, wanted.filter((id) => inStock.includes(id)));
  });

  it("only staff who can manage the catalog may save an order", async () => {
    const { version } = await read("best_seller");
    const res = await api.call("PUT", "/catalog/orders/best_seller", { token: api.customerToken, body: { ids: members, version } });
    assert.ok([401, 403].includes(res.status));
  });
});
