// The shop opens on 13 November 2026 (IST). Until then, anything that would start a
// checkout shows the "Coming soon" banner instead. After that date checkout works by
// itself; to open early, set NEXT_PUBLIC_STORE_OPEN=true in website/.env.local and restart.
export const OPENS_ON = "2026-11-13T00:00:00+05:30";

export function storeOpen() {
  if (process.env.NEXT_PUBLIC_STORE_OPEN === "true") return true;
  return Date.now() >= Date.parse(OPENS_ON);
}

export function openComingSoon() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("hb:coming-soon"));
}

// Returns true (and shows the banner) when checkout must not start yet.
export function gateCheckout() {
  if (storeOpen()) return false;
  openComingSoon();
  return true;
}
