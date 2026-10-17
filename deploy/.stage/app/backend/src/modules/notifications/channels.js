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

// In-app needs no provider: writing the Notification row *is* the delivery.
const inapp = async () => ({ status: "sent" });

module.exports = {
  push,
  sms,
  inapp,
  email: stub("Email", "SMTP_URL"),
  // WhatsApp only allows business-initiated messages through Meta-approved
  // templates, so it is not a free-text channel here: order updates go out
  // through whatsapp.service.js (see docs/WHATSAPP.md).
  whatsapp: async () => ({
    status: "skipped",
    reason: "WhatsApp order updates are sent as approved templates, logged in WhatsAppMessage",
  }),
};
