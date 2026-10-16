import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import { api } from "./client";

// Razorpay's React Native SDK is a native module: it is in development and
// store builds (expo prebuild / EAS), not in Expo Go. Importing it where the
// module is missing crashes on iOS, so it is only required once we know it is
// there. The web build uses Razorpay's own Checkout.js instead.
const hasNativeModule =
  Platform.OS !== "web" &&
  (TurboModuleRegistry.get?.("RNRazorpayCheckout") != null || NativeModules.RNRazorpayCheckout != null);

export const onlinePaymentSupported = Platform.OS === "web" || hasNativeModule;

// "Pay by UPI": UPI at the top of the sheet, with cards, netbanking and
// wallets still below it. A UPI-only sheet has nothing to show when UPI is not
// enabled on the Razorpay account (or not offered on this device), and
// Razorpay then stops at "No appropriate payment method found" before any
// payment can start. Only the display changes; the order and amount stay the
// server's.
const UPI_FIRST = {
  display: {
    blocks: { upi: { name: "Pay using UPI", instruments: [{ method: "upi" }] } },
    sequence: ["block.upi"],
    preferences: { show_default_blocks: true },
  },
};

let webLoading = null;
function loadWebCheckout() {
  if (window.Razorpay) return Promise.resolve();
  webLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => {
      webLoading = null;
      script.remove();
      reject(new Error("Couldn't open the payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return webLoading;
}

// Opens the sheet. Resolves Razorpay's success payload, or null when the
// customer backed out; `failure` is set when an attempt failed first.
async function openSheet(options) {
  if (Platform.OS === "web") {
    await loadWebCheckout();
    return new Promise((resolve) => {
      let failure = "";
      const sheet = new window.Razorpay({
        ...options,
        handler: resolve,
        modal: { ondismiss: () => resolve(failure ? { failure } : null), confirm_close: true },
      });
      sheet.on("payment.failed", (event) => {
        failure = event?.error?.description || "The payment didn't go through.";
      });
      sheet.open();
    });
  }

  const RazorpayCheckout = require("react-native-razorpay").default;
  try {
    return await RazorpayCheckout.open(options);
  } catch (err) {
    // The SDK reports a back-out as an error too; its description is often a
    // JSON string from the gateway.
    let description = err?.description || "";
    try {
      description = JSON.parse(description)?.error?.description || description;
    } catch {
      // plain text already
    }
    if (err?.code === 2 || /cancel/i.test(description)) return null;
    return { failure: description || "The payment didn't go through." };
  }
}

/**
 * Pays for an order that is already placed and awaiting payment, through the
 * same API as the website. Resolves to
 *   { status: "paid" }               the API verified and captured it
 *   { status: "pending", message }   paid at Razorpay; the API is still confirming
 *   { status: "dismissed" }          the customer closed the sheet
 *   { status: "failed", message }    the payment, or its verification, failed
 * Throws only when the payment could not be started.
 *
 * "paid" only ever comes from the API — the SDK's success callback is proof to
 * be checked, not a result.
 */
export async function payOnline(orderId, { onVerifying, upiOnly = false } = {}) {
  if (!onlinePaymentSupported) {
    throw new Error("Online payment needs the full app build — it isn't available in Expo Go.");
  }

  const { payment, checkout } = await api.post(`/payments/orders/${orderId}/initiate`, {});
  const response = await openSheet(upiOnly ? { ...checkout, config: UPI_FIRST } : checkout);

  if (!response) return { status: "dismissed" };
  if (response.failure) return { status: "failed", message: response.failure };

  onVerifying?.();
  try {
    const result = await api.post(`/payments/${payment.id}/confirm`, {
      providerOrderId: response.razorpay_order_id,
      providerPaymentId: response.razorpay_payment_id,
      signature: response.razorpay_signature,
    });
    if (result.paid) return { status: "paid" };
  } catch (err) {
    // A 4xx is a real answer (bad signature, refunded, …). No connection or a
    // 5xx is not — the money may have moved, and the webhook or the server's
    // own check will settle the order.
    if (err.status && err.status < 500) return { status: "failed", message: err.message };
  }
  return { status: "pending", message: "Payment received — we're confirming it with your bank." };
}
