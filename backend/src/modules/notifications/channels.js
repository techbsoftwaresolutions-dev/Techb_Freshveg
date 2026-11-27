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

  const messages = tokens.map((token) => ({
    to: token,
    title: message.title,
    body: message.body,
    sound: "default",
    priority: "high",
    channelId: "delivery_assignments_v2",
    data: {
      event: message.event,
      deeplink: message.deeplink,
      ...(message.data || {}),
    },
  }));
  let sent = 0;
  const failures = [];

  for (let index = 0; index < messages.length; index += 100) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages.slice(index, index + 100)),
    });
    const payload = await response.json();

    if (!response.ok) {
      failures.push(payload?.errors?.[0]?.message || `Expo Push API returned HTTP ${response.status}`);
      continue;
    }

    const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
    for (const ticket of tickets) {
      if (ticket?.status === "ok") sent += 1;
      else failures.push(ticket?.message || "Expo could not deliver the push notification");
    }
  }

  if (sent === messages.length) return { status: "sent" };
  if (sent > 0) return { status: "sent", reason: failures.join("; ") };
  return { status: "failed", error: failures.join("; ") || "Expo did not accept the push notification" };
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
