"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { img, rupees } from "@/lib/format";

// The new-offer popup: shown once when someone opens the website (on any
// screen size), for 2 seconds, then it hides by itself. It has a close button
// for anyone who wants it gone sooner.
//
// What it shows, in order:
// 1. A live "App launch" banner from the admin (Marketing -> Banners), so the
//    offer, picture and where it leads are set there without a deploy.
// 2. Otherwise the newest live coupon (Marketing -> Coupons), the same one the
//    header strip shows.
// Nothing live -> no popup.

const SHOW_FOR_MS = 2000;
const SEEN_KEY = "offerPopup:seen"; // once per browser session (tab group)
// Pages where a popup would get in the way of something being done.
const QUIET = ["/checkout", "/login", "/cart", "/orders/"];

function hrefFor(target) {
  if (!target || !target.kind || target.kind === "none") return null;
  if (target.kind === "category") return `/c/${target.value}`;
  if (target.kind === "product") return `/p/${target.value}`;
  if (target.kind === "search") return `/search?q=${encodeURIComponent(target.value)}`;
  if (target.kind === "url" && /^(https?:\/\/|\/(?!\/))/.test(target.value)) return target.value;
  return null;
}

export default function OfferPopup() {
  const pathname = usePathname();
  const [offer, setOffer] = useState(null); // { kind: "banner", banner } | { kind: "coupon", coupon }
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return undefined;
    } catch {
      // storage blocked: still show it, just possibly again next page
    }
    if (QUIET.some((p) => pathname?.startsWith(p))) return undefined;

    let alive = true;
    (async () => {
      let found = null;
      try {
        const { banners = [] } = await api.get("/banners/live", { placement: "app_launch" });
        if (banners[0]) found = { kind: "banner", banner: banners[0] };
      } catch {
        // no banner service: try the coupon
      }
      if (!found) {
        try {
          const { coupon } = await api.get("/storefront/latest-coupon");
          if (coupon?.code) found = { kind: "coupon", coupon };
        } catch {
          // nothing to show
        }
      }
      if (!alive || !found) return;
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // ignore
      }
      setOffer(found);
      setOpen(true);
      if (found.kind === "banner") {
        api.post(`/banners/${found.banner.id}/track`, { event: "impression" }).catch(() => {});
      }
    })();
    return () => {
      alive = false;
    };
    // Only on the first page of the visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide by itself after 2 seconds.
  useEffect(() => {
    if (!open) return undefined;
    timer.current = setTimeout(() => setOpen(false), SHOW_FOR_MS);
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || !offer) return null;

  const close = () => setOpen(false);

  if (offer.kind === "banner") {
    const b = offer.banner;
    const href = hrefFor(b.target);
    const picture = b.mobileImage || b.image;
    const body = (
      <>
        {picture ? (
          <picture>
            {b.mobileImage && b.image ? <source media="(min-width: 721px)" srcSet={img(b.image, 900)} /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(picture, 720)} alt={b.title} className="op-img" />
          </picture>
        ) : null}
        <span className="op-copy">
          <span className="op-tag">New offer</span>
          <strong>{b.title}</strong>
          {b.subtitle ? <span>{b.subtitle}</span> : null}
        </span>
      </>
    );
    return (
      <div className="op-wrap" role="dialog" aria-label="New offer">
        <div className="op-card" style={b.backgroundColor ? { background: b.backgroundColor } : undefined}>
          <button type="button" className="op-close" onClick={close} aria-label="Close offer">
            ×
          </button>
          {href ? (
            <Link
              href={href}
              className="op-body"
              onClick={() => {
                api.post(`/banners/${b.id}/track`, { event: "click" }).catch(() => {});
                close();
              }}
            >
              {body}
            </Link>
          ) : (
            <div className="op-body">{body}</div>
          )}
          <span className="op-timer" style={{ animationDuration: `${SHOW_FOR_MS}ms` }} aria-hidden="true" />
        </div>
      </div>
    );
  }

  const c = offer.coupon;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopied(true);
    } catch {
      // clipboard blocked: the code is on screen to type
    }
  };
  return (
    <div className="op-wrap" role="dialog" aria-label="New offer">
      <div className="op-card op-coupon">
        <button type="button" className="op-close" onClick={close} aria-label="Close offer">
          ×
        </button>
        <div className="op-body">
          <span className="op-badge" aria-hidden="true">%</span>
          <span className="op-copy">
            <span className="op-tag">{(c.badge || "").trim() ? `${c.badge.trim()} offer` : "New offer"}</span>
            {/* The coupon's value only when it reads like a saving ("₹50 off",
                "10%"); otherwise its title. */}
            <strong>{/[\d%₹]/.test(c.value || "") ? c.value.trim() : (c.title || "Special offer").trim()}</strong>
            <span>
              Use code{" "}
              <button type="button" className="op-code" onClick={copy} title="Copy code">
                {copied ? "Copied!" : c.code}
              </button>{" "}
              at checkout
            </span>
            {c.minCartValue > 0 ? <small className="op-min">On orders above {rupees(c.minCartValue)}</small> : null}
          </span>
        </div>
        <span className="op-timer" style={{ animationDuration: `${SHOW_FOR_MS}ms` }} aria-hidden="true" />
      </div>
    </div>
  );
}
