// Delivery areas — run with `npm test`. Real HTTP API on an in-memory MongoDB
// with the demo seed: two stores (Hosur 635109/635110/635126, Bangalore
// 560100/560068), and a customer whose address is in 635109.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestApi } = require("./helpers");

describe("Delivery areas", () => {
  let api;
  let call;
  let admin;
  let Store;
  let Order;

  before(async () => {
    api = await startTestApi();
    ({ call, adminToken: admin } = api);
    Store = require("../src/modules/stores/store.model");
    Order = require("../src/modules/orders/order.model");
  });
  after(async () => api?.stop());

  const list = (query = "") => call("GET", `/delivery-areas${query}`, { token: admin });
  const publicAreas = async () => (await call("GET", "/stores/service-areas")).areas;
  const hosur = async () => Store.findOne({ code: "HSR01" });

  it("brings in the areas stores already had, once, without losing any", async () => {
    const before = (await hosur()).servicePincodes.slice().sort();
    const first = await list("?limit=100");
    assert.equal(first.status, 200);
    const hosurAreas = first.items.filter((a) => a.storeName.includes("Hosur"));
    assert.deepEqual(hosurAreas.map((a) => a.pincode).sort(), before);
    assert.ok(hosurAreas.every((a) => a.city === "Hosur" && a.state === "Tamil Nadu" && a.active));
    assert.equal(first.items.length, 5);
    // A second visit does not import again.
    assert.equal((await list("?limit=100")).items.length, 5);
  });

  it("only admins with settings access can manage areas", async () => {
    assert.equal((await call("GET", "/delivery-areas")).status, 401);
    assert.equal((await call("GET", "/delivery-areas", { token: api.customerToken })).status, 403);
    assert.equal((await call("GET", "/delivery-areas", { token: api.supervisorToken })).status, 403);
    assert.equal((await call("POST", "/delivery-areas", { token: api.supervisorToken, body: { name: "X", city: "Y", pincode: "123456" } })).status, 403);
  });

  it("validates the form and refuses duplicates, whatever the case or spacing", async () => {
    let res = await call("POST", "/delivery-areas", { token: admin, body: { name: "", city: "", pincode: "12" } });
    assert.equal(res.status, 422);
    assert.ok(res.error.details.name && res.error.details.city && res.error.details.pincode);

    res = await call("POST", "/delivery-areas", {
      token: admin,
      body: { name: "Mathigiri", city: "Hosur", state: "Tamil Nadu", pincode: "635110", store: (await hosur()).id, description: "Behind the bus depot" },
    });
    assert.equal(res.status, 201, JSON.stringify(res.error));
    res = await call("POST", "/delivery-areas", { token: admin, body: { name: "  mathigiri ", city: "HOSUR", pincode: "635110" } });
    assert.equal(res.status, 422);
    assert.match(res.error.details.name, /already in the list/);
    // The same name in another city or pincode is a different place.
    res = await call("POST", "/delivery-areas", { token: admin, body: { name: "Mathigiri", city: "Krishnagiri", pincode: "635001" } });
    assert.equal(res.status, 201);
  });

  it("customers see only active areas, with nothing internal", async () => {
    const areas = await publicAreas();
    const mathigiri = areas.find((a) => a.name === "Mathigiri" && a.pincode === "635110");
    assert.ok(mathigiri);
    assert.deepEqual(Object.keys(mathigiri).sort(), ["city", "id", "name", "pincode", "state"]);
  });

  it("deactivating hides an area from customers and from store coverage; reactivating restores it", async () => {
    const { items } = await list("?search=635126");
    const area = items[0];
    let res = await call("PATCH", `/delivery-areas/${area.id}`, { token: admin, body: { active: false } });
    assert.equal(res.status, 200);
    assert.ok(!(await publicAreas()).some((a) => a.id === area.id));
    assert.ok(!(await hosur()).servicePincodes.includes("635126"), "the store stops serving that pincode");
    const check = await call("GET", "/storefront/serviceability?pincode=635126");
    assert.equal(check.serviceable, false);
    // Still listed for the admin, as inactive.
    const inactive = await list("?status=inactive");
    assert.ok(inactive.items.some((a) => a.id === area.id));

    res = await call("PATCH", `/delivery-areas/${area.id}`, { token: admin, body: { active: true } });
    assert.equal(res.status, 200);
    assert.ok((await hosur()).servicePincodes.includes("635126"));
    assert.equal((await call("GET", "/storefront/serviceability?pincode=635126")).serviceable, true);
  });

  it("a store save can no longer overwrite the coverage", async () => {
    const store = await hosur();
    const coverage = store.servicePincodes.slice().sort();
    const res = await call("PATCH", `/stores/${store.id}`, { token: admin, body: { name: store.name, serviceAreas: [], servicePincodes: ["999999"] } });
    assert.equal(res.status, 200);
    const after = await hosur();
    assert.deepEqual(after.servicePincodes.slice().sort(), coverage);
    assert.ok(!after.servicePincodes.includes("999999"));
  });

  it("checkout attaches the picked area to the order, and keeps it if the area is renamed later", async () => {
    const { items } = await list("?search=635109");
    const area = items[0];
    const placed = await api.placeOrder({ deliveryArea: area.id });
    assert.equal(placed.status, 201, JSON.stringify(placed.error));
    assert.equal(placed.order.delivery.area.id, area.id);
    assert.equal(placed.order.delivery.area.name, area.name);
    assert.equal(placed.order.delivery.address.pincode, "635109");

    await call("PATCH", `/delivery-areas/${area.id}`, { token: admin, body: { name: "Hosur Town" } });
    const stored = await Order.findById(placed.order.id);
    assert.equal(stored.delivery.area.name, area.name, "the order keeps the name it was placed under");
  });

  it("an app that sends no area still gets one, from the address pincode", async () => {
    const placed = await api.placeOrder();
    assert.equal(placed.status, 201, JSON.stringify(placed.error));
    assert.equal(placed.order.delivery.area.pincode, "635109");
  });

  it("refuses an area switched off since the customer picked it, with a clear message", async () => {
    const { items } = await list("?search=635109");
    const area = items[0];
    await call("PATCH", `/delivery-areas/${area.id}`, { token: admin, body: { active: false } });
    try {
      const placed = await api.placeOrder({ deliveryArea: area.id });
      assert.equal(placed.status, 409);
      assert.match(placed.error.message, /no longer one of our delivery areas/);
      // The website re-checks a saved pick the same way.
      const check = await call("GET", `/storefront/serviceability?pincode=635110&area=${area.id}`);
      assert.equal(check.serviceable, false);
      assert.equal(check.areaUnavailable, true);
    } finally {
      await call("PATCH", `/delivery-areas/${area.id}`, { token: admin, body: { active: true } });
    }
  });

  it("refuses an address no active area covers, and a made-up area id", async () => {
    let placed = await api.placeOrder({ deliveryArea: "000000000000000000000000" });
    assert.equal(placed.status, 409);
    placed = await api.placeOrder({ deliveryArea: "not-an-id" });
    assert.equal(placed.status, 409);

    // Every area on the customer's pincode off: no checkout there at all.
    const { items } = await list("?search=635109");
    for (const a of items) await call("PATCH", `/delivery-areas/${a.id}`, { token: admin, body: { active: false } });
    try {
      placed = await api.placeOrder();
      assert.equal(placed.status, 409);
      assert.match(placed.error.message, /635109/);
    } finally {
      for (const a of items) await call("PATCH", `/delivery-areas/${a.id}`, { token: admin, body: { active: true } });
    }
  });

  it("an area with orders cannot be deleted; an unused one can", async () => {
    const { items } = await list("?search=635109");
    const used = items.find((a) => a.orders > 0);
    assert.ok(used, "an area the earlier orders went to");
    let res = await call("DELETE", `/delivery-areas/${used.id}`, { token: admin });
    assert.equal(res.status, 409);
    assert.match(res.error.message, /deactivate it instead/);

    const created = await call("POST", "/delivery-areas", { token: admin, body: { name: "Zuzuvadi", city: "Hosur", pincode: "635126", store: (await hosur()).id } });
    res = await call("DELETE", `/delivery-areas/${created.area.id}`, { token: admin });
    assert.equal(res.status, 200);
    assert.ok(!(await publicAreas()).some((a) => a.name === "Zuzuvadi"));
    // 635126 is still covered by its other area.
    assert.ok((await hosur()).servicePincodes.includes("635126"));
  });

  it("records changes in the audit log", async () => {
    const log = await call("GET", "/audit?entity=DeliveryArea&limit=50", { token: admin });
    const actions = new Set((log.items || []).map((x) => x.action));
    for (const action of ["create", "update", "deactivate", "activate", "delete"]) assert.ok(actions.has(action), action);
  });
});
