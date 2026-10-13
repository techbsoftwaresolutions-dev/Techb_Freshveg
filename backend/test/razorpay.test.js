// Razorpay online payments — run with `npm test` (node:test, no extra packages).
//
// Razorpay is never called: global fetch is wrapped so any request to
// api.razorpay.com is answered by a small in-memory gateway below, and
// everything else (the API under test on localhost) goes through untouched.

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const KEY_ID = "rzp_test_key123";
const KEY_SECRET = "test-secret-must-never-leak";
const WEBHOOK_SECRET = "webhook-secret-for-tests";
const RZP_VARS = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
const configure = () =>
  Object.assign(process.env, { RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET });
const unconfigure = () => RZP_VARS.forEach((key) => delete process.env[key]);

// ------------------------------------------------------------- gateway mock
const realFetch = global.fetch;
const gw = { orders: new Map(), payments: new Map(), calls: [], seq: 0 };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
global.fetch = async (url, init = {}) => {
  const href = String(url);
  if (!href.startsWith("https://api.razorpay.com/v1")) return realFetch(url, init);

  const path = href.slice("https://api.razorpay.com/v1".length);
  const method = init.method || "GET";
  const body = init.body ? JSON.parse(init.body) : null;
  gw.calls.push({ method, path, body, auth: init.headers?.Authorization });

  let m;
  if (method === "POST" && path === "/orders") {
    const order = { id: `order_T${++gw.seq}`, amount: body.amount, currency: body.currency, receipt: body.receipt };
    gw.orders.set(order.id, order);
    return json(order);
  }
  if (method === "GET" && (m = path.match(/^\/payments\/([^/]+)$/))) {
    const payment = gw.payments.get(m[1]);
    return payment ? json(payment) : json({ error: { description: "No such payment" } }, 400);
  }
  if (method === "POST" && (m = path.match(/^\/payments\/([^/]+)\/capture$/))) {
    const payment = gw.payments.get(m[1]);
    payment.status = "captured";
    return json(payment);
  }
  if (method === "POST" && (m = path.match(/^\/payments\/([^/]+)\/refund$/))) {
    return json({ id: `rfnd_${m[1]}`, amount: body.amount });
  }
  if (method === "GET" && (m = path.match(/^\/orders\/([^/]+)\/payments$/))) {
    return json({ items: [...gw.payments.values()].filter((p) => p.order_id === m[1]) });
  }
  return json({ error: { description: "unmocked" } }, 404);
};

// A payment as Razorpay would hold it, plus the signature its checkout hands back.
function pay(orderId, { amount, status = "captured" } = {}) {
  const id = `pay_T${++gw.seq}`;
  gw.payments.set(id, { id, order_id: orderId, amount: amount ?? gw.orders.get(orderId).amount, currency: "INR", status });
  const signature = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${id}`).digest("hex");
  return { providerPaymentId: id, signature, providerOrderId: orderId };
}

describe("Razorpay online payments", () => {
  let api;
  let Order;
  let Payment;
  let Settings;
  let Cart;
  let Inventory;
  let rules;
  let otherToken;

  const order = (id) => api.call("GET", `/orders/${id}`, { token: api.adminToken }).then((r) => r.order);
  const placeOnline = async () => (await api.placeOrder({ paymentMethod: "online" })).order;
  const initiate = (id, token = api.customerToken) => api.call("POST", `/payments/orders/${id}/initiate`, { token, body: {} });
  const confirm = (paymentId, body, token = api.customerToken) =>
    api.call("POST", `/payments/${paymentId}/confirm`, { token, body });
  const webhook = (payload, signature) => {
    const raw = JSON.stringify(payload);
    return realFetch(`${api.base}/payments/webhook/razorpay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": signature ?? crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex"),
      },
      body: raw,
    });
  };
  const capturedEvent = (paymentId) => ({
    event: "payment.captured",
    payload: { payment: { entity: gw.payments.get(paymentId) } },
  });
  const count = (o, status) => o.statusHistory.filter((h) => h.status === status).length;

  before(async () => {
    unconfigure();
    process.env.DISABLE_JOBS = "true";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Order = require("../src/modules/orders/order.model");
    Payment = require("../src/modules/payments/payment.model");
    Settings = require("../src/modules/settings/settings.model");
    Cart = require("../src/modules/cart/cart.model");
    Inventory = require("../src/modules/inventory/inventory.model");
    rules = require("../src/jobs/rules");

    const otp = await api.call("POST", "/auth/otp/request", { body: { phone: "9876500011" } });
    otherToken = (await api.call("POST", "/auth/otp/verify", { body: { phone: "9876500011", code: otp.devCode } })).accessToken;
  });

  after(async () => {
    await api?.stop();
    global.fetch = realFetch;
    unconfigure();
  });

  beforeEach(async () => {
    configure();
    gw.calls.length = 0;
    await Settings.updateOne({ key: "global" }, { $set: { "payment.onlineEnabled": true, "payment.provider": "razorpay" } });
  });

  describe("with no gateway keys", () => {
    beforeEach(unconfigure);

    it("does not offer online payment and refuses an online order before reserving stock", async () => {
      const { methods } = await api.call("GET", "/payments/methods?total=50000", { token: api.customerToken });
      assert.ok(!methods.some((m) => m.key === "online"));

      const reservedBefore = (await Inventory.find({})).reduce((sum, row) => sum + row.reserved, 0);
      const placed = await api.placeOrder({ paymentMethod: "online" });
      assert.equal(placed.status, 400);
      assert.match(placed.error.message, /not available/);
      const reservedAfter = (await Inventory.find({})).reduce((sum, row) => sum + row.reserved, 0);
      assert.equal(reservedAfter, reservedBefore);
      assert.equal(gw.calls.length, 0);
    });

    it("a customer cannot self-confirm a manually collected (UPI-to-store) payment", async () => {
      const { order: placed } = await api.placeOrder({ paymentMethod: "upi" });
      assert.equal(placed.status, "PAYMENT_PENDING");
      const payment = await Payment.findOne({ order: placed.id });
      const result = await confirm(payment.id, { providerPaymentId: "anything", signature: "anything" });
      assert.equal(result.status, 400);
      assert.equal((await order(placed.id)).payment.status, "pending");
    });
  });

  it("COD checkout is unchanged", async () => {
    const { order: placed } = await api.placeOrder();
    assert.equal(placed.status, "ORDER_CONFIRMED");
    assert.equal(gw.calls.length, 0);
  });

  it("offers online payment once configured", async () => {
    const { methods } = await api.call("GET", "/payments/methods?total=50000", { token: api.customerToken });
    const online = methods.find((m) => m.key === "online");
    assert.ok(online?.available);
  });

  it("creates one Razorpay order for the server's total and reuses it on retry; never leaks the secret", async () => {
    const placed = await placeOnline();
    assert.equal(placed.status, "PAYMENT_PENDING");
    assert.equal(placed.payment.method, "online");

    const first = await initiate(placed.id);
    const second = await initiate(placed.id);
    assert.equal(first.checkout.key, KEY_ID);
    assert.equal(first.checkout.amount, placed.pricing.total);
    assert.equal(first.checkout.currency, "INR");
    assert.match(first.checkout.order_id, /^order_T/);
    assert.equal(second.checkout.order_id, first.checkout.order_id);
    assert.equal(gw.calls.filter((c) => c.method === "POST" && c.path === "/orders").length, 1);
    assert.equal(gw.orders.get(first.checkout.order_id).amount, placed.pricing.total);
    assert.ok(!JSON.stringify([first, second]).includes(KEY_SECRET));

    assert.equal((await initiate(placed.id, otherToken)).status, 403);
  });

  it("verifies, captures an authorized payment, settles the order once, and is idempotent", async () => {
    const placed = await placeOnline();
    const { payment, checkout } = await initiate(placed.id);
    const proof = pay(checkout.order_id, { status: "authorized" });

    assert.equal((await confirm(payment.id, proof, otherToken)).status, 403, "another customer cannot confirm it");
    assert.equal((await confirm(payment.id, { ...proof, signature: "0".repeat(64) })).status, 400, "bad signature");
    assert.equal((await order(placed.id)).status, "PAYMENT_PENDING");

    const ok = await confirm(payment.id, proof);
    assert.equal(ok.status, 200);
    assert.equal(ok.paid, true);
    assert.ok(gw.calls.some((c) => c.path === `/payments/${proof.providerPaymentId}/capture`), "captured server side");

    const again = await confirm(payment.id, proof);
    assert.equal(again.paid, true);
    await webhook(capturedEvent(proof.providerPaymentId)); // the webhook arriving afterwards changes nothing

    const settled = await order(placed.id);
    assert.equal(settled.status, "ORDER_CONFIRMED");
    assert.equal(settled.payment.status, "paid");
    assert.equal(settled.payment.amountPaid, placed.pricing.total);
    assert.equal(settled.payment.transactionId, proof.providerPaymentId);
    assert.equal(count(settled, "PAYMENT_CONFIRMED"), 1);
    assert.equal(count(settled, "ORDER_CONFIRMED"), 1);
  });

  it("rejects a payment for a different amount or a different gateway order", async () => {
    const placed = await placeOnline();
    const { payment, checkout } = await initiate(placed.id);

    const cheap = pay(checkout.order_id, { amount: 100 });
    assert.equal((await confirm(payment.id, cheap)).status, 400);

    const otherOrder = "order_elsewhere";
    gw.orders.set(otherOrder, { id: otherOrder, amount: placed.pricing.total });
    const elsewhere = pay(otherOrder);
    assert.equal((await confirm(payment.id, elsewhere)).status, 400);

    const current = await order(placed.id);
    assert.equal(current.status, "PAYMENT_PENDING");
    assert.notEqual(current.payment.status, "paid");
  });

  it("an uncaptured payment is reported pending, not paid", async () => {
    const placed = await placeOnline();
    const { payment, checkout } = await initiate(placed.id);
    const proof = pay(checkout.order_id, { status: "created" });
    const result = await confirm(payment.id, proof);
    assert.equal(result.status, 202);
    assert.equal(result.paid, false);
    assert.equal((await order(placed.id)).status, "PAYMENT_PENDING");
  });

  it("webhook: refuses bad signatures, settles on capture, ignores redelivery", async () => {
    const placed = await placeOnline();
    const { checkout } = await initiate(placed.id);
    const { providerPaymentId } = pay(checkout.order_id);

    assert.equal((await webhook(capturedEvent(providerPaymentId), "deadbeef")).status, 400);
    assert.equal((await order(placed.id)).status, "PAYMENT_PENDING");

    assert.equal((await webhook(capturedEvent(providerPaymentId))).status, 200);
    assert.equal((await webhook(capturedEvent(providerPaymentId))).status, 200);
    const settled = await order(placed.id);
    assert.equal(settled.status, "ORDER_CONFIRMED");
    assert.equal(count(settled, "PAYMENT_CONFIRMED"), 1);
  });

  it("cancelling an unpaid order releases stock and gives the cart back; a late payment is refunded", async () => {
    const placed = await placeOnline();
    const { payment, checkout } = await initiate(placed.id);
    const line = placed.items[0];
    const reservedWhilePending = (await Inventory.findOne({ variant: line.variant })).reserved;

    const cancelled = await api.call("POST", `/orders/${placed.id}/cancel`, { token: api.customerToken, body: {} });
    assert.equal(cancelled.order.status, "CANCELLED");
    assert.equal((await Inventory.findOne({ variant: line.variant })).reserved, reservedWhilePending - line.quantity);
    assert.equal((await Cart.findOne({ customer: placed.customer, status: "active" }))?.items.length > 0, true);

    const late = pay(checkout.order_id);
    const result = await confirm(payment.id, late);
    assert.equal(result.status, 409);
    assert.ok(gw.calls.some((c) => c.path === `/payments/${late.providerPaymentId}/refund`), "refunded at the gateway");
    const after = await order(placed.id);
    assert.equal(after.status, "CANCELLED");
    assert.notEqual(after.payment.status, "paid");

    await Cart.deleteMany({ customer: placed.customer, status: "active" }); // leave the next test a clean cart
  });

  it("the sweep applies a payment whose confirmation was lost, and releases one that was never paid", async () => {
    const paidLater = await placeOnline();
    const { checkout } = await initiate(paidLater.id);
    pay(checkout.order_id);
    const abandoned = await placeOnline();

    const old = new Date(Date.now() - 31 * 60000);
    await Order.updateMany({ _id: { $in: [paidLater.id, abandoned.id] } }, { $set: { placedAt: old } });
    const result = await rules.expireUnpaidOrders();
    assert.deepEqual(result, { paid: 1, cancelled: 1 });

    assert.equal((await order(paidLater.id)).status, "ORDER_CONFIRMED");
    assert.equal((await order(abandoned.id)).status, "CANCELLED");

    // A manual UPI order waiting on the store is never swept.
    const upi = (await api.placeOrder({ paymentMethod: "upi" })).order;
    await Order.updateOne({ _id: upi.id }, { $set: { placedAt: old } });
    await rules.expireUnpaidOrders();
    assert.equal((await order(upi.id)).status, "PAYMENT_PENDING");
  });
});
