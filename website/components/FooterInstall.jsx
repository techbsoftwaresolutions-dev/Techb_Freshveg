"use client";

import { useEffect, useState } from "react";
import { detectPlatform, isAndroidOtherBrowser, promptInstall, useInstallPrompt, waitForPrompt } from "@/lib/install-prompt";

// "Get the app" in the footer: the app is this site installed as a PWA. The
// button opens the browser's own install dialog, so it only shows once the
// browser has offered one (Chrome, Edge) — a browser that never does (Firefox
// or Safari on a computer, or the app already installed) has nothing to
// click. Two exceptions say how instead, as neither has a dialog: Safari on
// iPhone (Share → Add to Home Screen) and Android browsers other than Chrome.
const HINTS = {
  ios: "In Safari, tap Share, then “Add to Home Screen”.",
  chrome: "To install safely on Android, open thefarmersbasket.in in Google Chrome, then tap Install. Other browsers build an app Android may block as unsafe.",
  done: "Installed! Open The Farmers Basket from your home screen.",
};

export default function FooterInstall() {
  const { mounted, canPrompt, installed } = useInstallPrompt();
  const [hint, setHint] = useState(null);
  // Stays shown once offered: Chrome takes a moment to re-offer after a "Cancel".
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    if (canPrompt) setOffered(true);
  }, [canPrompt]);

  if (!mounted || (installed && hint !== "done")) return null;
  const manual = isAndroidOtherBrowser() ? "chrome" : detectPlatform() === "ios" ? "ios" : null;
  if (!offered && !manual && !hint) return null;

  const install = async () => {
    if (manual) return setHint(manual);
    if ((await waitForPrompt(3000)) && (await promptInstall()) === "accepted") setHint("done");
  };

  return (
    <div className="footer-install">
      <h4>Get the App</h4>
      <button type="button" className="footer-install-btn" onClick={install}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
        <span>
          <small>Free on Android &amp; iPhone</small>
          <strong>Install the app</strong>
        </span>
      </button>
      {hint ? (
        <p className="footer-install-hint" role="status">
          {HINTS[hint]}
        </p>
      ) : null}
    </div>
  );
}
