"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const ROTATE_MS = 6000;

// Same target-mapping shape as BannerCarousel's hrefFor and the server-side
// heroBannerHref in page.jsx — kept local rather than shared, the same way
// BannerCarousel keeps its own copy, since it's three lines and importing a
// server-file helper into a client component isn't worth the coupling.
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

// Rotates through every admin-managed home_hero banner, not just the first
// one — the admin banner placement already supports more than one entry per
// slot (see BannerCarousel for the merchandising strip's version of this),
// this just extends the same idea to the hero image. With a single banner
// it renders as a plain static image and skips the dots entirely, since a
// one-slide "carousel" is just a picture.
export default function HeroCarousel({ banners = [] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = banners.length;
  const go = useCallback((next) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [count, paused]);

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
  const focalX = banner.focalX ?? 50;
  const focalY = banner.focalY ?? 50;
  const image = (
    <img
      src={banner.image}
      alt={banner.title || ""}
      className="hero-banner-image"
      style={{ objectPosition: `${focalX}% ${focalY}%` }}
    />
  );

  return (
    <div
      className="hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription={count > 1 ? "carousel" : undefined}
    >
      {href ? (
        <Link href={href} aria-label={banner.title} className="hero-banner-link">
          {image}
        </Link>
      ) : (
        <span className="hero-banner-link">{image}</span>
      )}

      {count > 1 ? (
        <>
          <button
            type="button"
            className="hero-carousel-nav prev"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            className="hero-carousel-nav next"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
          >
            <ChevronIcon direction="right" />
          </button>
        </>
      ) : null}

      {count > 1 ? (
        <div className="banner-dots hero-dots" role="tablist" aria-label="Choose a banner">
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

function ChevronIcon({ direction }) {
  const d = direction === "left" ? "M12.5 4.5L6 11l6.5 6.5" : "M9.5 4.5L16 11l-6.5 6.5";
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
