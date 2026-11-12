// Channel adapters. Each one is a function that takes a rendered message and
// tries to deliver it.
//
// Supported WhatsApp delivery options:
// 1. CallMeBot (100% Free Gateway for personal testing, no Meta developer account required)
// 2. Meta WhatsApp Cloud API (Official Meta API)
// 3. Twilio WhatsApp API
// 4. Clickable direct wa.me link & terminal logging

const config = require("../../config");

const stub = (name, envVar) => async (message, recipient) => {
  if (!process.env[envVar]) {
    return {
      status: "skipped",
      reason: `${name} is not configured (set ${envVar})`,
    };
  }
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
  whatsapp: stub("WhatsApp", "WHATSAPP_TOKEN"),
};
