// Channel adapters. Each one is a function that takes a rendered message and
// tries to deliver it.
//
// None of them are wired to a real provider yet — there is no Firebase project
// and no SMS account. Rather than pretend, each logs what it would have sent
// and reports "skipped" with a reason, so the notification log tells the truth
// and the rest of the engine can be exercised end to end.

const config = require("../../config");

const stub = (name, envVar) => async (message, recipient) => {
  if (!process.env[envVar]) {
    return {
      status: "skipped",
      reason: `${name} is not configured (set ${envVar})`,
    };
  }
  // A real adapter goes here. Reaching this branch without one is a
  // configuration mistake worth surfacing loudly rather than silently passing.
  return { status: "failed", error: `${name} adapter is not implemented yet` };
};

const push = async (message, recipient) => {
  const tokens = (recipient.devices || []).filter((d) => d.token).map((d) => d.token);
  if (!tokens.length) return { status: "skipped", reason: "No device registered" };
  if (!process.env.FCM_SERVER_KEY) {
    if (!config.isProd) console.log(`[push] → ${recipient.phone}: ${message.title} — ${message.body}`);
    return { status: "skipped", reason: "Push is not configured (set FCM_SERVER_KEY)" };
  }
  return { status: "failed", error: "FCM adapter is not implemented yet" };
};

const sms = async (message, recipient) => {
  if (!process.env.SMS_API_KEY) {
    if (!config.isProd) console.log(`[sms] → ${recipient.phone}: ${message.body}`);
    return { status: "skipped", reason: "SMS is not configured (set SMS_API_KEY)" };
  }
  return { status: "failed", error: "SMS adapter is not implemented yet" };
};

// WhatsApp, through Meta's WhatsApp Business Cloud API.
//
// A business may only start a chat with a template message Meta has approved,
// so each event that goes out on WhatsApp names its template in .env, e.g.
//   WHATSAPP_TEMPLATE_DELIVERY_TIME_SET=order_delivery_time
// and the template's {{1}}, {{2}}… are filled from the values listed below, in
// that order. An event with no template configured is sent as plain text,
// which WhatsApp only delivers inside a 24-hour window after the customer last
// wrote to the shop — the log records the refusal when it does not.
const WHATSAPP_VARIABLES = {
  ORDER_PLACED: ["code"],
  ORDER_CONFIRMED: ["code"],
  DELIVERY_TIME_SET: ["code", "when"],
  AFTER_HOURS_ORDER: ["code", "when", "reason"],
  ITEMS_DELAYED: ["code", "items", "date"],
};

if (process.env.WHATSAPP_DRY_RUN === "true") console.log("[whatsapp] test mode ON — order messages are printed here, not sent");

const whatsapp = async (message, recipient, meta = {}) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  // Local testing without a Meta account: WHATSAPP_DRY_RUN=true prints exactly
  // what would be sent and sends nothing.
  if (process.env.WHATSAPP_DRY_RUN === "true" && (!token || !phoneId)) {
    const digits = String(recipient.phone || "").replace(/\D/g, "");
    console.log(`[whatsapp:dry-run] → +${digits.length === 10 ? "91" : ""}${digits} (${meta.event})\n${message.title}\n${message.body}`);
    return { status: "skipped", reason: "Dry run — printed in the backend log, nothing was sent" };
  }
  if (!token || !phoneId) {
    if (!config.isProd) console.log(`[whatsapp] → ${recipient.phone}: ${message.body}`);
    return { status: "skipped", reason: "WhatsApp is not configured (set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID)" };
  }

  const digits = String(recipient.phone || "").replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;
  if (!to) return { status: "skipped", reason: "Customer has no phone number" };

  const templateName = process.env[`WHATSAPP_TEMPLATE_${meta.event}`];
  const body = templateName
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [
            {
              type: "body",
              parameters: (WHATSAPP_VARIABLES[meta.event] || []).map((key) => ({
                type: "text",
                text: String(meta.context?.[key] ?? "").replace(/\s+/g, " ").slice(0, 300) || "-",
              })),
            },
          ],
        },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: `${message.title}\n${message.body}`.trim() } };

  try {
    const res = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v20.0"}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { status: "failed", error: data?.error?.message || `WhatsApp refused the message (${res.status})` };
    return { status: "sent" };
  } catch (err) {
    return { status: "failed", error: err.message };
  }
};

// In-app needs no provider: writing the Notification row *is* the delivery.
const inapp = async () => ({ status: "sent" });

module.exports = {
  push,
  sms,
  inapp,
  email: stub("Email", "SMTP_URL"),
  whatsapp,
};
