"use client";

import Link from "next/link";
import { img } from "@/lib/format";
import { useCallback, useEffect, useRef, useState } from "react";

const ROTATE_MS = 4500;

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

export default function BannerCarousel({ banners = [] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  const count = banners.length;
  const go = useCallback((next) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timer.current);
  }, [count, paused]);

  // Someone who prefers reduced motion gets the first banner and the dots,
  // with nothing moving underneath them.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPaused(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  if (!count) return null;

  const banner = banners[index];
  const href = hrefFor(banner.target);

  const content = (
    <div
      // Always the same button-green gradient (see .banner-slide in the
      // stylesheet), regardless of what's set in Admin — this strip stays one
      // consistent color across every promotion.
      className={`banner-slide${banner.image ? " has-image" : ""}`}
    >
      {/* The photo fills the whole card, with a green wash over its left side
          so the copy stays readable whatever the picture is. The admin's crop
          focus decides which part of the photo stays in view. */}
      {banner.image ? (
        <>
          <img
            src={img(banner.image, 1200)}
            alt=""
            className="banner-image"
            style={{ objectPosition: `${banner.focalX ?? 50}% ${banner.focalY ?? 50}%` }}
          />
          <span className="banner-shade" aria-hidden="true" />
        </>
      ) : null}
      <div className="banner-copy">
        <strong>{banner.title}</strong>
        {banner.subtitle ? <span>{banner.subtitle}</span> : null}
        {href ? (
          <span className="banner-cue">
            Shop Now
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className="banner-carousel"
      aria-roledescription="carousel"
    >
      {href ? (
        <Link href={href} aria-label={banner.title}>
          {content}
        </Link>
      ) : (
        content
      )}

      {count > 1 ? (
        <div className="banner-dots" role="tablist" aria-label="Choose a promotion">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={b.title}
              className={`banner-dot${i === index ? " current" : ""}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
