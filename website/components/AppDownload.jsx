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
        <Sprig className="app-sprig left" />
        <Sprig className="app-sprig right" />
        <span className="app-spark" />
        <Phone className="app-phone back" tiles={["apple", "orange", "lemon", "greens"]} />
        <Phone className="app-phone front" tiles={["apple", "greens", "milk", "snack", "chips"]} labelled />
        <IconLeaf className="app-leaf" />
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
            <IconPhone />
          </span>
          <span className="app-band-btn-text">
            <small>Get it on your phone</small>
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

const TILE_LABEL = { apple: "Fruits", greens: "Vegetables", milk: "Dairy", snack: "Snacks", chips: "Snacks" };

function Phone({ className, tiles, labelled = false }) {
  return (
    <div className={className}>
      <div className="app-phone-screen">
        <span className="app-phone-notch" />
        {labelled ? <span className="app-phone-title">Fresh Market</span> : null}
        <div className="app-phone-grid">
          {tiles.map((tile, i) => (
            <span key={`${tile}${i}`} className="app-phone-tile">
              <Produce kind={tile} />
              {labelled ? <small>{TILE_LABEL[tile]}</small> : null}
            </span>
          ))}
        </div>
        {labelled ? (
          <span className="app-phone-cta">
            Shop Now <IconArrow />
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Small flat drawings standing in for product photos.
function Produce({ kind }) {
  const svg = { viewBox: "0 0 32 32", width: 22, height: 22 };
  switch (kind) {
    case "apple":
      return (
        <svg {...svg}>
          <path d="M16 10c-3-2.5-9-1.5-9 5.5 0 6 4 10 6.5 10 1.3 0 1.8-.6 2.5-.6s1.2.6 2.5.6C21 25.5 25 21.5 25 15.5c0-7-6-8-9-5.5Z" fill="#e53935" />
          <path d="M16 10c0-2.5 1-4 2.5-5" stroke="#6d4c41" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M18 7c2.5-1.5 5-1 5-1s-1 2.6-4 2.6" fill="#43a047" />
        </svg>
      );
    case "orange":
      return (
        <svg {...svg}>
          <circle cx="16" cy="17" r="9" fill="#fb8c00" />
          <path d="M16 8c1.5-2 4-2 4-2s-.6 2.6-3.4 2.8" fill="#43a047" />
        </svg>
      );
    case "lemon":
      return (
        <svg {...svg}>
          <ellipse cx="16" cy="16" rx="10" ry="7.5" fill="#fdd835" />
          <circle cx="7" cy="16" r="1.6" fill="#fdd835" />
        </svg>
      );
    case "greens":
      return (
        <svg {...svg}>
          <path d="M14.5 18h3l1 9h-5l1-9Z" fill="#7cb342" />
          <circle cx="11" cy="14" r="5" fill="#43a047" />
          <circle cx="21" cy="14" r="5" fill="#43a047" />
          <circle cx="16" cy="10" r="5.5" fill="#66bb6a" />
        </svg>
      );
    case "milk":
      return (
        <svg {...svg}>
          <path d="M12.5 4h7v4l2.5 4v15a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1V12l2.5-4V4Z" fill="#e3f2fd" stroke="#64b5f6" strokeWidth="1.4" />
          <rect x="10.8" y="15" width="10.4" height="6" fill="#42a5f5" />
          <rect x="12.5" y="2.5" width="7" height="3" rx="1" fill="#1e88e5" />
        </svg>
      );
    case "snack":
      return (
        <svg {...svg}>
          <path d="M8 6h16l-1.5 3 1.5 3v12l-1.5 3H9.5L8 24V12l1.5-3L8 6Z" fill="#fb8c00" />
          <circle cx="16" cy="17" r="4" fill="#ffe082" />
        </svg>
      );
    default:
      return (
        <svg {...svg}>
          <path d="M9 6h14l-1 3 1 3v12l-1 3H10l-1-3V12l1-3-1-3Z" fill="#e53935" />
          <circle cx="16" cy="17" r="4" fill="#ffcdd2" />
        </svg>
      );
  }
}

function Sprig({ className }) {
  return (
    <svg className={className} viewBox="0 0 90 90" aria-hidden="true">
      <path d="M45 88C40 60 20 48 6 46c10 14 18 32 39 42Z" fill="#7cc58d" />
      <path d="M47 88c2-28 16-46 34-56-4 20-14 44-34 56Z" fill="#4caf63" />
      <path d="M46 88C44 64 46 40 56 18c6 24 2 50-10 70Z" fill="#66bb6a" />
    </svg>
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

function IconLeaf({ className }) {
  return (
    <svg {...iconProps} className={className} strokeWidth="1.5" width="34" height="34">
      <path d="M20 4C9 4 4 10 4 20c10 0 16-5 16-16Z" />
      <path d="M4 20 15 9" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg {...iconProps} width="24" height="24">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
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
