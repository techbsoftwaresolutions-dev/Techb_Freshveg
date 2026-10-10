const crypto = require("crypto");

// One interface, several providers. The order flow only ever sees
// createOrder / verify / refund — which provider is behind them is a settings
// choice, and swapping Razorpay for Stripe touches this file and nothing else.
//
// Keys come from the environment, never from the settings document: a settings
// row ends up in backups, logs and admin screens.

/**
 * The "no gateway configured" provider. Used for cash on delivery, for
 * wallet-only orders, and in development before anyone has signed up for
 * Razorpay. It behaves like a gateway that instantly succeeds, so the rest of
 * the engine can be exercised end to end without one.
 */
const manual = {
  name: "none",
  configured: true,

  async createOrder({ amount, orderCode }) {
    return {
      providerOrderId: `manual_${orderCode}_${Date.now().toString(36)}`,
      amount,
      // Nothing for the client to open — payment happens offline or from balance.
      checkout: null,
    };
  },

  async verify() {
    return { ok: true, providerPaymentId: `manual_${Date.now().toString(36)}` };
  },

  async refund({ amount }) {
    return { ok: true, providerRefundId: `manual_rf_${Date.now().toString(36)}`, amount };
  },
};

/**
 * Razorpay. Implemented against their REST API directly rather than the SDK,
 * so the dependency list stays short and the request shapes are visible here
 * rather than hidden behind a wrapper.
 *
 * Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to turn it on.
 */
const razorpay = {
  name: "razorpay",

  get keyId() {
    return process.env.RAZORPAY_KEY_ID || "";
  },
  get keySecret() {
    return process.env.RAZORPAY_KEY_SECRET || "";
  },
  get configured() {
    return Boolean(this.keyId && this.keySecret);
  },

  auth() {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
  },

  async call(path, { method = "POST", body } = {}) {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: this.auth() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.description || "Payment provider rejected the request");
      error.code = payload?.error?.code;
      error.payload = payload;
      throw error;
    }
    return payload;
  },

  async createOrder({ amount, orderCode, customer }) {
    const created = await this.call("/orders", {
      body: {
        amount, // Razorpay also works in paise, so no conversion here
        currency: "INR",
        receipt: orderCode,
        notes: { orderCode, customerPhone: customer?.phone || "" },
      },
    });

    return {
      providerOrderId: created.id,
      amount: created.amount,
      // What the app or website hands to the Razorpay checkout widget.
      checkout: {
        key: this.keyId,
        orderId: created.id,
        amount: created.amount,
        currency: created.currency,
        name: "Samagra Mart",
        prefill: { contact: customer?.phone || "", name: customer?.name || "" },
      },
    };
  },

  /**
   * Confirms a payment actually happened.
   *
   * The signature check is the whole point: without it a client could POST a
   * made-up payment id and get a free order. It is an HMAC of
   * "<order_id>|<payment_id>" with the key secret, compared in constant time.
   */
  async verify({ providerOrderId, providerPaymentId, signature }) {
    if (!providerOrderId || !providerPaymentId || !signature) {
      return { ok: false, reason: "Missing payment confirmation fields" };
    }

    const expected = crypto
      .createHmac("sha256", this.keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!ok) return { ok: false, reason: "Payment signature did not match" };

    // Trust but verify: ask the gateway what it thinks the payment's state is,
    // rather than believing the client's word that it succeeded.
    const payment = await this.call(`/payments/${providerPaymentId}`, { method: "GET" });
    if (!["captured", "authorized"].includes(payment.status)) {
      return { ok: false, reason: `Payment is ${payment.status}`, payload: payment };
    }

    return { ok: true, providerPaymentId, payload: payment };
  },

  async refund({ providerPaymentId, amount, notes }) {
    const refund = await this.call(`/payments/${providerPaymentId}/refund`, {
      body: { amount, notes },
    });
    return { ok: true, providerRefundId: refund.id, amount: refund.amount, payload: refund };
  },

  /** Verifies a webhook came from Razorpay and not from someone guessing the URL. */
  verifyWebhook(rawBody, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    if (!secret || !signature) return false;

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};

const providers = { none: manual, manual, razorpay };

/**
 * The provider to use right now. Falls back to manual when the configured one
 * has no keys — an unconfigured gateway should degrade to cash on delivery,
 * not take the checkout down.
 */
function resolve(name) {
  const provider = providers[name] || manual;
  return provider.configured ? provider : manual;
}

module.exports = { resolve, providers, manual, razorpay };
