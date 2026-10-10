"use client";

import { useState } from "react";
import { detectPlatform, isAndroidOtherBrowser, promptInstall, useInstallPrompt } from "@/lib/install-prompt";

// "Get the app" in the footer: the app is this site installed as a PWA. The
// button opens the browser's own install dialog where there is one (Chrome,
// Edge, Samsung Internet), and otherwise says how to install by hand (Safari
// on iPhone, Firefox). Hidden when already running as the installed app.
const HINTS = {
  ios: "In Safari, tap Share, then “Add to Home Screen”.",
  android: "Open the browser menu ⋮ and tap “Install app” or “Add to Home screen”.",
  desktop: "Use the install icon in the address bar, or the browser menu → Install The Farmers Basket.",
  chrome: "To install safely on Android, open thefarmersbasket.in in Google Chrome, then tap Install. Other browsers build an app Android may block as unsafe.",
  done: "Installed! Open The Farmers Basket from your home screen.",
};

export default function FooterInstall() {
  const { canPrompt, installed } = useInstallPrompt();
  const [hint, setHint] = useState(null);

  if (installed && hint !== "done") return null;

  const install = async () => {
    if (isAndroidOtherBrowser()) {
      setHint("chrome");
      return;
    }
    if (canPrompt) {
      if ((await promptInstall()) === "accepted") setHint("done");
      return;
    }
    setHint(detectPlatform());
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
