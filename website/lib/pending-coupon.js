// A coupon the customer picked ("Shop Now" on an offer card) before they had a
// cart. It is remembered here and applied for them when they reach checkout.
const KEY = "commerce.web.coupon";
const KEEP_MS = 24 * 60 * 60 * 1000;

export function rememberCoupon(code) {
  try {
    const value = String(code || "").trim().toUpperCase();
    if (value) localStorage.setItem(KEY, JSON.stringify({ code: value, at: Date.now() }));
  } catch {}
}

export function pendingCoupon() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved?.code || Date.now() - saved.at > KEEP_MS) return "";
    return saved.code;
  } catch {
    return "";
  }
}

export function forgetCoupon() {
  try { localStorage.removeItem(KEY); } catch {}
}
