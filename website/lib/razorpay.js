"use client";

import { api } from "@/lib/client-api";

// Razorpay Standard Checkout — their own script, loaded on first use and only
// once. The options (public key id, gateway order, amount) all come from our
// API; nothing about the price is decided in the browser.
let loading = null;

const UPI_ONLY = {
  display: {
    blocks: { upi: { name: "Pay using UPI", instruments: [{ method: "upi" }] } },
    sequence: ["block.upi"],
    preferences: { show_default_blocks: false },
  },
};

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't open the payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

/**
 * Pays for an order that is already placed and awaiting payment. Resolves to
 *   { status: "paid" }               the API verified and captured it
 *   { status: "pending", message }   paid at Razorpay; the API is still confirming
 *   { status: "dismissed" }          the customer closed the sheet
 *   { status: "failed", message }    the payment, or its verification, failed
 * Throws only when the payment could not be started at all.
 *
 * "paid" only ever comes from the API — Razorpay's success callback is proof
 * to be checked, not a result.
 */
export async function payOnline(orderId, { onVerifying, upiOnly = false } = {}) {
  const { payment, checkout } = await api.post(`/payments/orders/${orderId}/initiate`, {});
  await loadCheckout();

  let lastError = "";
  const response = await new Promise((resolve) => {
    const sheet = new window.Razorpay({
      ...checkout,
      // "Pay by UPI" at checkout: the sheet shows UPI alone — a QR to scan on
      // a computer, the customer's UPI apps on a phone. Only the display
      // changes; the order and amount are still the server's.
      ...(upiOnly ? { config: UPI_ONLY } : {}),
      handler: resolve,
      modal: { ondismiss: () => resolve(null), confirm_close: true },
    });
    // The sheet stays open after a failed attempt so the customer can try
    // another way; remember why, in case they give up.
    sheet.on("payment.failed", (event) => {
      lastError = event?.error?.description || "The payment didn't go through.";
    });
    sheet.open();
  });

  if (!response) return lastError ? { status: "failed", message: lastError } : { status: "dismissed" };

  onVerifying?.();
  try {
    const result = await api.post(`/payments/${payment.id}/confirm`, {
      providerOrderId: response.razorpay_order_id,
      providerPaymentId: response.razorpay_payment_id,
      signature: response.razorpay_signature,
    });
    if (result.paid) return { status: "paid" };
  } catch (err) {
    // A 4xx is a real answer (bad signature, refunded, …). A dropped
    // connection or a 5xx is not — the money may well have moved, and the
    // webhook or the server's own check will settle the order.
    if (err.status && err.status < 500) return { status: "failed", message: err.message };
  }
  return { status: "pending", message: "Payment received — we're confirming it with your bank. This usually takes under a minute." };
}
