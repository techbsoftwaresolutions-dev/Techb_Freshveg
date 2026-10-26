// Product sections (Best Seller, Trending, On Discount) and the independent
// order kept in each — run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("product sections and ordering", () => {
  let api;
  let Product;
  let products; // three active, discounted products from the seed
  let plain; // an active product with no discount

  const asAdmin = (method, path, body) => api.call(method, path, { token: api.adminToken, body });
  const toggle = (product, section, enabled) =>
    asAdmin("PATCH", `/catalog/products/${product.id}/sections`, { section, enabled });
  const move = (product, key, position) =>
    asAdmin("PATCH", `/catalog/products/${product.id}/position`, { key, position });
  const listed = async (query) =>
    (await asAdmin("GET", `/catalog/products?limit=100&${query}`)).items.map((p) => p.id);
  const positions = async (key) => {
    const rows = await Product.find({ sections: key }).lean();
    return rows.map((p) => p.positions[key]).sort((a, b) => a - b);
  };

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Product = require("../src/modules/catalog/product.model");
    const discounted = await Product.find({ status: "active", maxDiscountPct: { $gt: 0 } }).sort({ name: 1 }).limit(3);
    products = discounted.map((p) => ({ id: p.id, name: p.name }));
    const tomato = await Product.findOne({ slug: "tomato" });
    const created = await asAdmin("POST", "/catalog/products", {
      name: "Full Price Gourd",
      category: String(tomato.category),
      status: "active",
      variants: [{ sellingPrice: 1000, mrp: 1000, isDefault: true }],
    });
    plain = { id: created.product.id, name: created.product.name };
    assert.equal(products.length, 3, "the seed has discounted products");
  });

  after(async () => api?.stop());

  it("puts one product in several sections, and taking one away keeps the others", async () => {
    const [a] = products;
    for (const section of ["best_seller", "trending", "on_discount"]) {
      assert.equal((await toggle(a, section, true)).status, 200);
    }
    assert.deepEqual((await Product.findById(a.id)).sections.slice().sort(), ["best_seller", "on_discount", "trending"]);

    await toggle(a, "on_discount", false);
    const fresh = await Product.findById(a.id);
    assert.deepEqual(fresh.sections.slice().sort(), ["best_seller", "trending"]);
    assert.equal(fresh.positions.get("on_discount"), undefined);

    // Ticking twice doesn't add it twice.
    await toggle(a, "trending", true);
    assert.equal((await Product.findById(a.id)).sections.filter((s) => s === "trending").length, 1);
  });

  it("each tab lists only its own products, with counts to match", async () => {
    const [a, b] = products;
    await toggle(b, "trending", true);
    const res = await asAdmin("GET", "/catalog/products?section=trending&limit=100");
    assert.deepEqual(res.items.map((p) => p.id).sort(), [a.id, b.id].sort());
    assert.equal(res.counts.trending, 2);
    assert.equal(res.counts.best_seller, 1);
    assert.equal(res.order.key, "trending");
    assert.ok(!(await listed("section=on_discount")).includes(a.id));
  });

  it("refuses On Discount for a product the pricing doesn't discount", async () => {
    const res = await toggle(plain, "on_discount", true);
    assert.equal(res.status, 422);
    assert.ok(!(await Product.findById(plain.id)).sections.includes("on_discount"));
  });

  it("keeps a separate order per section, so a move in one leaves the other alone", async () => {
    const [a, b, c] = products;
    await toggle(b, "best_seller", true);
    await toggle(c, "best_seller", true);
    await toggle(c, "trending", true);
    // Joining goes to the end.
    assert.deepEqual(await listed("section=best_seller"), [a.id, b.id, c.id]);
    assert.deepEqual(await listed("section=trending"), [a.id, b.id, c.id]);

    assert.equal((await move(c, "best_seller", 1)).position, 1);
    assert.deepEqual(await listed("section=best_seller"), [c.id, a.id, b.id]);
    assert.deepEqual(await listed("section=trending"), [a.id, b.id, c.id]);

    await move(b, "trending", 1);
    assert.deepEqual(await listed("section=trending"), [b.id, a.id, c.id]);
    assert.deepEqual(await listed("section=best_seller"), [c.id, a.id, b.id]);

    // Positions stay 1..n — no duplicates, no gaps — and a position past
    // the end lands last.
    assert.equal((await move(c, "best_seller", 99)).position, 3);
    assert.deepEqual(await positions("best_seller"), [1, 2, 3]);
  });

  it("leaving or archiving closes the gap; paging follows the saved order", async () => {
    const [a, b, c] = products;
    await toggle(a, "best_seller", false); // best_seller was [a, b, c]
    assert.deepEqual(await listed("section=best_seller"), [b.id, c.id]);
    assert.deepEqual(await positions("best_seller"), [1, 2]);

    const page2 = await asAdmin("GET", "/catalog/products?section=best_seller&limit=1&page=2");
    assert.deepEqual(page2.items.map((p) => p.id), [c.id]);

    await asAdmin("DELETE", `/catalog/products/${b.id}`);
    assert.deepEqual(await listed("section=trending"), [a.id, c.id]);
    const trending = await Product.find({ sections: "trending", status: { $ne: "archived" } }).lean();
    assert.deepEqual(trending.map((p) => p.positions.trending).sort(), [1, 2]);
  });

  it("orders a category's rail on its own, and a new product joins at the end", async () => {
    const tomato = await Product.findOne({ slug: "tomato" });
    const rootId = String(tomato.categoryPath[0]);
    const rail = await listed(`category=${rootId}`);
    assert.ok(rail.length > 1);

    await move({ id: tomato.id }, "category", rail.length);
    const after = await listed(`category=${rootId}`);
    assert.equal(after.at(-1), tomato.id);

    const created = await asAdmin("POST", "/catalog/products", {
      name: "Section Test Squash",
      category: String(tomato.category),
      status: "active",
      variants: [{ sellingPrice: 1000, mrp: 1000, isDefault: true }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.error));
    const withNew = await listed(`category=${rootId}`);
    assert.equal(withNew.at(-1), created.product.id);
    assert.deepEqual(withNew.slice(0, -1), after);
  });

  it("a full-form save can't overwrite sections or positions", async () => {
    const [, , c] = products;
    const before = await Product.findById(c.id).lean();
    const res = await asAdmin("PATCH", `/catalog/products/${c.id}`, {
      shortDescription: "edited",
      sections: [],
      positions: { trending: 42 },
    });
    assert.equal(res.status, 200, JSON.stringify(res.error));
    const now = await Product.findById(c.id).lean();
    assert.deepEqual(now.sections, before.sections);
    assert.deepEqual(now.positions, before.positions);
  });

  it("the storefront serves each section in its saved order", async () => {
    const [a, , c] = products;
    const home = await api.call("GET", "/storefront/home");
    const trending = home.landing.find((s) => s.classification === "trending");
    assert.deepEqual(trending.products.map((p) => p.id), [a.id, c.id]);
    assert.ok(trending.products[0].sections.includes("trending"));

    const list = await api.call("GET", "/storefront/products?section=trending&limit=10");
    assert.deepEqual(list.items.map((p) => p.id), [a.id, c.id]);
  });
});
