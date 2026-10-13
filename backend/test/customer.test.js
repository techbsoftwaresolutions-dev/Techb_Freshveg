// The customer-facing services the website and app both call — run with
// `npm test`. Real HTTP API on a throwaway in-memory MongoDB (see helpers).

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("customer services through the real API", () => {
  let api;
  let other; // a second customer, for ownership checks
  let Order;

  const as = (token) => ({
    get: (path) => api.call("GET", path, { token }),
    post: (path, body = {}) => api.call("POST", path, { token, body }),
    patch: (path, body = {}) => api.call("PATCH", path, { token, body }),
    del: (path) => api.call("DELETE", path, { token }),
  });

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Order = require("../src/modules/orders/order.model");

    const otp = await api.call("POST", "/auth/otp/request", { body: { phone: "9876500022" } });
    const login = await api.call("POST", "/auth/otp/verify", { body: { phone: "9876500022", code: otp.devCode } });
    other = { token: login.accessToken, user: login.user };
  });

  after(async () => api?.stop());

  it("order tracking returns the order itself, to its owner only", async () => {
    const { order } = await api.placeOrder();
    const me = await as(api.customerToken).get(`/orders/${order.id}/track`);
    assert.equal(me.order.id, order.id);
    assert.equal(me.order.items.length, order.items.length);
    assert.equal(me.tracking.code, order.code);
    assert.equal((await as(other.token).get(`/orders/${order.id}/track`)).status, 403);
  });

  it("customers cannot reach staff order operations", async () => {
    const { order } = await api.placeOrder();
    const customer = as(api.customerToken);
    assert.equal((await customer.get("/orders")).status, 403);
    assert.equal((await customer.get(`/orders/${order.id}`)).status, 403);
    assert.equal((await customer.post(`/orders/${order.id}/status`, { status: "ORDER_ACCEPTED" })).status, 403);
  });

  it("profile and saved addresses are editable by their owner", async () => {
    const customer = as(other.token);
    const named = await customer.patch("/auth/me", { name: "Asha Test", email: "asha@example.com", role: "admin" });
    assert.equal(named.user.name, "Asha Test");
    assert.notEqual(named.user.role, "admin", "role is not self-editable");

    const added = await customer.post("/auth/me/addresses", { label: "Home", line1: "1 Test St", city: "Bengaluru", pincode: "560001" });
    const id = added.addresses.at(-1).id;
    const edited = await customer.patch(`/auth/me/addresses/${id}`, { line1: "2 Test St" });
    assert.equal(edited.addresses.find((a) => a.id === id).line1, "2 Test St");
    const removed = await customer.del(`/auth/me/addresses/${id}`);
    assert.ok(!removed.addresses.some((a) => a.id === id));
  });

  it("notification feed and preferences", async () => {
    const customer = as(api.customerToken);
    const feed = await customer.get("/notifications?limit=5");
    assert.ok(Array.isArray(feed.items));
    assert.equal(typeof feed.unread, "number");
    const prefs = await customer.patch("/notifications/preferences", { offers: false });
    assert.equal(prefs.preferences.offers, false);
    assert.equal(prefs.preferences.orders, true, "other preferences untouched");
    await customer.patch("/notifications/preferences", { offers: true });
  });

  it("referral codes: summary, own code refused, claim once, before a first order", async () => {
    const owner = as(api.customerToken);
    const summary = await owner.get("/referrals/me");
    assert.ok(summary.code);

    const fresh = as(other.token);
    const mine = (await fresh.get("/referrals/me")).code;
    assert.equal((await fresh.post("/referrals/claim", { code: mine })).status, 400);
    assert.equal((await fresh.post("/referrals/claim", { code: "NOPE0000" })).status, 400);

    const claimed = await fresh.post("/referrals/claim", { code: summary.code.toLowerCase() });
    assert.equal(claimed.status, 201);
    assert.equal((await fresh.post("/referrals/claim", { code: summary.code })).status, 409);
    assert.equal((await owner.get("/referrals/me")).invited, 1);

    // The original customer has orders already, so cannot claim anyone's code.
    assert.equal((await owner.post("/referrals/claim", { code: mine })).status, 400);
  });

  it("support tickets: own only, staff internal notes never reach the customer", async () => {
    const customer = as(api.customerToken);
    const { order } = await api.placeOrder();
    const { categories } = await customer.get("/support/categories");
    assert.ok(categories.length);

    const created = await customer.post("/support", {
      category: categories[0].key, subject: "Where is my order?", message: "It is late", order: order.id,
    });
    assert.equal(created.status, 201);
    const ticket = created.ticket;
    assert.equal(ticket.orderCode, order.code);

    assert.equal((await as(other.token).post("/support", { category: categories[0].key, subject: "x", order: order.id })).status, 403);
    assert.equal((await as(other.token).post(`/support/${ticket.id}/messages`, { body: "hi" })).status, 403);

    const staff = as(api.adminToken);
    await staff.post(`/support/${ticket.id}/messages`, { body: "Customer sounds upset", internal: true });
    await staff.post(`/support/${ticket.id}/messages`, { body: "On its way!" });

    const reply = await customer.post(`/support/${ticket.id}/messages`, { body: "Thanks" });
    assert.ok(!reply.ticket.messages.some((m) => m.internal), "reply response hides internal notes");
    const listed = (await customer.get("/support/mine")).items.find((t) => t.id === ticket.id);
    assert.deepEqual(listed.messages.map((m) => m.body), ["It is late", "On its way!", "Thanks"]);
  });

  it("wallet at checkout: capped by the server, and off when the admin switches it off", async () => {
    const User = require("../src/modules/auth/user.model");
    const Settings = require("../src/modules/settings/settings.model");
    await User.updateOne({ phone: "9876543210", role: "customer" }, { $set: { walletBalance: 5000 } });
    const customer = as(api.customerToken);
    await customer.post("/cart/items", { variant: (await api.call("GET", "/storefront/products/tomato")).variants[0].id, quantity: 2 });

    const asked = await customer.post("/cart/credits", { wallet: 999999 });
    assert.equal(asked.cart.summary.walletApplied, 5000, "never more than the balance");
    assert.equal(asked.cart.credits.wallet, true);

    await Settings.updateOne({ key: "global" }, { $set: { "payment.allowWallet": false } });
    const off = await customer.get("/cart");
    assert.equal(off.cart.summary.walletApplied, 0);
    assert.equal(off.cart.credits.wallet, false);

    await Settings.updateOne({ key: "global" }, { $set: { "payment.allowWallet": true } });
    await customer.post("/cart/credits", { wallet: 0 });
  });

  it("returns: only delivered orders, only eligible items", async () => {
    const customer = as(api.customerToken);
    const { order } = await api.placeOrder();
    const before = await customer.get(`/returns/orders/${order.id}/returnable`);
    assert.equal(before.eligible, false);
    assert.equal((await customer.post(`/returns/orders/${order.id}/request`, { items: [{ orderItem: order.items[0].id }] })).status, 400);
    assert.equal((await as(other.token).get(`/returns/orders/${order.id}/returnable`)).status, 403);

    await Order.updateOne(
      { _id: order.id },
      { $set: { status: "DELIVERED", "delivery.deliveredAt": new Date() }, $push: { statusHistory: { status: "DELIVERED", at: new Date() } } }
    );
    const after = await customer.get(`/returns/orders/${order.id}/returnable`);
    const line = after.items.find((i) => i.eligible);
    if (line) {
      const requested = await customer.post(`/returns/orders/${order.id}/request`, { items: [{ orderItem: line.orderItem }], reason: "Damaged" });
      assert.equal(requested.order.status, "RETURN_REQUESTED");
    } else {
      assert.equal(after.eligible, false, "nothing returnable is reported as such");
    }
  });
});
