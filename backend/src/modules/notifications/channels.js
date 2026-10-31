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

const whatsapp = async (message, recipient) => {
  const rawPhone = recipient?.phone || recipient;
  if (!rawPhone) return { status: "skipped", reason: "No phone number available" };

  let phone = String(rawPhone).replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) {
    phone = phone.length === 10 ? `+91${phone}` : `+${phone}`;
  }

  const fullText = message.title ? `*${message.title}*\n\n${message.body}` : message.body;

  // 1. Check for Free CallMeBot API (100% free, no credit card or Meta account)
  const callmebotKey = process.env.CALLMEBOT_API_KEY;
  const isValidCallMeBotKey =
    callmebotKey &&
    callmebotKey.trim() !== "" &&
    !callmebotKey.includes("←") &&
    !callmebotKey.includes("paste") &&
    callmebotKey !== "your_callmebot_api_key_here";

  if (isValidCallMeBotKey) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(fullText)}&apikey=${callmebotKey.trim()}`;
      console.log(`[whatsapp:callmebot] Calling gateway for ${phone}...`);
      const response = await fetch(url);
      const text = await response.text();
      console.log(`[whatsapp:callmebot] HTTP ${response.status} → ${text.slice(0, 200)}`);
      if (response.ok && (text.includes("Success") || text.includes("Message queued") || text.includes("Message sent"))) {
        console.log(`[whatsapp:callmebot] ✅ Sent to ${phone}`);
        return { status: "sent", provider: "callmebot" };
      }
      console.warn(`[whatsapp:callmebot] ❌ Gateway rejected. Check your API key.`);
    } catch (err) {
      console.warn(`[whatsapp:callmebot] error:`, err.message);
    }
  } else if (callmebotKey && callmebotKey.trim() !== "") {
    console.warn(`[whatsapp:callmebot] CALLMEBOT_API_KEY looks invalid, skipping.`);
  }

  // 2. Official Meta WhatsApp Cloud API (if real token provided)
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const isRealMetaToken = token && !token.includes("your_meta_access_token") && phoneNumberId && phoneNumberId !== "109876543210987";

  if (isRealMetaToken) {
    try {
      const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone.replace("+", ""),
          type: "text",
          text: { preview_url: true, body: fullText },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`[whatsapp:meta] error:`, data.error?.message);
        return { status: "failed", error: data.error?.message };
      }
      console.log(`[whatsapp:meta] ✅ Message delivered to ${phone}`);
      return { status: "sent", messageId: data.messages?.[0]?.id };
    } catch (err) {
      console.error(`[whatsapp:meta] request failed:`, err.message);
      return { status: "failed", error: err.message };
    }
  }

  // 3. Twilio WhatsApp API (if configured)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

  if (twilioSid && twilioAuth && !twilioSid.includes("XXXX")) {
    try {
      const basicAuth = Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64");
      const params = new URLSearchParams();
      params.append("From", twilioFrom);
      params.append("To", `whatsapp:${phone}`);
      params.append("Body", fullText);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`[whatsapp:twilio] ✅ Message sent to ${phone}`);
        return { status: "sent", messageId: data.sid };
      }
      console.warn(`[whatsapp:twilio] failed:`, data.message);
    } catch (err) {
      console.warn(`[whatsapp:twilio] error:`, err.message);
    }
  }

  // 4. No gateway configured — print to terminal and warn clearly
  const eventTag = message.event ? `(${message.event})` : "";
  console.log(`\n========================================`);
  console.log(`[whatsapp:NO-GATEWAY] ⚠️  Message NOT sent to ${phone} ${eventTag}`.trim());
  console.log(`⚠️  Set CALLMEBOT_API_KEY in backend/.env to send real WhatsApp messages automatically.`);
  console.log(`--- Message that would have been sent ---`);
  if (message.title) console.log(message.title);
  if (message.body) console.log(message.body);
  console.log(`========================================\n`);

  return { status: "skipped", reason: "No WhatsApp gateway configured. Set CALLMEBOT_API_KEY in .env" };
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
