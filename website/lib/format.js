// Prices cross the wire as integer paise; rupees exist only for display.
export function rupees(paise, { decimals = false } = {}) {
  const value = (Number(paise) || 0) / 100;
  if (decimals) return `\u20B9${value.toFixed(2)}`;
  return `\u20B9${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

export function discountPct(mrp, price) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

// A unit suffix belongs only on loose goods. A 5 KG bag of rice has
// packSize.unit "kg" too, but its quantity counts packs — "1 kg" there would
// tell someone they are buying a kilo when they are buying five.
export function unitSuffix(item) {
  if (!item) return "";
  return Number(item.stepQty ?? 1) < 1 ? item.packSize?.unit || "" : "";
}

export function formatQty(quantity, unit = "") {
  const rounded = Math.round(Number(quantity) * 100) / 100;
  return `${rounded}${unit ? ` ${unit}` : ""}`;
}

export const when = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "\u2014";

// Images live on Cloudinary only. Asking it for f_auto (WebP/AVIF) + q_auto at
// the width actually shown turns a multi-MB original into a few KB.
// Anything that isn't a Cloudinary upload URL is returned unchanged.
export function img(url, width = 600) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${width}/`);
}
