// The delivery app's backend, end to end — run with `npm test` or
// `npm run test:delivery:integration`. Real HTTP API on a throwaway in-memory
// MongoDB (see helpers), with the delivery fixtures (src/seed/delivery.js).
//
// The path under test: an admin creates a Delivery Boy, they sign in to the
// delivery app with an OTP, an order is assigned to them, they run it to the
// door and hand it over with the customer's code — and at every step they
// can reach their own orders and nobody else's.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("delivery app through the real API", () => {
  let api;
  let seed;
  let seeded;
  let Order;
  let newRider; // created through the admin API below
  let kumar;
  let customerToken;

  const as = (token) => ({
    get: (path) => api.call("GET", path, { token }),
    post: (path, body = {}) => api.call("POST", path, { token, body }),
    patch: (path, body = {}) => api.call("PATCH", path, { token, body }),
  });
  const admin = () => as(api.adminToken);

  // The OTP routes allow 10 requests per IP per 15 minutes, which this file
  // would exceed from one address — so each sign-in comes from its own
  // (the app trusts one proxy hop, as behind the production load balancer).
  let clients = 0;
  async function otpLogin(phone, role) {
    clients += 1;
    const post = async (path, body) => {
      const response = await fetch(`${api.base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.0.0.${clients}` },
        body: JSON.stringify(body),
      });
      return { status: response.status, ...(await response.json()) };
    };
    const sent = await post("/auth/otp/request", { phone, role });
    return post("/auth/otp/verify", { phone, code: sent.devCode, role });
  }
  const fixture = (key) => seeded.orders.find((o) => o.fixture.key === key).order;

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    seed = require("../src/seed/delivery");
    Order = require("../src/modules/orders/order.model");
    seeded = await seed.seedDelivery();

    kumar = await otpLogin("9000000003", "delivery_partner");
    customerToken = (await otpLogin(seed.CUSTOMER.phone, "customer")).accessToken;
  });

  after(async () => api?.stop());

  // ------------------------------------------------------------- seed

  it("seeds riders, a customer and an order at every stage", () => {
    const stages = Object.fromEntries(seeded.orders.map(({ fixture: f, order }) => [f.key, order.status]));
    assert.deepEqual(stages, {
      ready: "READY_FOR_PICKUP",
      "kumar-assigned": "ASSIGNED_TO_DELIVERY",
      "kumar-out": "OUT_FOR_DELIVERY",
      "kumar-arrived": "ARRIVED",
      "kumar-delivered": "DELIVERED",
      "ravi-assigned": "ASSIGNED_TO_DELIVERY",
    });
    assert.equal(fixture("kumar-delivered").payment.status, "paid", "COD is paid on handover");
    assert.ok(fixture("kumar-out").delivery.pickedUpAt, "timestamps come from the real transitions");
  });

  it("running the seed again creates nothing", async () => {
    const before = await Order.countDocuments();
    const again = await seed.seedDelivery();
    assert.equal(again.log.created.length, 0, again.log.created.join(", "));
    assert.equal(await Order.countDocuments(), before);
  });

  // ------------------------------------------------------------- admin creates a rider

  it("only account managers can create a Delivery Boy, with valid details", async () => {
    const body = { name: "Arun (Delivery)", phone: "9000000020", role: "delivery_partner", status: "active" };
    assert.equal((await as(api.customerToken).post("/users", body)).status, 403);
    assert.equal((await as(api.supervisorToken).post("/users", body)).status, 403);
    assert.equal((await as(kumar.accessToken).post("/users", body)).status, 403);

    const bad = await admin().post("/users", { ...body, phone: "12345", name: "" });
    assert.equal(bad.status, 422);
    assert.ok(bad.error.details.phone && bad.error.details.name);

    const created = await admin().post("/users", body);
    assert.equal(created.status, 201, JSON.stringify(created.error));
    newRider = created.user;
    assert.equal(newRider.role, "delivery_partner");

    const duplicate = await admin().post("/users", body);
    assert.equal(duplicate.status, 422);
    assert.ok(duplicate.error.details.phone);

    const list = await admin().get("/users?role=delivery_partner&search=9000000020");
    assert.deepEqual(list.items.map((u) => u.id), [newRider.id]);
  });

  it("the new Delivery Boy signs in to the delivery app and gets their own profile", async () => {
    const login = await otpLogin("9000000020", "delivery_partner");
    assert.equal(login.status, 200, JSON.stringify(login.error));
    assert.ok(login.accessToken && login.refreshToken);
    newRider.token = login.accessToken;
    newRider.refreshToken = login.refreshToken;

    const me = await as(newRider.token).get("/auth/me");
    assert.equal(me.user.id, newRider.id);
    assert.equal(me.user.role, "delivery_partner");

    const queue = await as(newRider.token).get("/orders/delivery/queue");
    assert.deepEqual(queue.orders, []);
  });

  it("numbers that are not active Delivery Boys cannot sign in as one", async () => {
    assert.equal((await otpLogin("9000000099", "delivery_partner")).status, 403, "not on the roster");
    assert.equal((await otpLogin("9000000005", "delivery_partner")).status, 403, "seeded inactive rider");
    // A customer's number does not become a rider account.
    assert.equal((await otpLogin(seed.CUSTOMER.phone, "delivery_partner")).status, 403);
  });

  // ------------------------------------------------------------- what a rider can see

  it("a rider sees their own runs and never the customer's handover code", async () => {
    const queue = await as(kumar.accessToken).get("/orders/delivery/queue");
    const codes = queue.orders.map((o) => o.code).sort();
    assert.deepEqual(codes, [fixture("kumar-assigned"), fixture("kumar-out"), fixture("kumar-arrived")].map((o) => o.code).sort());
    assert.ok(queue.orders.every((o) => o.pickup?.name), "each run carries its pickup store");
    assert.ok(queue.orders.every((o) => o.delivery.otp === undefined), "no handover code in the queue");
    assert.equal(queue.stats.deliveredToday, 1);
    // Salaried store employees: counts and cash to hand in, no earnings.
    assert.ok(!("earnings" in queue.stats), JSON.stringify(queue.stats));
    assert.equal(typeof queue.stats.codCollected, "number");

    const detail = await as(kumar.accessToken).get(`/orders/${fixture("kumar-arrived").id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.order.delivery.otp, undefined, "no handover code in the order detail");

    const history = await as(kumar.accessToken).get("/orders/delivery/history");
    assert.deepEqual(history.items.map((o) => o.code), [fixture("kumar-delivered").code]);
    assert.equal(history.items[0].delivery.otp, undefined);

    // Tapping a history row opens the finished run in full.
    const done = await as(kumar.accessToken).get(`/orders/${fixture("kumar-delivered").id}`);
    assert.equal(done.status, 200);
    assert.equal(done.order.status, "DELIVERED");
    assert.ok(done.order.delivery.deliveredAt && done.order.items.length && done.order.pricing.total);
    assert.equal(done.order.delivery.otp, undefined);
    assert.ok(done.pickup?.name && done.pickup?.address, "where it was collected");
  });

  it("a rider cannot reach another rider's orders or the store-wide lists", async () => {
    const ravisOrder = fixture("ravi-assigned");
    const rider = as(kumar.accessToken);
    assert.equal((await rider.get(`/orders/${ravisOrder.id}`)).status, 403);
    assert.equal((await rider.post(`/orders/${ravisOrder.id}/status`, { status: "PICKED_UP" })).status, 403);
    assert.equal((await rider.post(`/orders/${ravisOrder.id}/deliver`, { otp: "0000" })).status, 403);
    assert.equal((await rider.get(`/delivery/orders/${ravisOrder.id}/position`)).status, 403);
    // Asking for someone else's queue returns your own.
    const peek = await rider.get(`/orders/delivery/queue?partner=${seeded.riders.ravi.id}`);
    assert.ok(!peek.orders.some((o) => o.id === ravisOrder.id));

    for (const path of ["/orders", "/payments", "/returns", "/delivery/report", `/orders/${ravisOrder.id}/track`]) {
      assert.equal((await rider.get(path)).status, 403, path);
    }
    assert.equal((await rider.get(`/orders/${fixture("ready").id}`)).status, 403, "unassigned orders too");
  });

  // ------------------------------------------------------------- the run

  it("admin assigns an order, and only that rider sees it", async () => {
    const order = fixture("ready");
    const partners = await admin().get(`/orders/delivery/partners?store=${order.store}`);
    assert.ok(partners.partners.some((p) => p.id === newRider.id), "the new rider is offered for assignment");
    assert.ok(!partners.partners.some((p) => p.phone === "9000000005"), "inactive riders are not");

    const assigned = await admin().post(`/orders/${order.id}/assign`, { partner: newRider.id });
    assert.equal(assigned.order.status, "ASSIGNED_TO_DELIVERY");

    const queue = await as(newRider.token).get("/orders/delivery/queue");
    assert.deepEqual(queue.orders.map((o) => o.id), [order.id]);
    const kumarsQueue = await as(kumar.accessToken).get("/orders/delivery/queue");
    assert.ok(!kumarsQueue.orders.some((o) => o.id === order.id));
  });

  it("the rider walks the run; wrong or skipped steps are refused", async () => {
    const id = fixture("ready").id;
    const rider = as(newRider.token);

    const skip = await rider.post(`/orders/${id}/status`, { status: "ARRIVED" });
    assert.equal(skip.status, 409, "cannot jump from assigned to arrived");
    const bogus = await rider.post(`/orders/${id}/status`, { status: "TELEPORTED" });
    assert.equal(bogus.status, 400);

    const picked = await rider.post(`/orders/${id}/status`, { status: "PICKED_UP" });
    assert.equal(picked.order.status, "PICKED_UP");
    assert.ok(picked.order.delivery.pickedUpAt);
    assert.equal(picked.order.delivery.otp, undefined);
    assert.equal((await rider.post(`/orders/${id}/status`, { status: "PICKED_UP" })).status, 409, "a double tap does not repeat it");

    assert.equal((await rider.post(`/orders/${id}/status`, { status: "OUT_FOR_DELIVERY" })).order.status, "OUT_FOR_DELIVERY");
    // The handover cannot be claimed without the customer's code.
    const claimed = await rider.post(`/orders/${id}/status`, { status: "DELIVERED" });
    assert.equal(claimed.status, 400);
    const arrived = await rider.post(`/orders/${id}/status`, { status: "ARRIVED" });
    assert.equal(arrived.order.status, "ARRIVED");
    assert.ok(arrived.order.delivery.arrivedAt);

    // The customer sees each step, and their code, on their order screen.
    const tracking = await as(customerToken).get(`/orders/${id}/track`);
    assert.equal(tracking.tracking.status, "ARRIVED");
    assert.match(tracking.tracking.otp, /^\d{4}$/);
  });

  it("the handover needs the customer's code, once", async () => {
    const id = fixture("ready").id;
    const rider = as(newRider.token);
    const { otp } = (await as(customerToken).get(`/orders/${id}/track`)).tracking;
    const wrong = otp === "0000" ? "1111" : "0000";

    assert.equal((await rider.post(`/orders/${id}/deliver`, { otp: wrong })).status, 400);
    assert.equal((await as(kumar.accessToken).post(`/orders/${id}/deliver`, { otp })).status, 403, "another rider");

    const done = await rider.post(`/orders/${id}/deliver`, { otp });
    assert.equal(done.order.status, "DELIVERED");
    assert.ok(done.order.delivery.deliveredAt && done.order.delivery.otpVerifiedAt);
    assert.equal(done.order.payment.status, "paid", "cash on delivery is collected");
    assert.equal((await rider.post(`/orders/${id}/deliver`, { otp })).status, 409, "no second handover");

    // Everyone else sees it delivered.
    assert.equal((await admin().get(`/orders/${id}`)).order.status, "DELIVERED");
    assert.equal((await as(customerToken).get(`/orders/${id}/track`)).tracking.status, "DELIVERED");
    const queue = await rider.get("/orders/delivery/queue");
    assert.deepEqual(queue.orders, []);
    assert.equal(queue.stats.deliveredToday, 1);
    assert.equal((await rider.get("/orders/delivery/history")).items[0].id, id);
  });

  it("wrong handover codes are capped", async () => {
    const id = fixture("kumar-arrived").id;
    const rider = as(kumar.accessToken);
    const { otp } = (await as(customerToken).get(`/orders/${id}/track`)).tracking;
    const wrong = otp === "0000" ? "1111" : "0000";
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await rider.post(`/orders/${id}/deliver`, { otp: wrong })).status, 400);
    }
    assert.equal((await rider.post(`/orders/${id}/deliver`, { otp })).status, 429);
    assert.equal((await Order.findById(id)).status, "ARRIVED");
  });

  // ------------------------------------------------------------- deactivation

  it("deactivating a Delivery Boy in admin ends their session at once", async () => {
    const off = await admin().patch(`/users/${newRider.id}`, { status: "blocked" });
    assert.equal(off.user.status, "blocked");

    assert.equal((await as(newRider.token).get("/orders/delivery/queue")).status, 401, "existing token refused");
    assert.equal((await api.call("POST", "/auth/refresh", { body: { refreshToken: newRider.refreshToken } })).status, 401);
    assert.equal((await otpLogin("9000000020", "delivery_partner")).status, 403);
    assert.equal((await admin().get(`/orders/delivery/partners`)).partners.some((p) => p.id === newRider.id), false);

    assert.equal((await admin().patch(`/users/${newRider.id}`, { status: "active" })).user.status, "active");
    assert.equal((await otpLogin("9000000020", "delivery_partner")).status, 200, "and reactivating restores it");
  });

  // ------------------------------------------------------------- admin assignment (Orders table)

  it("the partner list is active riders only, with their store limits", async () => {
    const { partners } = await admin().get("/orders/delivery/partners");
    assert.ok(partners.length >= 3);
    assert.ok(partners.every((p) => p.id && p.name && Array.isArray(p.stores)));
    assert.ok(!partners.some((p) => p.phone === "9000000005"), "inactive rider left out");
    assert.equal((await as(kumar.accessToken).get("/orders/delivery/partners")).status, 403);
    assert.equal((await as(api.customerToken).get("/orders/delivery/partners")).status, 403);
  });

  it("assignment rejects bad ids, inactive riders and outsiders", async () => {
    const id = fixture("kumar-assigned").id;
    const inactive = seeded.riders.inactive.id;
    assert.equal((await admin().post(`/orders/${id}/assign`, { partner: "not-an-id" })).status, 400);
    assert.equal((await admin().post(`/orders/${id}/assign`, {})).status, 400);
    assert.equal((await admin().post(`/orders/${id}/assign`, { partner: "6a0000000000000000000000" })).status, 400);
    const off = await admin().post(`/orders/${id}/assign`, { partner: inactive });
    assert.equal(off.status, 400);
    assert.match(off.error.message, /inactive/);
    assert.equal((await admin().post("/orders/6a0000000000000000000000/assign", { partner: inactive })).status, 404);
    assert.equal((await admin().post("/orders/nope/assign", { partner: inactive })).status, 404);

    const ravi = seeded.riders.ravi.id;
    assert.equal((await as(kumar.accessToken).post(`/orders/${id}/assign`, { partner: ravi })).status, 403);
    assert.equal((await as(customerToken).post(`/orders/${id}/assign`, { partner: ravi })).status, 403);
    assert.equal((await api.call("DELETE", `/orders/${id}/assign`, { token: kumar.accessToken })).status, 403);
    assert.equal((await api.call("DELETE", `/orders/${id}/assign`, { token: customerToken })).status, 403);
    assert.equal((await api.call("DELETE", `/orders/${id}/assign`)).status, 401);
  });

  it("assignment follows the order's stage", async () => {
    const out = await admin().post(`/orders/${fixture("kumar-out").id}/assign`, { partner: seeded.riders.ravi.id });
    assert.equal(out.status, 409);
    assert.match(out.error.message, /already collected/);
    assert.equal((await api.call("DELETE", `/orders/${fixture("kumar-out").id}/assign`, { token: api.adminToken })).status, 409);

    const done = await admin().post(`/orders/${fixture("kumar-delivered").id}/assign`, { partner: seeded.riders.ravi.id });
    assert.equal(done.status, 409);
    assert.match(done.error.message, /delivered/);

    // An order still being prepared is the store's until it is packed.
    const { order } = await api.placeOrder();
    const early = await admin().post(`/orders/${order.id}/assign`, { partner: seeded.riders.ravi.id });
    assert.equal(early.status, 409);
    assert.match(early.error.message, /ready for pickup/);
    assert.equal((await Order.findById(order.id)).delivery.partner, undefined);
    await admin().post(`/orders/${order.id}/status`, { status: "CANCELLED", note: "test" });
  });

  it("reassigning before pickup moves the run to the new rider only", async () => {
    const id = fixture("kumar-assigned").id;
    const before = await Order.findById(id);
    // Supervisor (store_manager) holds orders.assign and does the dispatching.
    const moved = await as(api.supervisorToken).post(`/orders/${id}/assign`, { partner: seeded.riders.ravi.id });
    assert.equal(moved.status, 200, JSON.stringify(moved.error));
    assert.equal(moved.message, "Assigned to Ravi (Delivery)");
    assert.equal(moved.order.status, "ASSIGNED_TO_DELIVERY", "stage unchanged");
    assert.equal(moved.order.delivery.partner, seeded.riders.ravi.id);
    assert.equal(moved.order.payment.status, before.payment.status, "payment untouched");
    assert.equal(moved.order.items.length, before.items.length);

    const ravi = await otpLogin("9000000004", "delivery_partner");
    assert.ok((await as(ravi.accessToken).get("/orders/delivery/queue")).orders.some((o) => o.id === id));
    assert.ok(!(await as(kumar.accessToken).get("/orders/delivery/queue")).orders.some((o) => o.id === id));
    assert.equal((await as(kumar.accessToken).get(`/orders/${id}`)).status, 403, "the previous rider loses it");
    assert.equal((await as(kumar.accessToken).post(`/orders/${id}/status`, { status: "PICKED_UP" })).status, 403);

    const again = await admin().post(`/orders/${id}/assign`, { partner: seeded.riders.ravi.id });
    assert.equal(again.message, "Already assigned to Ravi (Delivery)");

    const AuditLog = require("../src/modules/audit/audit.model");
    assert.ok(await AuditLog.exists({ entityId: id, action: "reassign" }), "the move is in the audit log");
  });

  it("removing the assignment returns the order to Ready for pickup, intact", async () => {
    const id = fixture("kumar-assigned").id;
    const before = await Order.findById(id);
    const removed = await api.call("DELETE", `/orders/${id}/assign`, { token: api.adminToken });
    assert.equal(removed.status, 200, JSON.stringify(removed.error));
    assert.equal(removed.order.status, "READY_FOR_PICKUP");
    assert.equal(removed.order.delivery.partner, undefined);
    assert.equal(removed.order.delivery.partnerName, "");
    assert.equal(removed.order.items.length, before.items.length);
    assert.equal(removed.order.pricing.total, before.pricing.total);
    assert.equal(removed.order.payment.status, before.payment.status);

    const ravi = await otpLogin("9000000004", "delivery_partner");
    assert.ok(!(await as(ravi.accessToken).get("/orders/delivery/queue")).orders.some((o) => o.id === id));
    assert.equal((await api.call("DELETE", `/orders/${id}/assign`, { token: api.adminToken })).status, 409, "nothing left to remove");
    // The rider account is untouched.
    assert.equal((await admin().get(`/users/${seeded.riders.ravi.id}`)).user.status, "active");

    // And it can be assigned again from here.
    const back = await admin().post(`/orders/${id}/assign`, { partner: seeded.riders.kumar.id });
    assert.equal(back.order.status, "ASSIGNED_TO_DELIVERY");
  });

  // ------------------------------------------------------------- clean-up

  it("the clean-up removes only the fixtures and releases their stock", async () => {
    const others = await Order.countDocuments({ customerNote: { $not: /^\[dev-seed:delivery\]/ } });
    const { orders } = await seed.cleanDelivery();
    assert.equal(orders, seed.ORDERS.length);
    assert.equal(await Order.countDocuments({ customerNote: /^\[dev-seed:delivery\]/ }), 0);
    assert.equal(await Order.countDocuments(), others);
    // The cancelled fixtures gave back what they held (no other order is open).
    const Inventory = require("../src/modules/inventory/inventory.model");
    assert.equal(await Inventory.countDocuments({ reserved: { $gt: 0 } }), 0);

    const reseeded = await seed.seedDelivery();
    assert.equal(reseeded.log.created.filter((line) => line.startsWith("order")).length, seed.ORDERS.length);
  });
});
