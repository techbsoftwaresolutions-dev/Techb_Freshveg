"use client";

import Link from "next/link";
import { img } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import lettuce from "@/assets/banner-organic-lettuce.webp";
import rows from "@/assets/banner-farm-rows.webp";
import crate from "@/assets/banner-harvest-crate.webp";

const ROTATE_MS = 7000;

// The strip's own photography, one per slide in order. A banner that has its
// own image uploaded in the admin shows that instead.
const BACKDROPS = [lettuce.src, rows.src, crate.src];

// Where a banner's target points. The admin stores a kind and a value rather
// than a URL, so the shape of the site can change without rewriting banners.
function hrefFor(target) {
  if (!target || !target.kind || target.kind === "none") return null;
  switch (target.kind) {
    case "category":
      return `/c/${target.value}`;
    case "product":
      return `/p/${target.value}`;
    case "search":
      return `/search?q=${encodeURIComponent(target.value)}`;
    case "url":
      return target.value;
    default:
      return null;
  }
}

// "Fresh picks, every morning" -> ["Fresh picks,", "every morning"]: the
// headline's second half takes the light-green accent. A title with no
// natural break stays on one colour.
function splitTitle(title = "") {
  const match = title.match(/^(.+?[,?!:])\s+(.+)$/);
  return match ? [match[1], match[2]] : [title, ""];
}

export default function BannerCarousel({ banners = [] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [still, setStill] = useState(false); // prefers-reduced-motion
  const touch = useRef(null);

  const count = banners.length;
  const go = (next) => setIndex(((next % count) + count) % count);

  // Someone who prefers reduced motion gets the first banner and the dots,
  // with nothing moving underneath them.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // One timeout per slide, so picking a slide by hand gives it the full
  // seven seconds rather than whatever was left on the previous one.
  useEffect(() => {
    if (count < 2 || hovered || focused || still) return undefined;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearTimeout(timer);
  }, [index, count, hovered, focused, still]);

  if (!count) return null;

  return (
    <section
      className={`promo-carousel${still ? " still" : ""}`}
      aria-roledescription="carousel"
      aria-label="Promotions"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setFocused(false)}
      onTouchStart={(event) => (touch.current = event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (touch.current == null) return;
        const dx = event.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      {banners.map((banner, i) => {
        const href = hrefFor(banner.target);
        const [lead, accent] = splitTitle(banner.title);
        const current = i === index;
        const photo = banner.image ? img(banner.image, 1600) : BACKDROPS[i % BACKDROPS.length];
        const Wrap = href ? Link : "div";
        return (
          <Wrap
            key={banner.id || i}
            {...(href ? { href } : {})}
            className={`promo-slide${current ? " current" : ""}`}
            aria-hidden={current ? undefined : true}
            tabIndex={current ? undefined : -1}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${banner.title}`}
          >
            <img
              src={photo}
              alt=""
              className="promo-photo"
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              style={banner.image ? { objectPosition: `${banner.focalX ?? 50}% ${banner.focalY ?? 50}%` } : undefined}
            />
            <span className="promo-shade" aria-hidden="true" />
            <div className="promo-copy">
              <h2 className="promo-title">
                {lead}
                {accent ? <span>{accent}</span> : null}
              </h2>
              {banner.subtitle ? <p>{banner.subtitle}</p> : null}
              {href ? (
                <span className="promo-cue">
                  Shop Now
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              ) : null}
            </div>
          </Wrap>
        );
      })}

      {count > 1 ? (
        <div className="promo-dots" role="tablist" aria-label="Choose a promotion">
          {banners.map((banner, i) => (
            <button
              key={banner.id || i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={banner.title}
              className={`promo-dot${i === index ? " current" : ""}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
