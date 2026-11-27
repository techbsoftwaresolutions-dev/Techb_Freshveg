"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";

// The newest live coupon, in the header strip next to the free-delivery line.
// It comes from whatever coupon the admin added last (Marketing → Coupons), so
// a new coupon shows here without a deploy. Tapping it copies the code.
export default function CouponNote() {
  const [coupon, setCoupon] = useState(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    api
      .get("/storefront/latest-coupon")
      .then((data) => alive && setCoupon(data.coupon || null))
      .catch(() => {});
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, []);

  if (!coupon?.code) return null;

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(coupon.code);
      ok = true;
    } catch {
      // Older browsers, or a page opened over plain http on the LAN.
      try {
        const field = document.createElement("textarea");
        field.value = coupon.code;
        field.setAttribute("readonly", "");
        field.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(field);
        field.select();
        ok = document.execCommand("copy");
        field.remove();
      } catch {
        ok = false;
      }
    }
    if (!ok) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  const label = coupon.value || coupon.title;

  return (
    <>
      <span className="utility-sep" aria-hidden="true" />
      <span className="utility-item utility-coupon">
        {label ? <span className="utility-coupon-text">{label} with code</span> : null}
        <button
          type="button"
          className={`utility-coupon-code${copied ? " copied" : ""}`}
          onClick={copy}
          title="Copy coupon code"
          aria-label={`Copy coupon code ${coupon.code}`}
        >
          <span>{copied ? "Copied!" : coupon.code}</span>
          {copied ? <IconCheck /> : <IconCopy />}
        </button>
        <span className="sr-only" aria-live="polite">{copied ? "Coupon code copied" : ""}</span>
      </span>
    </>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  width: 13,
  height: 13,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function IconCopy() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg {...iconProps}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
