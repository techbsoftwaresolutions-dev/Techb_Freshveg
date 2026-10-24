// Adding stock (Admin → Inventory "Add stock" and the product page's Stock
// card both call POST /inventory/receive) — run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("adding stock", () => {
  let api;
  let store;
  let variant;

  const receive = (body, token = api.adminToken) => api.call("POST", "/inventory/receive", { token, body });
  const onHand = async () =>
    (await api.call("GET", `/inventory?store=${store}&limit=100`, { token: api.adminToken })).items.find(
      (row) => row.variant.id === variant
    )?.onHand ?? 0;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    store = (await api.call("GET", "/stores/public")).stores[0].id;
    variant = (await api.call("GET", "/storefront/products/tomato")).variants[0].id;
  });

  after(async () => api?.stop());

  it("adds to what is on hand rather than replacing it, and logs the movement", async () => {
    const start = await onHand();
    const res = await receive({ store, variant, quantity: 5 });
    assert.equal(res.status, 200);
    assert.equal(res.inventory.onHand, start + 5);
    assert.equal(await onHand(), start + 5);

    const moves = await api.call("GET", `/inventory/movements?variant=${variant}&type=receive`, { token: api.adminToken });
    assert.equal(moves.items[0].quantity, 5);
    assert.equal(moves.items[0].onHandAfter, start + 5);
  });

  it("rejects zero, negative and non-numeric amounts", async () => {
    const start = await onHand();
    for (const quantity of [0, -3, "abc", null]) {
      assert.equal((await receive({ store, variant, quantity })).status, 400, `accepted ${JSON.stringify(quantity)}`);
    }
    assert.equal(await onHand(), start);
  });

  it("lists each variant as its own row with its own stock", async () => {
    const tomato = await api.call("GET", "/storefront/products/tomato");
    assert.ok(tomato.variants.length >= 2, "seed tomato has several packs");
    const list = async (q = "tomato") =>
      (await api.call("GET", `/inventory/variants?store=${store}&q=${encodeURIComponent(q)}&limit=100`, { token: api.adminToken })).items;

    const rows = (await list()).filter((row) => row.product.id === tomato.product.id);
    assert.deepEqual(rows.map((r) => r.variant.id).sort(), tomato.variants.map((v) => v.id).sort(), "one row per variant, no duplicates");

    const [first, second] = rows;
    await receive({ store, variant: first.variant.id, quantity: 7 });
    const after = (await list()).filter((row) => row.product.id === tomato.product.id);
    assert.equal(after.find((r) => r.variant.id === first.variant.id).onHand, first.onHand + 7);
    assert.equal(after.find((r) => r.variant.id === second.variant.id).onHand, second.onHand, "other variant untouched");

    const bySku = await list(second.variant.sku);
    assert.deepEqual(bySku.map((r) => r.variant.id), [second.variant.id]);
  });

  it("narrows every view to a main category and everything under it", async () => {
    const tomato = await api.call("GET", "/storefront/products/tomato");
    const root = String(tomato.product.categoryPath[0]?.id || tomato.product.categoryPath[0]);
    const get = (path) => api.call("GET", `/inventory/${path}?store=${store}&category=${root}&limit=100`, { token: api.adminToken });

    const rows = (await get("variants")).items;
    assert.ok(rows.some((r) => r.product.id === tomato.product.id), "tomato is in its own department");
    const all = (await api.call("GET", `/inventory/variants?store=${store}&limit=100`, { token: api.adminToken })).meta.total;
    assert.ok(rows.length < all, "other departments are left out");

    for (const path of ["low-stock", "out-of-stock", "expiring", "movements"]) {
      assert.equal((await get(path)).status, 200, path);
    }
    const moves = (await get("movements")).items;
    assert.ok(moves.length && moves.every((m) => rows.some((r) => r.variant.id === String(m.variant))), "movements stay in the department");

    const bad = await api.call("GET", `/inventory/variants?category=nope`, { token: api.adminToken });
    assert.equal(bad.status, 400);
  });

  it("needs inventory permission", async () => {
    assert.equal((await api.call("POST", "/inventory/receive", { body: { store, variant, quantity: 1 } })).status, 401);
    assert.equal((await receive({ store, variant, quantity: 1 }, api.customerToken)).status, 403);
  });
});
