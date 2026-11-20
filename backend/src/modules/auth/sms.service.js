// Sends the one-time login code by SMS.
//
// Which provider is chosen with SMS_PROVIDER (msg91 | fast2sms | twilio) and
// each reads its own keys from the environment — see .env.example. With no
// provider set, sending throws SmsNotConfiguredError and the OTP endpoint
// answers with a clear 503, rather than claiming a message went out that
// never did (which is what a customer sees as "the code never arrives").
//
// Uses the fetch built into Node 20+, so there is nothing to install.

class SmsNotConfiguredError extends Error {}
class SmsSendError extends Error {}

const TIMEOUT_MS = 10000;

async function post(url, { headers = {}, body, form } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: form ? { "content-type": "application/x-www-form-urlencoded", ...headers } : { "content-type": "application/json", ...headers },
      body: form ? new URLSearchParams(form).toString() : JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON — keep the raw text for the log
    }
    return { ok: response.ok, status: response.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

const providers = {
  // MSG91 "Send OTP". Needs an OTP template approved under DLT, containing
  // the ##OTP## variable.
  async msg91(phone, code) {
    const key = process.env.MSG91_AUTH_KEY;
    const template = process.env.MSG91_TEMPLATE_ID;
    if (!key || !template) throw new SmsNotConfiguredError("MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must both be set");
    const query = new URLSearchParams({
      template_id: template,
      mobile: `91${phone}`,
      authkey: key,
      otp: code,
      otp_expiry: "5",
    });
    const res = await post(`https://control.msg91.com/api/v5/otp?${query}`);
    if (!res.ok || res.json?.type === "error") {
      throw new SmsSendError(`MSG91 refused the message (${res.status}): ${res.json?.message || res.text}`);
    }
  },

  // Fast2SMS, "otp" route.
  async fast2sms(phone, code) {
    const key = process.env.FAST2SMS_API_KEY;
    if (!key) throw new SmsNotConfiguredError("FAST2SMS_API_KEY must be set");
    const res = await post("https://www.fast2sms.com/dev/bulkV2", {
      headers: { authorization: key },
      body: { route: "otp", variables_values: code, numbers: phone },
    });
    if (!res.ok || res.json?.return === false) {
      throw new SmsSendError(`Fast2SMS refused the message (${res.status}): ${res.json?.message || res.text}`);
    }
  },

  // Twilio Programmable SMS. TWILIO_FROM is a Twilio number, or set
  // TWILIO_MESSAGING_SERVICE_SID instead.
  async twilio(phone, code) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!sid || !token || !(from || service)) {
      throw new SmsNotConfiguredError("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID) must be set");
    }
    const form = {
      To: `+91${phone}`,
      Body: `Your Hosur Basket verification code is ${code}. It is valid for 5 minutes. Do not share it with anyone.`,
    };
    if (service) form.MessagingServiceSid = service;
    else form.From = from;
    const res = await post(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      form,
    });
    if (!res.ok) throw new SmsSendError(`Twilio refused the message (${res.status}): ${res.json?.message || res.text}`);
  },
};

const providerName = () => (process.env.SMS_PROVIDER || "").trim().toLowerCase();

const isConfigured = () => Boolean(providers[providerName()]);

async function sendOtp(phone, code) {
  const name = providerName();
  const send = providers[name];
  if (!send) {
    throw new SmsNotConfiguredError(
      name ? `Unknown SMS_PROVIDER "${name}" (use msg91, fast2sms or twilio)` : "SMS_PROVIDER is not set"
    );
  }
  await send(phone, code);
}

// OTP_TEST_NUMBERS="7894561230:482915,9876543210:123456" — specific numbers
// that always accept a fixed code and are never texted. For the store owner's
// own phones, app-store reviewers and QA on the live site; every other number
// gets a random code by SMS.
function testCodeFor(phone) {
  const raw = process.env.OTP_TEST_NUMBERS || "";
  for (const entry of raw.split(",")) {
    const [number, code] = entry.split(":").map((part) => (part || "").trim());
    if (number === phone && /^\d{6}$/.test(code)) return code;
  }
  return "";
}

module.exports = { sendOtp, isConfigured, testCodeFor, SmsNotConfiguredError, SmsSendError };
