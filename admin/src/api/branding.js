import { useEffect, useSyncExternalStore } from "react";
import { api } from "./client";
import defaultLogo from "../assets/logo-farmers-basket.png";
import defaultSymbol from "../assets/logo-icon.png";

// The brand images from Admin → Settings → Branding (settings.branding, served
// by the public settings endpoint), shared by the sidebar, the sign-in page and
// the browser tab. Fetched once per page load; the Branding tab pushes a saved
// change in straight away. Until it loads, or when it can't, the bundled
// images stand in, so the admin never shows a broken logo.

let branding = {};
let loading = null;
const listeners = new Set();

function publish(next) {
  branding = next || {};
  applyFavicon(branding.favicon);
  listeners.forEach((listener) => listener());
}

// The tab icon: the uploaded favicon as a 64px PNG, else /favicon.png. The
// Cloudinary URL changes with every upload, so a browser can't keep showing
// a cached old one.
function applyFavicon(url) {
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  const href = url?.includes("/image/upload/")
    ? url.replace("/image/upload/", "/image/upload/c_pad,w_64,h_64,b_transparent,f_png/")
    : "/favicon.png";
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
}

function load() {
  loading ??= api
    .get("/settings/public")
    .then((data) => publish(data.settings?.branding))
    .catch(() => {}); // keep the defaults
  return loading;
}

/** Call after saving the Branding tab, with the saved settings.branding. */
export const refreshBranding = (next) => publish(next);

export function useBranding() {
  useEffect(() => {
    load();
  }, []);
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => branding
  );
  return {
    logo: current.logo || defaultLogo,
    // The compact square mark for small spots, managed separately: a wide
    // logo squeezed into a 32px square would be unreadable.
    symbol: current.symbol || defaultSymbol,
  };
}
