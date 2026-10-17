import { api } from "@/lib/client-api";

// Loads Razorpay's checkout script once.
function loadScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay needs a browser"));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay. Check your connection."));
    document.body.appendChild(script);
  });
}

/**
 * Opens the Razorpay window (UPI first) for an order that is awaiting payment.
 * Resolves { paid: true } once the payment is verified by our server, or
 * { paid: false } if the customer closes the window. Rejects with a readable
 * message if something actually went wrong.
 */
export async function payWithRazorpay(orderId) {
  const { payment, checkout } = await api.post(`/payments/orders/${orderId}/initiate`, {
    method: "upi",
    gateway: "razorpay",
  });
  if (!checkout) throw new Error("Razorpay did not return a payment session. Please try again.");

  await loadScript();

  return new Promise((resolve, reject) => {
    const instance = new window.Razorpay({
      key: checkout.key,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      prefill: checkout.prefill,
      theme: { color: "#16803c" },
      // UPI first, then the other options.
      config: {
        display: {
          blocks: { upi: { name: "Pay via UPI", instruments: [{ method: "upi" }] } },
          sequence: ["block.upi"],
          preferences: { show_default_blocks: true },
        },
      },
      handler: async (response) => {
        try {
          // Our server checks the signature and asks Razorpay for the payment's
          // real state before confirming the order.
          await api.post(`/payments/${payment.id}/confirm`, {
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          resolve({ paid: true });
        } catch (err) {
          reject(err);
        }
      },
      modal: { ondismiss: () => resolve({ paid: false }) },
    });
    instance.on("payment.failed", (event) => {
      reject(new Error(event?.error?.description || "The payment failed. Please try again."));
    });
    instance.open();
  });
}
