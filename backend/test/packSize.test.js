// A variant's pack is read from its Pack Size label (Admin → product →
// Variants & pricing) — run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { packSizeFromLabel } = require("../src/modules/catalog/product.service");

describe("pack size from its label", () => {
  it("reads the size the storefront labels and prices against", () => {
    const cases = {
      "500 g": { value: 0.5, unit: "kg" },
      "250g": { value: 0.25, unit: "kg" },
      "1 KG": { value: 1, unit: "kg" },
      "5 kgs": { value: 5, unit: "kg" },
      "100 ml": { value: 0.1, unit: "l" },
      "1 Ltr": { value: 1, unit: "l" },
      "12 Pieces": { value: 12, unit: "pcs" },
      "1 Piece": { value: 1, unit: "pcs" },
      "2 Pack": { value: 2, unit: "pcs" },
      "1 dozen": { value: 12, unit: "pcs" },
      "1 Bunch": { value: 1, unit: "bunch" },
      Bunch: { value: 1, unit: "bunch" },
    };
    for (const [label, expected] of Object.entries(cases)) {
      assert.deepEqual(packSizeFromLabel(label), expected, label);
    }
  });

  it("gives nothing for an empty label, so the pack already saved is kept", () => {
    for (const label of ["", "  ", undefined, null]) assert.equal(packSizeFromLabel(label), null);
  });
});

describe("saving a product", () => {
  let api;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
  });

  after(async () => api?.stop());

  it("stores each variant's pack from its Pack Size, ignoring what the form sent", async () => {
    const Variant = require("../src/modules/catalog/variant.model");
    const tomato = await api.call("GET", "/storefront/products/tomato");
    const full = await api.call("GET", `/catalog/products/${tomato.product.id}`, { token: api.adminToken });
    const variants = full.variants.map((v) => ({ ...v, packSize: { value: 99, unit: "box" } }));

    const res = await api.call("PATCH", `/catalog/products/${tomato.product.id}`, { token: api.adminToken, body: { variants } });
    assert.equal(res.status, 200, JSON.stringify(res.error));

    for (const v of await Variant.find({ product: tomato.product.id })) {
      const label = v.axisValues.find((a) => a.code === "pack_size")?.label;
      assert.deepEqual({ value: v.packSize.value, unit: v.packSize.unit }, packSizeFromLabel(label), label);
    }
  });
});
