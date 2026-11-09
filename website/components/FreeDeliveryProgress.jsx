"use client";

import { useEffect, useState } from "react";
import { rupees } from "@/lib/format";
import { useCart, useStore } from "./Providers";

// The one place the free-delivery rule is read and turned into numbers. The
// rule itself — switched on or off, and the amount — is set per store in the
// admin (Settings → Stores) and arrives with the cart's own summary, so the
// number shown is the number the server prices with. Nothing here has an
// amount of its own: no store, no card.
//
// All amounts are paise, like the rest of the cart.

// Enabled + threshold, from the cart's summary when it has loaded (the store
// the cart is priced against), otherwise from the store the shopper selected.
export function useFreeDeliveryRule() {
  const { summary } = useCart();
  const { store } = useStore();

  const fromSummary = summary && typeof summary.freeDeliveryThreshold === "number";
  const rawAmount = fromSummary
    ? summary.freeDeliveryThreshold
    : store?.freeDeliveryAbove ?? store?.settings?.freeDeliveryAbove;
  const amount = Number(rawAmount);

  const flag = fromSummary
    ? summary.freeDeliveryEnabled
    : store?.freeDeliveryEnabled ?? store?.settings?.freeDeliveryEnabled;

  // A missing flag (an API that predates the switch) means "on", as long as
  // there is a usable amount. A zero, negative or non-numeric amount is not a
  // threshold, so the card stays away rather than showing nonsense.
  const valid = Number.isFinite(amount) && amount > 0;
  return { known: Boolean(store || fromSummary), enabled: flag !== false && valid, threshold: valid ? amount : 0 };
}

// Progress of the current cart toward the threshold. "Cart total" is the
// subtotal after offers — the same figure the server compares to the
// threshold — never the item count, a line price, or the delivery fee.
export function useFreeDelivery() {
  const { summary } = useCart();
  const rule = useFreeDeliveryRule();

  // Until the cart has loaded there is no honest number to show.
  const loaded = Boolean(summary);
  const subtotal = loaded ? Math.max(0, (summary.subtotal || 0) - (summary.offerDiscount || 0)) : 0;
  const { threshold } = rule;

  const remaining = Math.max(threshold - subtotal, 0);
  const percent = threshold > 0 ? Math.min((subtotal / threshold) * 100, 100) : 0;

  return {
    show: rule.enabled && loaded,
    threshold,
    subtotal,
    remaining,
    percent,
    empty: subtotal === 0,
    unlocked: threshold > 0 && subtotal >= threshold,
  };
}

// Whole rupees, rounded up: "₹0 to go" must never be shown while a few paise
// are still missing.
const toGo = (paise) => rupees(Math.ceil(paise / 100) * 100);

const iconProps = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

// variant: "floating" (the phone's bar above the bottom nav), "inline"
// (cart page) or "compact" (side panels).
export default function FreeDeliveryProgress({ variant = "inline" }) {
  const fd = useFreeDelivery();
  // The side-panel card can be folded down to its title row with the chevron.
  const [open, setOpen] = useState(true);
  if (!fd.show) return null;
  const foldable = variant === "compact";

  // Folded away: the whole card disappears, leaving one small ">" to bring it back.
  if (foldable && !open) {
    return (
      <div className="fd-reopen">
        <button type="button" className="fd-toggle" aria-expanded="false" aria-label="Show free delivery card" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    );
  }

  const title = fd.unlocked
    ? (variant === "compact" ? "Free delivery unlocked" : "FREE DELIVERY UNLOCKED")
    : fd.empty
      ? `Add ${toGo(fd.remaining)} more to get ${variant === "compact" ? "free delivery" : "FREE DELIVERY"}`
      : `${toGo(fd.remaining)} to go for ${variant === "compact" ? "free delivery" : "FREE DELIVERY"}`;

  return (
    <div className={`fd fd-${variant}${fd.unlocked ? " unlocked" : ""}${foldable ? (open ? " is-open" : " is-closed") : ""}`} role="status" aria-live="polite">
      <div className="fd-head">
        {fd.unlocked ? (
          <svg {...iconProps}>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg {...iconProps}>
            <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
            <circle cx="7" cy="17" r="1.8" />
            <circle cx="17" cy="17" r="1.8" />
          </svg>
        )}
        <span className="fd-title">{title}</span>
      </div>

      {foldable ? (
        <button
          type="button"
          className="fd-toggle"
          aria-expanded={open}
          aria-label={open ? "Hide free delivery details" : "Show free delivery details"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      ) : null}

      <div
        className="fd-bar"
        role="progressbar"
        aria-label="Progress to free delivery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fd.percent)}
      >
        <span style={{ width: `${fd.percent}%` }} />
      </div>

      <div className="fd-foot">
        {fd.unlocked ? "You've qualified for free delivery" : `${rupees(fd.subtotal)} / ${rupees(fd.threshold)}`}
      </div>
    </div>
  );
}

// The one-line version for the site header: the standing rule, with the
// current amount. Hidden when the rule is off. Renders nothing until this
// component has mounted: the header hydrates inside a Suspense boundary, often
// after the store has already loaded, so its first client render must still
// match the server's empty output.
export function FreeDeliveryNote({ className, withSeparator = false }) {
  const { known, enabled, threshold } = useFreeDeliveryRule();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !known || !enabled) return null;
  return (
    <>
      {withSeparator ? <span className="utility-sep" aria-hidden="true" /> : null}
      <span className={className}>Free delivery on orders above {rupees(threshold)}</span>
    </>
  );
}
