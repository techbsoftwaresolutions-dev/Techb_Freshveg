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
      <div className="app-band-phones" aria-hidden="true">
        <Phone className="app-phone back" items={["🥕", "🍅", "🥦", "🧅", "🥛", "🍞"]} />
        <Phone className="app-phone front" items={["🍎", "🍌", "🥭", "🍇", "🥚", "🧈"]} deal />
      </div>

      <div className="app-band-copy">
        <h2 id="app-band-title">
          Download{" "}
          <span className="app-band-nowrap">
            <span className="app-band-brand">Hosur <span>Basket</span></span> App
          </span>
        </h2>
        <p>Fresh groceries, offers and order tracking — one tap from your home screen.</p>
        <button type="button" className="app-band-btn" onClick={install}>
          <IconPhone />
          <span>
            <small>Free on Android &amp; iPhone</small>
            <strong>Install the app</strong>
          </span>
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
          <span className="app-band-icon tone-green"><IconPin /></span>
          Track your<br />order live
        </li>
        <li>
          <span className="app-band-icon tone-pink"><IconGift /></span>
          Exclusive<br />offers
        </li>
        <li>
          <span className="app-band-icon tone-red"><IconHeart /></span>
          Save your<br />favourites
        </li>
        <li>
          <span className="app-band-icon tone-amber"><IconBolt /></span>
          Fast &amp; easy<br />reorder
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

function Phone({ className, items, deal = false }) {
  return (
    <div className={className}>
      <div className="app-phone-screen">
        <span className="app-phone-notch" />
        <div className="app-phone-grid">
          {items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        {deal ? <span className="app-phone-deal">Fresh deals</span> : null}
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

function IconPhone() {
  return (
    <svg {...iconProps} width="26" height="26">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg {...iconProps} width="28" height="28">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.6" />
    </svg>
  );
}

function IconGift() {
  return (
    <svg {...iconProps} width="28" height="28">
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12" />
      <path d="M12 8S10.5 3.5 8 4.2C6 4.8 7 8 12 8Zm0 0s1.5-4.5 4-3.8C18 4.8 17 8 12 8Z" />
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

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
      <path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6L13.5 2Z" />
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
