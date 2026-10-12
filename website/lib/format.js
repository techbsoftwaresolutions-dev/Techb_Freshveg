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

// An uploaded favicon as a square PNG of `size` px, padded rather than
// cropped so a logo that is not square still shows whole. The home-screen
// icon pads with white: iOS paints transparent corners black.
export function iconUrl(url, size, background = "transparent") {
  if (typeof url !== "string" || !url.includes("/image/upload/")) return url;
  return url.replace("/image/upload/", `/image/upload/c_pad,w_${size},h_${size},b_${background},f_png/`);
}

// A Cloudinary video's first frame as a still — the hero's poster while the
// video loads, and its fallback when it cannot play.
export function videoPoster(url, width = 1600) {
  if (typeof url !== "string" || !url.includes("/video/upload/")) return undefined;
  return url.replace("/video/upload/", `/video/upload/so_0,q_auto,w_${width},c_limit/`).replace(/\.\w+$/, ".jpg");
}
