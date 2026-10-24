// Disabling a category (Admin → Categories → Disable / Activate) hides it,
// its sub-categories and every product under them from customers, and
// activating it brings back exactly that — run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("disabling a category", () => {
  let api;
  let root; // the main category tomato sits under
  let child; // one of root's sub-categories
  let tomato; // { id, slug }
  let Product;

  const setStatus = (id, status) =>
    api.call("PATCH", `/catalog/categories/${id}`, { token: api.adminToken, body: { status } });
  const storefrontIds = async () => {
    const ids = [];
    const walk = (nodes) => nodes.forEach((n) => (ids.push(n.id), walk(n.children || [])));
    walk((await api.call("GET", "/storefront/categories")).categories);
    return ids;
  };
  const productVisible = async (slug) => (await api.call("GET", `/storefront/products/${slug}`)).status === 200;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Product = require("../src/modules/catalog/product.model");

    const detail = await api.call("GET", "/storefront/products/tomato");
    const path = detail.product.categoryPath.map((c) => String(c.id || c));
    tomato = { id: detail.product.id, slug: "tomato" };
    root = path[0];

    const { tree } = await api.call("GET", "/catalog/categories/tree?status=all", { token: api.adminToken });
    const rootNode = tree.find((n) => n.id === root);
    assert.ok(rootNode?.children?.length, "tomato's main category has sub-categories in the seed");
    child = rootNode.children[0].id;
  });

  after(async () => api?.stop());

  it("hides the category, its sub-categories and their products", async () => {
    // A product the admin had already hidden on its own, to check it stays so.
    const own = await Product.findOne({ categoryPath: root, status: "active", _id: { $ne: tomato.id } });
    await api.call("PATCH", `/catalog/products/${own.id}/quick`, { token: api.adminToken, body: { status: "hidden" } });

    assert.ok(await productVisible(tomato.slug));
    const res = await setStatus(root, "hidden");
    assert.equal(res.status, 200);

    const ids = await storefrontIds();
    assert.ok(!ids.includes(root), "category gone from the site");
    assert.ok(!ids.includes(child), "sub-category not promoted to top level");
    assert.equal(await productVisible(tomato.slug), false, "product page gone");
    const search = await api.call("GET", "/storefront/search?q=tomato");
    assert.ok(!(search.items || []).some((p) => p.id === tomato.id), "not in search");
    assert.equal(await Product.countDocuments({ categoryPath: root, status: "active" }), 0, "nothing under it is live");

    // Turning a product back on by hand while its category is off keeps it hidden.
    const quick = await api.call("PATCH", `/catalog/products/${tomato.id}/quick`, { token: api.adminToken, body: { status: "active" } });
    assert.equal(quick.product.status, "hidden");
  });

  it("won't activate a sub-category while its main category is off", async () => {
    const res = await setStatus(child, "active");
    assert.equal(res.status, 400);
    assert.match(res.error.message, /Activate/);
  });

  it("activating brings back exactly what it hid", async () => {
    const res = await setStatus(root, "active");
    assert.equal(res.status, 200);

    const ids = await storefrontIds();
    assert.ok(ids.includes(root) && ids.includes(child));
    assert.ok(await productVisible(tomato.slug));

    const own = await Product.findOne({ categoryPath: root, status: "hidden" });
    assert.ok(own, "the product hidden by hand before stays hidden");
    assert.equal(own.hiddenBy, null);
  });
});
