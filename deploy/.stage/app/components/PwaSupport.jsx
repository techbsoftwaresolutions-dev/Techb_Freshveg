"use client";

import { useEffect, useState } from "react";
import { detectPlatform, promptInstall, useInstallPrompt } from "@/lib/install-prompt";

const DISMISS_KEY = "freshmart.install.dismissedAt";
// Asked at most once a fortnight — a banner that comes back on every visit is
// how people learn to ignore it.
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

// Registers the service worker and offers "Install app" on phones.
//
// The worker is only registered in a production build (or with
// NEXT_PUBLIC_PWA_DEV=1). In `next dev` the build files are not content-hashed,
// so caching them would serve yesterday's code after an edit.
export default function PwaSupport() {
  const { mounted, canPrompt, installed } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Set NEXT_PUBLIC_PWA_DEV=1 in .env.local to try installing from `next dev`.
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_PWA_DEV === "1";
    if (enabled && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }
    setDismissed(recentlyDismissed());
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private mode — the banner just comes back next visit.
    }
    setDismissed(true);
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome !== "accepted") dismiss();
  };

  // Safari on iPhone has no prompt at all — installing is Share → Add to Home
  // Screen, so the most that can be done is to say so.
  const showIosHint = mounted && detectPlatform() === "ios" && !/crios|fxios/i.test(navigator.userAgent);
  if (!mounted || installed || dismissed || (!canPrompt && !showIosHint)) return null;

  return (
    <div className="install-bar" role="dialog" aria-label="Install the Hosur Basket app">
      <img src="/icons/icon-192.png?v=3" alt="" className="install-bar-icon" width="40" height="40" />
      <div className="install-bar-copy">
        <strong>Get the Hosur Basket app</strong>
        <span>
          {canPrompt
            ? "Faster ordering, right from your home screen."
            : "Tap Share, then “Add to Home Screen”."}
        </span>
      </div>
      {canPrompt ? (
        <button type="button" className="install-bar-btn" onClick={install}>
          Install
        </button>
      ) : null}
      <button type="button" className="install-bar-close" onClick={dismiss} aria-label="Not now">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}
