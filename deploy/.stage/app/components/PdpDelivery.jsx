"use client";

import { useState } from "react";
import { useStore } from "./Providers";

// Same delivery-check flow as the header's pincode bar, and the same four
// assurances shown on the homepage — placed here too because a shopper
// deciding whether to buy often wants both right next to the buy button,
// not just once at the top of the page. Collapsed to one line by default
// (pin, pincode, real ETA) with the pincode editor only appearing once
// "Check" is clicked, rather than showing an input up front.
export default function PdpDelivery() {
  const { store, pincode, setPincode } = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(pincode || "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await setPincode(value);
      setResult(data);
      if (data.serviceable) setEditing(false);
    } catch {
      setResult({ serviceable: false, message: "Could not check that pincode." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel pdp-delivery">
      {editing ? (
        <form onSubmit={check} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="tel"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit pincode"
            style={{ width: 160 }}
            aria-label="Pincode"
            autoFocus
          />
          <button type="submit" className="btn primary" disabled={value.length !== 6 || busy}>
            {busy ? "Checking…" : "Check"}
          </button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="pdp-delivery-row">
          <span className="pdp-delivery-pin">
            <IconPinSmall />
          </span>
          <span className="pdp-delivery-copy">
            <strong>{pincode ? `Delivering to ${pincode}` : "Set your pincode"}</strong>
            <span>
              {store
                ? `Delivery in about ${store.prepTimeMinutes ?? 30} minutes`
                : "Check if we deliver to you"}
            </span>
          </span>
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              setValue(pincode || "");
              setResult(null);
              setEditing(true);
            }}
          >
            {pincode ? "Change" : "Check"}
          </button>
        </div>
      )}

      {result ? (
        <p className={`notice ${result.serviceable ? "save" : "error"}`} style={{ marginTop: 10, marginBottom: 0 }}>
          {result.serviceable
            ? `We deliver here — ${result.store.name}, about ${result.prepTimeMinutes} minutes.`
            : result.message || "We don't deliver to this pincode yet."}
        </p>
      ) : null}

      <div className="assurance-compact" title={`Fast delivery in about ${store?.prepTimeMinutes ?? 30} minutes · UPI, card or cash on delivery · Easy returns on any order`}>
        <div>
          <IconLeaf />
          <span>Fresh produce</span>
        </div>
        <div>
          <IconTruck />
          <span>Fast delivery</span>
        </div>
        <div>
          <IconCard />
          <span>Pay your way</span>
        </div>
        <div>
          <IconReturn />
          <span>Easy returns</span>
        </div>
      </div>
    </div>
  );
}

// No icon package is installed on this site — every other icon here
// (header, category bar) is one of these small inline glyphs.
function IconPinSmall(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 21s-6.6-5.6-6.6-11A6.6 6.6 0 1 1 18.6 10c0 5.4-6.6 11-6.6 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

// Same minimal inline-glyph approach as IconPinSmall above — no icon
// package on this site, so each assurance gets its own tiny hand-drawn SVG
// rather than pulling in a whole icon library for four glyphs.
function IconLeaf(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M5 19c8-1 13-6 14-14-8 1-13 6-14 14Z" />
      <path d="M5 19c1.5-4 4-7 8-9" />
    </svg>
  );
}

function IconTruck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M2 7h11v9H2z" />
      <path d="M13 10h4l4 3v3h-8z" />
      <circle cx="6.5" cy="18" r="1.7" />
      <circle cx="16.5" cy="18" r="1.7" />
    </svg>
  );
}

function IconCard(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true" {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  );
}

function IconReturn(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M3 11a9 9 0 1 1 2.6 6.4" />
      <path d="M3 5v6h6" />
    </svg>
  );
}
