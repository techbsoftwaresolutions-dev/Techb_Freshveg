// WhatsApp order updates — run with `npm test` (node:test, no extra packages).
//
// The Meta API is never called: global fetch is wrapped so any request to
// graph.facebook.com is answered by the test, and everything else (the API
// under test on localhost) goes through untouched. The integration half runs
// the real HTTP API on a throwaway in-memory MongoDB, as the smoke test does.

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const WHATSAPP_VARS = [
  "WHATSAPP_ENABLED", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_API_VERSION", "WHATSAPP_TEMPLATE_ORDER_CONFIRMED", "WHATSAPP_TEMPLATE_ORDER_PACKED",
  "WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY", "WHATSAPP_TEMPLATE_ORDER_DELIVERED", "WHATSAPP_TEMPLATE_ORDER_CANCELLED",
  "WHATSAPP_TEMPLATE_LANGUAGE", "WHATSAPP_APP_SECRET", "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "FRONTEND_URL",
];
const TOKEN = "EAAtest-SECRET-token-must-never-leak";
const clearWhatsApp = () => WHATSAPP_VARS.forEach((key) => delete process.env[key]);
function configureWhatsApp(extra = {}) {
  Object.assign(process.env, {
    WHATSAPP_ENABLED: "true",
    WHATSAPP_ACCESS_TOKEN: TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: "1234567890",
    WHATSAPP_API_VERSION: "v99.0",
    WHATSAPP_TEMPLATE_ORDER_CONFIRMED: "fb_order_confirmed",
    WHATSAPP_TEMPLATE_ORDER_PACKED: "fb_order_packed",
    WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY: "fb_out_for_delivery",
    WHATSAPP_TEMPLATE_ORDER_DELIVERED: "fb_order_delivered",
    FRONTEND_URL: "https://shop.example",
    WHATSAPP_APP_SECRET: "app-secret-for-tests",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-me",
    ...extra,
  });
}

// ------------------------------------------------------------- Meta mock
const realFetch = global.fetch;
const metaCalls = [];
let metaReply = () => ({ status: 200, body: { messages: [{ id: `wamid.${crypto.randomUUID()}` }] } });
global.fetch = async (url, init = {}) => {
  if (String(url).startsWith("https://graph.facebook.com/")) {
    const call = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
    metaCalls.push(call);
    const reply = await metaReply(call);
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(url, init);
};
const ok = () => ({ status: 200, body: { messages: [{ id: `wamid.${crypto.randomUUID()}` }] } });

clearWhatsApp();
const whatsapp = require("../src/modules/notifications/whatsapp");

// ------------------------------------------------------------- unit
describe("WhatsApp client (no database)", () => {
  beforeEach(() => {
    clearWhatsApp();
    metaCalls.length = 0;
    metaReply = ok;
  });

  it("is disabled by default and lists what is missing, by name only", () => {
    const cfg = whatsapp.settings();
    assert.equal(cfg.enabled, false);
    assert.deepEqual(cfg.missing, ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_API_VERSION", "FRONTEND_URL"]);
  });

  it("only WHATSAPP_ENABLED=true turns it on", () => {
    for (const value of ["1", "yes", "false", ""]) {
      process.env.WHATSAPP_ENABLED = value;
      assert.equal(whatsapp.settings().enabled, false, value);
    }
    process.env.WHATSAPP_ENABLED = " TRUE ";
    assert.equal(whatsapp.settings().enabled, true);
  });

  it("turns account numbers into WhatsApp numbers, and refuses junk", () => {
    assert.equal(whatsapp.toWhatsAppNumber("9876543210"), "919876543210");
    assert.equal(whatsapp.toWhatsAppNumber("+91 98765 43210"), "919876543210");
    assert.equal(whatsapp.toWhatsAppNumber("09876543210"), "919876543210");
    assert.equal(whatsapp.toWhatsAppNumber(""), null);
    assert.equal(whatsapp.toWhatsAppNumber(null), null);
    assert.equal(whatsapp.toWhatsAppNumber("12345"), null);
    assert.equal(whatsapp.maskNumber("919876543210"), "91******3210");
  });

  it("does not call Meta when credentials are missing", async () => {
    const result = await whatsapp.sendTemplate({ to: "919876543210", template: "x" });
    assert.equal(result.ok, false);
    assert.equal(result.configError, true);
    assert.equal(metaCalls.length, 0);
  });

  it("sends an approved template with body parameters", async () => {
    configureWhatsApp();
    const result = await whatsapp.sendTemplate({ to: "919876543210", template: "fb_order_confirmed", params: ["Asha", "FB1001"] });
    assert.equal(result.ok, true);
    assert.match(result.messageId, /^wamid\./);
    const [call] = metaCalls;
    assert.equal(call.url, "https://graph.facebook.com/v99.0/1234567890/messages");
    assert.equal(call.headers.Authorization, `Bearer ${TOKEN}`);
    assert.deepEqual(call.body.template, {
      name: "fb_order_confirmed",
      language: { code: "en" },
      components: [{ type: "body", parameters: [{ type: "text", text: "Asha" }, { type: "text", text: "FB1001" }] }],
    });
  });

  it("an invalid token is a configuration error, not retried, and never echoes the token", async () => {
    configureWhatsApp();
    metaReply = () => ({ status: 401, body: { error: { code: 190, message: "Invalid OAuth access token." } } });
    const result = await whatsapp.sendTemplate({ to: "919876543210", template: "t" });
    assert.deepEqual([result.ok, result.retryable, result.configError, result.code], [false, false, true, 190]);
    assert.ok(!JSON.stringify(result).includes(TOKEN));
  });

  it("server errors and rate limits are retryable", async () => {
    configureWhatsApp();
    metaReply = () => ({ status: 500, body: { error: { code: 1, message: "Internal" } } });
    assert.equal((await whatsapp.sendTemplate({ to: "919876543210", template: "t" })).retryable, true);
    metaReply = () => ({ status: 429, body: { error: { code: 130429, message: "Rate limit hit" } } });
    assert.equal((await whatsapp.sendTemplate({ to: "919876543210", template: "t" })).retryable, true);
  });

  it("an unknown template or bad number fails without retrying", async () => {
    configureWhatsApp();
    metaReply = () => ({ status: 404, body: { error: { code: 132001, message: "Template name does not exist" } } });
    const result = await whatsapp.sendTemplate({ to: "919876543210", template: "nope" });
    assert.deepEqual([result.ok, result.retryable], [false, false]);
    assert.match(result.error, /does not exist/);
  });

  it("timeouts and network failures are retryable and do not throw", async () => {
    configureWhatsApp();
    metaReply = () => Object.assign(new Error("timed out"), { name: "TimeoutError" });
    let result = await whatsapp.sendTemplate({ to: "919876543210", template: "t" });
    assert.deepEqual([result.ok, result.retryable], [false, true]);
    assert.match(result.error, /No reply/);
    metaReply = () => new TypeError("fetch failed");
    result = await whatsapp.sendTemplate({ to: "919876543210", template: "t" });
    assert.deepEqual([result.ok, result.retryable], [false, true]);
  });

  it("verifies Meta's webhook signature over the raw body", () => {
    const raw = Buffer.from('{"entry":[]}');
    const good = `sha256=${crypto.createHmac("sha256", "s3cret").update(raw).digest("hex")}`;
    assert.equal(whatsapp.verifySignature(raw, good, "s3cret"), true);
    assert.equal(whatsapp.verifySignature(raw, good, "other-secret"), false);
    assert.equal(whatsapp.verifySignature(Buffer.from('{"entry":[1]}'), good, "s3cret"), false);
    assert.equal(whatsapp.verifySignature(raw, "sha256=abc", "s3cret"), false);
    assert.equal(whatsapp.verifySignature(raw, undefined, "s3cret"), false);
    assert.equal(whatsapp.verifySignature(raw, good, ""), false, "no app secret: refuse everything");
  });
});

// ------------------------------------------------------------- integration
describe("WhatsApp order updates through the real API", () => {
  let api;
  let base;
  let call;
  let WhatsAppMessage;
  let Settings;
  let User;
  let whatsappService;
  let adminToken;
  let customerToken;

  // The send is fire-and-forget from the order flow; wait for it to land.
  const settle = async (filter, predicate = (rows) => rows.length > 0) => {
    for (let i = 0; i < 100; i++) {
      const rows = await WhatsAppMessage.find(filter).lean();
      if (predicate(rows)) return rows;
      await new Promise((r) => setTimeout(r, 30));
    }
    return WhatsAppMessage.find(filter).lean();
  };
  const idle = () => new Promise((r) => setTimeout(r, 300));

  async function placeOrder() {
    const placed = await api.placeOrder();
    assert.equal(placed.success, true, JSON.stringify(placed.error));
    return placed.order;
  }
  const cancelAsCustomer = async (orderId) => {
    const res = await call("POST", `/orders/${orderId}/cancel`, { token: customerToken, body: { reason: "Changed my mind" } });
    assert.equal(res.success, true, JSON.stringify(res.error));
  };
  const move = async (orderId, status, token = adminToken) => {
    const step = await call("POST", `/orders/${orderId}/status`, { token, body: { status } });
    assert.equal(step.success, true, `${status}: ${JSON.stringify(step.error)}`);
    return step.order;
  };

  before(async () => {
    clearWhatsApp();
    api = await require("./helpers").startTestApi();
    ({ base, call, adminToken, customerToken } = api);
    WhatsAppMessage = require("../src/modules/notifications/whatsappMessage.model");
    Settings = require("../src/modules/settings/settings.model");
    User = require("../src/modules/auth/user.model");
    whatsappService = require("../src/modules/notifications/whatsapp.service");
  });

  after(async () => {
    await api?.stop();
    global.fetch = realFetch;
  });

  beforeEach(async () => {
    clearWhatsApp();
    metaCalls.length = 0;
    metaReply = ok;
    await Settings.updateOne({ key: "global" }, { $set: { "notifications.channels.whatsapp": true } });
    await User.updateOne({ phone: "9876543210", role: "customer" }, { $set: { "notificationPrefs.whatsapp": true, "notificationPrefs.orders": true } });
  });

  it("the API starts and answers with no WhatsApp credentials at all", async () => {
    const health = await fetch(base.replace(/\/api\/v1$/, "/api/health")).then((r) => r.json());
    assert.equal(health.success, true);
  });

  it("disabled by default: orders are created and nothing is sent or logged", async () => {
    const order = await placeOrder();
    assert.equal(order.status, "ORDER_CONFIRMED");
    await idle();
    assert.equal(await WhatsAppMessage.countDocuments({ order: order.id }), 0);
    assert.equal(metaCalls.length, 0);
  });

  it("enabled but credentials missing: orders still work, nothing is sent, one safe warning", async () => {
    process.env.WHATSAPP_ENABLED = "true";
    process.env.WHATSAPP_TEMPLATE_ORDER_CONFIRMED = "fb_order_confirmed";
    const errors = [];
    const original = console.error;
    console.error = (...args) => errors.push(args.join(" "));
    try {
      const order = await placeOrder();
      assert.equal(order.status, "ORDER_CONFIRMED");
      await idle();
      assert.equal(metaCalls.length, 0);
      assert.ok(errors.some((line) => line.includes("WHATSAPP_ACCESS_TOKEN")), errors.join("\n"));
    } finally {
      console.error = original;
    }
  });

  it("sends each stage's template once, with the right parameters, through a whole order", async () => {
    configureWhatsApp();
    const order = await placeOrder();

    const [confirmed] = await settle({ order: order.id, event: "order_confirmed", status: "sent" });
    assert.equal(confirmed.template, "fb_order_confirmed");
    assert.equal(confirmed.toMasked, "91******3210");
    assert.ok(confirmed.messageId);
    const confirmCall = metaCalls.find((c) => c.body.template.name === "fb_order_confirmed");
    const params = confirmCall.body.template.components[0].parameters.map((p) => p.text);
    assert.equal(confirmCall.body.to, "919876543210");
    assert.equal(params[1], order.code);
    assert.match(params[2], /^₹\d+$/);
    assert.equal(params[3], `https://shop.example/orders/${order.id}`);

    // Statuses with no WhatsApp message send nothing.
    for (const status of ["ORDER_ACCEPTED", "PICKING", "PACKING"]) await move(order.id, status);
    await idle();
    assert.equal(metaCalls.length, 1);

    await move(order.id, "READY_FOR_PICKUP");
    await settle({ order: order.id, event: "order_packed", status: "sent" });

    // Assign, unassign (back to READY_FOR_PICKUP), assign again: "packed" must not go twice.
    const partner = await User.findOne({ role: "delivery_partner", status: "active" });
    const assign = () => call("POST", `/orders/${order.id}/assign`, { token: adminToken, body: { partner: partner.id } });
    assert.equal((await assign()).success, true);
    await move(order.id, "READY_FOR_PICKUP");
    assert.equal((await assign()).success, true);

    await move(order.id, "PICKED_UP");
    await move(order.id, "OUT_FOR_DELIVERY");
    await settle({ order: order.id, event: "out_for_delivery", status: "sent" });
    await move(order.id, "DELIVERED");
    await settle({ order: order.id, event: "order_delivered", status: "sent" });
    await idle();

    const rows = await WhatsAppMessage.find({ order: order.id }).lean();
    assert.deepEqual(
      rows.map((r) => `${r.event}:${r.template}`).sort(),
      ["order_confirmed:fb_order_confirmed", "order_delivered:fb_order_delivered", "order_packed:fb_order_packed", "out_for_delivery:fb_out_for_delivery"]
    );
    const sentTemplates = metaCalls.map((c) => c.body.template.name);
    assert.equal(sentTemplates.filter((t) => t === "fb_order_packed").length, 1, sentTemplates.join());
    assert.equal(sentTemplates.length, 4);

    // Saving the same status again directly is a no-op too.
    const Order = require("../src/modules/orders/order.model");
    const result = await whatsappService.enqueueForStatus(await Order.findById(order.id), "DELIVERED");
    assert.match(result.skipped, /already sent/);
    assert.equal(metaCalls.length, 4);
  });

  it("a cancellation is sent only when its template is configured", async () => {
    configureWhatsApp(); // no WHATSAPP_TEMPLATE_ORDER_CANCELLED
    let order = await placeOrder();
    await settle({ order: order.id, event: "order_confirmed", status: "sent" });
    await cancelAsCustomer(order.id);
    await idle();
    assert.equal(await WhatsAppMessage.countDocuments({ order: order.id, event: "order_cancelled" }), 0);

    process.env.WHATSAPP_TEMPLATE_ORDER_CANCELLED = "fb_order_cancelled";
    order = await placeOrder();
    await cancelAsCustomer(order.id);
    const [row] = await settle({ order: order.id, event: "order_cancelled", status: "sent" });
    assert.equal(row.template, "fb_order_cancelled");
  });

  it("a failing Meta API never fails the order; the message retries and is bounded", async () => {
    configureWhatsApp();
    metaReply = () => ({ status: 503, body: { error: { code: 2, message: "Service temporarily unavailable" } } });
    const order = await placeOrder();
    assert.equal(order.status, "ORDER_CONFIRMED", "the order is confirmed regardless");
    let [row] = await settle({ order: order.id }, (rows) => rows[0]?.attempts === 1);
    assert.equal(row.status, "pending");
    assert.ok(new Date(row.nextAttemptAt) > new Date(), "the retry waits");

    // Meta recovers: the next sweep (once due) sends it.
    metaReply = ok;
    await WhatsAppMessage.updateOne({ _id: row._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
    await whatsappService.retryDue();
    row = await WhatsAppMessage.findById(row._id).lean();
    assert.deepEqual([row.status, row.attempts], ["sent", 2]);

    // Meta stays down: five attempts, then failed — and nothing more.
    metaReply = () => ({ status: 500, body: { error: { code: 1, message: "Internal" } } });
    const second = await placeOrder();
    for (let i = 0; i < 8; i++) {
      await settle({ order: second.id }, (rows) => rows[0] && rows[0].lockedUntil === null);
      await WhatsAppMessage.updateOne({ order: second.id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
      await whatsappService.retryDue();
    }
    const [failed] = await WhatsAppMessage.find({ order: second.id }).lean();
    assert.deepEqual([failed.status, failed.attempts], ["failed", whatsappService.MAX_ATTEMPTS]);
    assert.equal(failed.lastError.message, "Internal");
  });

  it("an invalid access token fails once, logs a safe actionable error, and keeps the order", async () => {
    configureWhatsApp();
    metaReply = () => ({ status: 401, body: { error: { code: 190, message: "Error validating access token: Session has expired." } } });
    const errors = [];
    const original = console.error;
    console.error = (...args) => errors.push(args.join(" "));
    try {
      const order = await placeOrder();
      const [row] = await settle({ order: order.id, status: "failed" });
      assert.equal(row.attempts, 1);
      assert.equal(row.lastError.code, 190);
      assert.ok(errors.some((line) => line.includes("Meta rejected the configuration")));
      assert.ok(!errors.join("\n").includes(TOKEN), "the token never reaches a log");
      assert.ok(!JSON.stringify(row).includes(TOKEN));
    } finally {
      console.error = original;
    }
  });

  it("a timeout is retried rather than failed", async () => {
    configureWhatsApp();
    metaReply = () => Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const order = await placeOrder();
    const [row] = await settle({ order: order.id }, (rows) => rows[0]?.attempts === 1);
    assert.equal(row.status, "pending");
    assert.match(row.lastError.message, /No reply/);
  });

  it("respects the customer's opt-out and a missing phone number", async () => {
    configureWhatsApp();
    await User.updateOne({ phone: "9876543210", role: "customer" }, { $set: { "notificationPrefs.whatsapp": false } });
    let order = await placeOrder();
    let [row] = await settle({ order: order.id, status: "skipped" });
    assert.match(row.reason, /turned off WhatsApp/);

    await User.updateOne({ phone: "9876543210", role: "customer" }, { $set: { "notificationPrefs.whatsapp": true } });
    order = await placeOrder();
    await settle({ order: order.id, status: "sent" });
    // A number that cannot be messaged (set past validation, as legacy data can be).
    const customer = await User.findOne({ phone: "9876543210", role: "customer" });
    await User.collection.updateOne({ _id: customer._id }, { $set: { phone: "123" } });
    try {
      await move(order.id, "ORDER_ACCEPTED");
      await move(order.id, "PICKING");
      await move(order.id, "PACKING");
      await move(order.id, "READY_FOR_PICKUP");
      [row] = await settle({ order: order.id, event: "order_packed", status: "skipped" });
      assert.match(row.reason, /no valid phone/);
    } finally {
      await User.collection.updateOne({ _id: customer._id }, { $set: { phone: "9876543210" } });
    }
    assert.equal(metaCalls.filter((c) => c.body.template.name === "fb_order_packed").length, 0);
  });

  it("the admin's WhatsApp channel switch still applies", async () => {
    configureWhatsApp();
    await Settings.updateOne({ key: "global" }, { $set: { "notifications.channels.whatsapp": false } });
    const order = await placeOrder();
    await idle();
    assert.equal(await WhatsAppMessage.countDocuments({ order: order.id }), 0);
    assert.equal(metaCalls.length, 0);
  });

  describe("webhook", () => {
    const sign = (raw) => `sha256=${crypto.createHmac("sha256", "app-secret-for-tests").update(raw).digest("hex")}`;
    const post = (payload, signature) => {
      const raw = JSON.stringify(payload);
      return fetch(`${base}/webhooks/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(signature !== null ? { "X-Hub-Signature-256": signature ?? sign(raw) } : {}) },
        body: raw,
      });
    };
    const receipt = (id, status, extra = {}) => ({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { statuses: [{ id, status, timestamp: String(Math.floor(Date.now() / 1000)), ...extra }] } }] }],
    });

    it("answers Meta's verification handshake only with the right token", async () => {
      configureWhatsApp();
      const good = await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345`);
      assert.equal(good.status, 200);
      assert.equal(await good.text(), "12345");
      const bad = await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`);
      assert.equal(bad.status, 403);
      clearWhatsApp();
      const unset = await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=&hub.challenge=1`);
      assert.equal(unset.status, 403, "no verify token configured: refuse");
    });

    it("refuses unsigned and wrongly signed receipts", async () => {
      configureWhatsApp();
      assert.equal((await post(receipt("wamid.x", "delivered"), null)).status, 401);
      assert.equal((await post(receipt("wamid.x", "delivered"), "sha256=deadbeef")).status, 401);
      const raw = JSON.stringify(receipt("wamid.x", "delivered"));
      const forged = `sha256=${crypto.createHmac("sha256", "not-the-secret").update(raw).digest("hex")}`;
      assert.equal((await post(receipt("wamid.x", "delivered"), forged)).status, 401);
    });

    it("applies receipts forward-only and idempotently", async () => {
      configureWhatsApp();
      const order = await placeOrder();
      const [row] = await settle({ order: order.id, status: "sent" });

      let res = await post(receipt(row.messageId, "delivered"));
      assert.equal(res.status, 200);
      assert.equal((await WhatsAppMessage.findById(row._id)).status, "delivered");
      // The same receipt again changes nothing.
      res = await post(receipt(row.messageId, "delivered"));
      assert.equal((await res.json()).updated, 0);
      await post(receipt(row.messageId, "read"));
      // A late "sent" or "failed" never undoes a read message.
      await post(receipt(row.messageId, "sent"));
      await post(receipt(row.messageId, "failed", { errors: [{ code: 131026, title: "Message undeliverable" }] }));
      const final = await WhatsAppMessage.findById(row._id).lean();
      assert.equal(final.status, "read");
      assert.ok(final.deliveredAt && final.readAt);
      // A receipt for a message that is not ours is acknowledged and ignored.
      assert.equal((await post(receipt("wamid.someone-else", "delivered"))).status, 200);
    });

    it("records a failure receipt for a sent message", async () => {
      configureWhatsApp();
      const order = await placeOrder();
      const [row] = await settle({ order: order.id, status: "sent" });
      await post(receipt(row.messageId, "failed", { errors: [{ code: 131026, title: "Message undeliverable" }] }));
      const final = await WhatsAppMessage.findById(row._id).lean();
      assert.equal(final.status, "failed");
      assert.equal(final.lastError.code, 131026);
    });
  });
});
