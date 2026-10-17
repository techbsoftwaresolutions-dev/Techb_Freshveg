const WhatsAppMessage = require("./whatsappMessage.model");
const whatsapp = require("./whatsapp");
const Settings = require("../settings/settings.model");
const User = require("../auth/user.model");

// WhatsApp order updates: which order statuses send which approved template,
// a small database-backed queue with bounded retries, and Meta's delivery
// receipts. Called from orderService.transition() only after the new status
// has been saved — and never awaited there, so WhatsApp being slow, down or
// unconfigured cannot delay or undo an order.

// Order status (orders/orderStatus.js) -> WhatsApp event. "Packed" is
// READY_FOR_PICKUP — packing finished — not PACKING, which is still under way.
// A store rejection reads to the customer as a cancellation.
const EVENT_FOR_STATUS = {
  ORDER_CONFIRMED: "order_confirmed",
  READY_FOR_PICKUP: "order_packed",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "order_delivered",
  CANCELLED: "order_cancelled",
  REJECTED: "order_cancelled",
};

const MAX_ATTEMPTS = 5;
// Wait before attempt 2, 3, 4, 5. Five tries over roughly an hour and a half,
// then the row is marked failed — a stale "your order is packed" is noise.
const BACKOFF_MINUTES = [1, 5, 15, 60];
const LOCK_MS = 2 * 60 * 1000;

// Models are compiled with autoIndex: false (core/schemaBase.js), but the
// unique (order, event) index *is* the no-duplicates guarantee, so it must
// exist before the first message is written — not only after someone runs
// `npm run sync-indexes`. Building an index that already exists is a no-op.
let indexesReady = null;
const ensureIndexes = () => {
  indexesReady = indexesReady || WhatsAppMessage.createIndexes().catch((err) => {
    indexesReady = null;
    throw err;
  });
  return indexesReady;
};

let warnedConfig = "";
// One clear, value-free line per distinct configuration problem, not one per order.
function warnConfig(message) {
  if (warnedConfig === message) return;
  warnedConfig = message;
  console.error(`[whatsapp] ${message} — order updates are not being sent (see docs/WHATSAPP.md)`);
}

/**
 * Queues the WhatsApp message for an order that has just moved to `status`,
 * then tries to send it. Returns what happened, for tests and logs; never
 * throws.
 */
async function enqueueForStatus(order, status) {
  try {
    const event = EVENT_FOR_STATUS[status];
    if (!event) return { skipped: "no WhatsApp message for this status" };

    const cfg = whatsapp.settings();
    if (!cfg.enabled) return { skipped: "WHATSAPP_ENABLED is not true" };
    const template = cfg.templates[event];
    if (!template) return { skipped: `no template configured for ${event}` };
    if (cfg.missing.length) {
      warnConfig(`WHATSAPP_ENABLED is true but ${cfg.missing.join(", ")} ${cfg.missing.length === 1 ? "is" : "are"} empty`);
      return { skipped: "WhatsApp is not fully configured" };
    }

    // The admin's channel switch (Settings → Notifications) still applies.
    const store = await Settings.load();
    if (!store.notifications?.channels?.whatsapp) return { skipped: "WhatsApp is turned off in Settings → Notifications" };

    await ensureIndexes();
    let row;
    try {
      row = await WhatsAppMessage.create({
        order: order._id,
        orderCode: order.code,
        customer: order.customer,
        event,
        template,
      });
    } catch (err) {
      // The unique (order, event) index: this order already had this message.
      if (err?.code === 11000) return { skipped: "already sent for this order" };
      throw err;
    }

    return await deliver(row._id, { order });
  } catch (err) {
    console.warn("[whatsapp] could not queue an order update:", err.message);
    return { error: err.message };
  }
}

// The template body's parameters, in order — {{1}}, {{2}}, … — as documented
// for each template in docs/WHATSAPP.md. Meta rejects an empty parameter, so
// every value has a fallback.
function paramsFor(event, order, customer, cfg) {
  const name = (customer.name || "").trim().split(/\s+/)[0] || "there";
  const code = order.code || "";
  // The customer's existing order page (website/app/orders/[id]); it asks
  // them to sign in, so the link alone shows nothing to anyone else.
  const link = `${cfg.frontendUrl}/orders/${order._id}`;
  const total = `₹${Math.round((order.pricing?.total || 0) / 100)}`;
  const eta = order.delivery?.expectedBy
    ? new Date(order.delivery.expectedBy).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "shortly";

  switch (event) {
    case "order_confirmed":
      return [name, code, total, link];
    case "order_packed":
      return [name, code, link];
    case "out_for_delivery":
      return [name, code, eta, link];
    case "order_delivered":
    case "order_cancelled":
    default:
      return [name, code];
  }
}

/**
 * Makes one attempt at one queued message. Claims it first, so a retry sweep
 * and a first attempt can never both send it.
 */
async function deliver(id, { order: knownOrder } = {}) {
  const now = new Date();
  const row = await WhatsAppMessage.findOneAndUpdate(
    {
      _id: id,
      status: "pending",
      nextAttemptAt: { $lte: now },
      $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
    },
    { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!row) return { skipped: "not due, or being sent elsewhere" };

  const finish = async (fields) => {
    Object.assign(row, { lockedUntil: null }, fields);
    await row.save();
    return { status: row.status, messageId: row.messageId, reason: row.reason, error: row.lastError?.message };
  };

  const cfg = whatsapp.settings();
  const Order = require("../orders/order.model"); // required here: orders requires this module
  const [order, customer] = await Promise.all([
    knownOrder || Order.findById(row.order),
    User.findById(row.customer).select("name phone notificationPrefs"),
  ]);
  if (!order || !customer) return finish({ status: "skipped", reason: "order or customer no longer exists" });

  // The customer's own switches (the same ones the app and website offer).
  const prefs = customer.notificationPrefs || {};
  if (prefs.orders === false) return finish({ status: "skipped", reason: "customer turned off order updates" });
  if (prefs.whatsapp === false) return finish({ status: "skipped", reason: "customer turned off WhatsApp" });

  const to = whatsapp.toWhatsAppNumber(customer.phone, cfg.countryCode);
  if (!to) return finish({ status: "skipped", reason: "no valid phone number on the account" });

  const result = await whatsapp.sendTemplate(
    { to, template: row.template, params: paramsFor(row.event, order, customer, cfg) },
    cfg
  );
  row.toMasked = whatsapp.maskNumber(to);

  if (result.ok) {
    return finish({ status: "sent", messageId: result.messageId, sentAt: new Date(), lastError: undefined });
  }

  if (result.configError) warnConfig(`Meta rejected the configuration: ${result.error}`);
  const lastError = { code: result.code, message: result.error };
  if (result.retryable && row.attempts < MAX_ATTEMPTS) {
    const waitMinutes = BACKOFF_MINUTES[row.attempts - 1] ?? BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1];
    return finish({ status: "pending", lastError, nextAttemptAt: new Date(Date.now() + waitMinutes * 60000) });
  }
  return finish({ status: "failed", lastError, failedAt: new Date() });
}

/**
 * The scheduler's sweep: every queued message that is due, including first
 * attempts that never ran (the process restarted mid-send). Bounded per run.
 */
async function retryDue(now = new Date()) {
  const due = await WhatsAppMessage.find({ status: "pending", nextAttemptAt: { $lte: now } })
    .sort({ nextAttemptAt: 1 })
    .limit(50)
    .select("_id");
  let sent = 0;
  let failed = 0;
  for (const { _id } of due) {
    const result = await deliver(_id);
    if (result.status === "sent") sent += 1;
    if (result.status === "failed") failed += 1;
  }
  return { due: due.length, sent, failed };
}

// Meta's receipts arrive in any order and may repeat; a status only moves
// forward (sent -> delivered -> read). "failed" can follow "sent" but never
// undoes a delivery the customer has already received.
const RANK = { pending: 0, sent: 1, delivered: 2, read: 3 };

async function applyStatusCallback({ id, status, timestamp, errors }) {
  if (!id || !["sent", "delivered", "read", "failed"].includes(status)) return { ignored: true };
  const row = await WhatsAppMessage.findOne({ messageId: String(id) });
  if (!row) return { ignored: true }; // not one of ours, or from another system

  const at = timestamp ? new Date(Number(timestamp) * 1000) : new Date();
  if (status === "failed") {
    if (RANK[row.status] >= RANK.delivered || row.status === "failed") return { unchanged: true };
    row.status = "failed";
    row.failedAt = at;
    const error = errors?.[0];
    row.lastError = { code: error?.code, message: String(error?.title || error?.message || "Meta reported the message as failed").slice(0, 300) };
  } else {
    if ((RANK[status] ?? 0) <= (RANK[row.status] ?? -1) || row.status === "failed") return { unchanged: true };
    row.status = status;
    if (status === "delivered") row.deliveredAt = at;
    if (status === "read") {
      row.readAt = at;
      row.deliveredAt = row.deliveredAt || at;
    }
  }
  await row.save();
  return { updated: row.status };
}

module.exports = { enqueueForStatus, deliver, retryDue, applyStatusCallback, EVENT_FOR_STATUS, MAX_ATTEMPTS };
