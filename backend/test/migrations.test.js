// Data migrations (src/migrations) — run with `npm test`, against the
// in-memory MongoDB the other tests use.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("retire the per-delivery fee", () => {
  let api;
  let stores;
  let retireDeliveryFee;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    stores = require("mongoose").connection.collection("stores");
    ({ retireDeliveryFee } = require("../src/migrations/20261014-retire-delivery-fee"));
    // As every store saved before the change has it.
    await stores.updateMany({}, { $set: { "settings.partnerFeePerDelivery": 2500 } });
  });

  after(async () => api?.stop());

  it("a dry run lists the stores and changes nothing", async () => {
    const total = await stores.countDocuments();
    const lines = [];
    assert.equal(await retireDeliveryFee({ log: (line) => lines.push(line) }), total);
    assert.equal(lines.length, total);
    assert.equal(await stores.countDocuments({ "settings.partnerFeePerDelivery": 2500 }), total);
  });

  it("--apply removes only that field, records each store, and is safe to repeat", async () => {
    const before = await stores.findOne({});
    const count = await retireDeliveryFee({ write: true, log: () => {} });
    assert.ok(count > 0);
    assert.equal(await stores.countDocuments({ "settings.partnerFeePerDelivery": { $exists: true } }), 0);

    const after = await stores.findOne({ _id: before._id });
    const { partnerFeePerDelivery, ...restBefore } = before.settings;
    assert.equal(partnerFeePerDelivery, 2500);
    assert.deepEqual(after.settings, restBefore, "every other store setting kept");

    const AuditLog = require("../src/modules/audit/audit.model");
    assert.equal(await AuditLog.countDocuments({ entity: "Store", action: "migrate" }), count);
    assert.match((await AuditLog.findOne({ entityId: before._id })).summary, /was ₹25\.00/);

    assert.equal(await retireDeliveryFee({ write: true, log: () => {} }), 0, "second run finds nothing");
  });

  it("the store API no longer carries a delivery fee", async () => {
    const { items } = await api.call("GET", "/stores", { token: api.adminToken });
    assert.ok(items.length);
    assert.ok(items.every((store) => !("partnerFeePerDelivery" in (store.settings || {}))));
  });
});
