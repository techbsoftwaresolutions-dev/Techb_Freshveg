"use client";

import { useEffect, useRef, useState } from "react";
import { detectPlatform, promptInstall, useInstallPrompt } from "@/lib/install-prompt";

// "Download the app" band at the foot of the homepage. The app is this site
// installed as a PWA, so the button opens the browser's own install dialog
// where there is one (Chrome, Edge, Samsung Internet) and otherwise shows the
// two taps that install it by hand (Safari on iPhone, Firefox, …).
// Hidden when the page is already running as the installed app.
export default function AppDownload() {
  const { canPrompt, installed } = useInstallPrompt();
  const [help, setHelp] = useState(null); // null | "ios" | "android" | "desktop" | "done"
  const helpRef = useRef(null);

  useEffect(() => {
    if (help) helpRef.current?.focus();
  }, [help]);

  if (installed && help !== "done") return null;

  const install = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome === "accepted") setHelp("done");
      return;
    }
    setHelp(detectPlatform());
  };

  return (
    <section className="section app-band" aria-labelledby="app-band-title">
      <div className="app-band-art" aria-hidden="true">
        <Phone className="app-phone back" src="/app-screens/app-offers.webp" />
        <Phone className="app-phone front" src="/app-screens/app-home.webp" />
      </div>

      <div className="app-band-copy">
        <h2 id="app-band-title">
          Download{" "}
          <span className="app-band-nowrap">
            <span className="app-band-brand">Hosur Basket</span> App
          </span>
        </h2>
        <p>Get fresh groceries, exclusive offers and a better shopping experience on our app.</p>
        <button type="button" className="app-band-btn" onClick={install}>
          <span className="app-band-btn-icon">
            <IconGooglePlay />
          </span>
          <span className="app-band-btn-text">
            <small>Get it on Google Play</small>
            <strong>Install the app</strong>
          </span>
          <IconArrow />
        </button>

        {help ? (
          <div className="app-band-help" role="status" tabIndex={-1} ref={helpRef}>
            <HelpText platform={help} />
            <button type="button" className="app-band-help-close" onClick={() => setHelp(null)} aria-label="Close">
              ×
            </button>
          </div>
        ) : null}
      </div>

      <ul className="app-band-features">
        <li>
          <span className="app-band-icon tone-green"><IconTag /></span>
          <span>Exclusive<br />App Offers</span>
        </li>
        <li>
          <span className="app-band-icon tone-pink"><IconTruck /></span>
          <span>Faster<br />Delivery</span>
        </li>
        <li>
          <span className="app-band-icon tone-peach"><IconHeart /></span>
          <span>Easy<br />Reordering</span>
        </li>
        <li>
          <span className="app-band-icon tone-violet"><IconCrown /></span>
          <span>Personalized<br />Deals</span>
        </li>
      </ul>
    </section>
  );
}

function HelpText({ platform }) {
  if (platform === "done") {
    return <p><strong>Installed!</strong> Open Hosur Basket from your home screen.</p>;
  }
  if (platform === "ios") {
    return (
      <p>
        In Safari, tap <strong>Share</strong> <IconShare /> then <strong>Add to Home Screen</strong>.
      </p>
    );
  }
  if (platform === "android") {
    return (
      <p>
        Open your browser menu <strong>⋮</strong> and tap <strong>Install app</strong> or{" "}
        <strong>Add to Home screen</strong>.
      </p>
    );
  }
  return (
    <p>
      Click the <strong>install icon</strong> in the address bar, or open the browser menu and choose{" "}
      <strong>Install Hosur Basket</strong>. On your phone, open hosurbasket.com and install from there.
    </p>
  );
}

// ---- the phone mock-ups (decorative) ---------------------------------------
// Real screenshots of the Hosur Basket site on a phone (public/app-screens).
// Retake them when the home page changes a lot.

function Phone({ className, src }) {
  return (
    <div className={className}>
      <div className="app-phone-screen">
        <img src={src} alt="" className="app-phone-shot" loading="lazy" />
        <span className="app-phone-notch" />
      </div>
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function IconGooglePlay() {
  return (
    <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true">
      <path fill="#4285F4" d="M6.2 5.1A4.2 4.2 0 0 0 5 8.1v31.8a4.2 4.2 0 0 0 1.2 3L27.8 24 6.2 5.1Z" />
      <path fill="#00C853" d="M8.9 3.1a4.1 4.1 0 0 0-2.7 2L27.8 24l7.4-6.5L10.3 3.3a4.1 4.1 0 0 0-1.4-.2Z" />
      <path fill="#EA4335" d="M6.2 42.9a4.1 4.1 0 0 0 4.1 1.8l24.9-14.2L27.8 24 6.2 42.9Z" />
      <path fill="#FBBC04" d="m35.2 17.5 6.1 3.5c2.3 1.3 2.3 4.7 0 6l-6.1 3.5L27.8 24l7.4-6.5Z" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg {...iconProps} className="app-arrow" width="24" height="24" strokeWidth="2.2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path d="M3 12.6V4.5A1.5 1.5 0 0 1 4.5 3h8.1a1.5 1.5 0 0 1 1 .44l7 7a1.5 1.5 0 0 1 0 2.12l-8.1 8.1a1.5 1.5 0 0 1-2.12 0l-7-7A1.5 1.5 0 0 1 3 12.6Z" fill="currentColor" />
      <circle cx="7.5" cy="7.5" r="1.4" fill="#fff" />
      <path d="M9.5 15.5 15.5 9.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10.6" cy="10.6" r="1" fill="#fff" />
      <circle cx="14.4" cy="14.4" r="1" fill="#fff" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path d="M2 6.5A1.5 1.5 0 0 1 3.5 5H14v11H2V6.5Z" fill="currentColor" />
      <path d="M14 8.5h3.6a1.5 1.5 0 0 1 1.2.6l2.9 3.8V16H14V8.5Z" fill="currentColor" opacity="0.8" />
      <circle cx="7" cy="17" r="2.2" fill="#fff" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="17" r="2.2" fill="#fff" stroke="currentColor" strokeWidth="1.6" />
      <path d="M0 9h4M1 12h3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
      <path d="M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.8-8 10.6-8 10.6Z" />
    </svg>
  );
}

function IconCrown() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path d="M3 8.5 7.5 12 12 5.5 16.5 12 21 8.5 19.5 18h-15L3 8.5Z" fill="currentColor" />
      <rect x="4.5" y="19" width="15" height="2" rx="1" fill="currentColor" opacity="0.75" />
      <circle cx="12" cy="4.5" r="1.4" fill="currentColor" />
      <circle cx="3" cy="8" r="1.2" fill="currentColor" />
      <circle cx="21" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg {...iconProps} width="15" height="15" style={{ verticalAlign: "-2px" }}>
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 12v7.5h14V12" />
    </svg>
  );
}
