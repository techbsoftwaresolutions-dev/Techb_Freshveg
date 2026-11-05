// The shop opens on 13 November 2026 (IST). While the lock is on, anything that
// would start a checkout shows the "Coming soon" banner instead. After that date
// checkout works by itself.
export const OPENS_ON = "2026-11-13T00:00:00+05:30";

// ---- Testing switch ---------------------------------------------------------
// false = lock OFF (checkout works now, for testing). Set to true to lock
// checkout until the opening date. Keep this the same as website/lib/launch.js.
const LAUNCH_LOCK = false;

export function storeOpen() {
  if (!LAUNCH_LOCK) return true;
  return Date.now() >= Date.parse(OPENS_ON);
}
