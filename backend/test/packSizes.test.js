// Pack sizes (Admin → General settings → Units): the Pack Size dropdown's
// options — add, rename, disable, delete — run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("pack sizes", () => {
  let api;
  let Variant;

  const list = async () => (await api.call("GET", "/catalog/pack-sizes", { token: api.adminToken })).items;
  const add = (label, token = api.adminToken) => api.call("POST", "/catalog/pack-sizes", { token, body: { label } });
  const patch = (value, body) => api.call("PATCH", `/catalog/pack-sizes/${encodeURIComponent(value)}`, { token: api.adminToken, body });
  const remove = (value) => api.call("DELETE", `/catalog/pack-sizes/${encodeURIComponent(value)}`, { token: api.adminToken });

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Variant = require("../src/modules/catalog/variant.model");
  });

  after(async () => api?.stop());

  it("lists the Pack Size options with how many packs use each", async () => {
    const items = await list();
    const kg = items.find((i) => i.value === "1kg");
    assert.ok(kg && kg.active && kg.packs > 0, "the seeded 1 KG pack size is in use");
  });

  it("adds one, which the product form's Pack Size field then offers", async () => {
    const res = await add("100 ml");
    assert.equal(res.status, 201);
    assert.equal(res.item.value, "100ml");

    // The product form reads options from the category schema.
    const tomato = await api.call("GET", "/storefront/products/tomato");
    const leaf = String(tomato.product.categoryPath.at(-1)?.id || tomato.product.categoryPath.at(-1));
    const schema = await api.call("GET", `/catalog/categories/${leaf}/schema`, { token: api.adminToken });
    const field = [...(schema.variantAxes || []), ...(schema.fields || [])].find((f) => f.code === "pack_size");
    assert.ok(field?.options.some((o) => o.value === "100ml"), "offered in the Pack Size dropdown");

    assert.equal((await add("100 ML")).status, 409, "no duplicates");
    assert.equal((await add("  ")).status, 400);
    assert.equal((await add("2 pack", api.customerToken)).status, 403);
  });

  it("renames a pack size, packs that use it included", async () => {
    const res = await patch("1kg", { label: "1 kg" });
    assert.equal(res.status, 200);
    const pack = await Variant.findOne({ axisValues: { $elemMatch: { code: "pack_size", value: "1kg" } } });
    assert.equal(pack.axisValues.find((a) => a.code === "pack_size").label, "1 kg");
  });

  it("disables and enables", async () => {
    assert.equal((await patch("100ml", { active: false })).item.active, false);
    assert.equal((await list()).find((i) => i.value === "100ml").active, false);
    assert.equal((await patch("100ml", { active: true })).item.active, true);
  });

  it("deletes only a pack size no pack uses", async () => {
    const inUse = await remove("1kg");
    assert.equal(inUse.status, 409);
    assert.match(inUse.error.message, /disable it instead/);

    assert.equal((await remove("100ml")).status, 200);
    assert.ok(!(await list()).some((i) => i.value === "100ml"));
  });
});
