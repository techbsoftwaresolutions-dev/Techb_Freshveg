const crypto = require("crypto");

// The Meta WhatsApp Cloud API, called directly with fetch — the same choice
// the payment gateways and Cloudinary make: the request shape is visible here
// and no SDK joins the dependency list.
//
// Business-initiated WhatsApp messages must use a template Meta has approved,
// so this sends templates only: a name, a language and positional body
// parameters. Everything is read from the environment at call time, so the
// API starts, and orders flow, with none of it set (see docs/WHATSAPP.md).

const TIMEOUT_MS = 10000;

// Order events this integration knows, and the env var naming each one's
// approved template. An event whose template is unset is simply not sent.
const TEMPLATE_VARS = {
  order_confirmed: "WHATSAPP_TEMPLATE_ORDER_CONFIRMED",
  order_packed: "WHATSAPP_TEMPLATE_ORDER_PACKED",
  out_for_delivery: "WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY",
  order_delivered: "WHATSAPP_TEMPLATE_ORDER_DELIVERED",
  order_cancelled: "WHATSAPP_TEMPLATE_ORDER_CANCELLED",
};

const env = (key) => String(process.env[key] || "").trim();

function settings() {
  const templates = {};
  for (const [event, key] of Object.entries(TEMPLATE_VARS)) templates[event] = env(key);
  const required = {
    WHATSAPP_ACCESS_TOKEN: env("WHATSAPP_ACCESS_TOKEN"),
    WHATSAPP_PHONE_NUMBER_ID: env("WHATSAPP_PHONE_NUMBER_ID"),
    WHATSAPP_API_VERSION: env("WHATSAPP_API_VERSION"),
    FRONTEND_URL: env("FRONTEND_URL"),
  };
  return {
    // Off unless explicitly "true": a half-filled .env must never start
    // messaging customers.
    enabled: env("WHATSAPP_ENABLED").toLowerCase() === "true",
    token: required.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: required.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: required.WHATSAPP_API_VERSION,
    frontendUrl: required.FRONTEND_URL.replace(/\/+$/, ""),
    language: env("WHATSAPP_TEMPLATE_LANGUAGE") || "en",
    countryCode: env("WHATSAPP_DEFAULT_COUNTRY_CODE") || "91",
    appSecret: env("WHATSAPP_APP_SECRET"),
    verifyToken: env("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    templates,
    // Names only — never values — so this is safe to log.
    missing: Object.entries(required).filter(([, value]) => !value).map(([key]) => key),
  };
}

/**
 * A customer's number in the international form Meta wants (digits, country
 * code first, no +). Accounts store 10-digit Indian numbers; anything that
 * cannot be turned into a plausible number returns null.
 */
function toWhatsAppNumber(phone, countryCode = "91") {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** "919876543210" -> "91******3210": enough to recognise, not to dial. */
const maskNumber = (number) => (number ? `${number.slice(0, 2)}${"*".repeat(Math.max(0, number.length - 6))}${number.slice(-4)}` : "");

// Meta error codes that mean the setup is wrong, not that this one message
// failed: an invalid or expired token, a missing permission, a template that
// is not approved. Retrying these only repeats the failure.
const CONFIG_ERRORS = new Set([0, 3, 10, 190, 200, 132000, 132001, 132005, 132007, 132012, 132015, 132016]);

/**
 * Sends one approved template. Resolves — never rejects — with
 *   { ok: true, messageId }  or
 *   { ok: false, error, code, retryable, configError }
 * The access token goes in the Authorization header only; it is never part of
 * a returned error or a log line.
 */
async function sendTemplate({ to, template, params = [], language }, cfg = settings()) {
  if (cfg.missing.length) {
    return { ok: false, error: `WhatsApp is not configured: set ${cfg.missing.join(", ")}`, retryable: false, configError: true };
  }

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: language || cfg.language },
      ...(params.length
        ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: String(text) })) }] }
        : {}),
    },
  };

  let response;
  try {
    response = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    // A network blip or a slow Meta is worth another try later.
    return { ok: false, error: timedOut ? `No reply from WhatsApp within ${TIMEOUT_MS / 1000}s` : "Could not reach WhatsApp", retryable: true };
  }

  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload?.messages?.[0]?.id) {
    return { ok: true, messageId: payload.messages[0].id };
  }

  const code = payload?.error?.code;
  const configError = response.status === 401 || response.status === 403 || CONFIG_ERRORS.has(code);
  return {
    ok: false,
    code,
    // Meta's own message names the problem (unknown template, bad number);
    // it never contains the token. Trimmed, as it lands in the log.
    error: String(payload?.error?.message || `WhatsApp replied HTTP ${response.status}`).slice(0, 300),
    retryable: !configError && (response.status === 429 || response.status >= 500 || code === 131016 || code === 130429),
    configError,
  };
}

/**
 * Meta signs every webhook POST: X-Hub-Signature-256 = "sha256=" + an
 * HMAC-SHA256 of the exact raw body, keyed with the app secret.
 */
function verifySignature(rawBody, header, appSecret = settings().appSecret) {
  if (!appSecret || !rawBody || typeof header !== "string" || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
}

module.exports = { settings, sendTemplate, verifySignature, toWhatsAppNumber, maskNumber, TEMPLATE_VARS };
