"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "freshmart.install.dismissedAt";
// Asked at most once a fortnight — a banner that comes back on every visit is
// how people learn to ignore it.
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

// Registers the service worker and offers "Install app" on phones.
//
// The worker is only registered in a production build. In `next dev` the
// build files are not content-hashed, so caching them would serve yesterday's
// code after an edit.
export default function PwaSupport() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Already running as the installed app: nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone || recentlyDismissed()) return undefined;

    // Chrome and Edge on Android hand over an install prompt we can trigger
    // from our own button.
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Safari on iPhone has no prompt at all — installing is Share → Add to
    // Home Screen, so the most that can be done is to say so.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
    if (isIos) setShowIosHint(true);

    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private mode — the banner just comes back next visit.
    }
    setInstallEvent(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (outcome !== "accepted") dismiss();
    setInstallEvent(null);
  };

  if (!installEvent && !showIosHint) return null;

  return (
    <div className="install-bar" role="dialog" aria-label="Install the FreshMart app">
      <img src="/app-icon/192" alt="" className="install-bar-icon" width="40" height="40" />
      <div className="install-bar-copy">
        <strong>Get the FreshMart app</strong>
        <span>
          {installEvent
            ? "Faster ordering, right from your home screen."
            : "Tap Share, then “Add to Home Screen”."}
        </span>
      </div>
      {installEvent ? (
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
