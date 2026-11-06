"use client";

import Link from "next/link";
import { categoryImage, img } from "@/lib/format";
import { useCallback, useEffect, useRef, useState } from "react";

const ROTATE_MS = 4500;

const BUNDLED_ART = ["/banner-art/banner-1.webp", "/banner-art/banner-2.webp", "/banner-art/banner-3.webp"];

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

export default function BannerCarousel({ banners = [], categories = [] }) {
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
  const produce = categories
    .filter((category) => categoryImage(category) && /fruit|vegetable|produce|grocery/i.test(category.name))
    .concat(categories.filter((category) => categoryImage(category)))
    .filter((category, i, all) => all.findIndex((item) =>
      (item.id && item.id === category.id) ||
      (item.slug && item.slug === category.slug) ||
      item.name === category.name
    ) === i);
  const featuredProduce = produce[index % (produce.length || 1)];

  // "First order? 30% off" -> the offer part ("30% off") is lifted onto its own
  // line in yellow, the way the promotion is meant to read.
  const split = String(banner.title || "").match(/^(.*?)(\d+\s*%\s*off|₹\s*\d+(?:\s*off)?)(.*)$/i);
  const hlParts = split ? split[2].trim().match(/^(.*?)(\s+off)$/i) : null;
  // A coupon-looking word in the subtitle (FIRST30) is picked out in yellow.
  const subtitleParts = String(banner.subtitle || "").split(/(\b[A-Z]{3,}\d+\b)/);
  // Without a "30% off" part, the last word of the headline is set in yellow script.
  const titleText = String(banner.title || "").trim();
  const titleWords = titleText.split(/\s+/);
  const plainLead = titleWords.length > 1 ? titleWords.slice(0, -1).join(" ") : "";
  const plainLast = titleWords[titleWords.length - 1] || "";
  // The banner's own photo (uploaded in the admin) wins. Until one is uploaded the
  // slide uses the bundled basket pictures in /public/banner-art, one per slide.
  const photo = banner.image
    ? img(banner.image, 1400)
    : BUNDLED_ART[index % BUNDLED_ART.length] || (featuredProduce ? img(categoryImage(featuredProduce), 1000) : "");

  const content = (
    <div className="bn-slide">
      <div className="bn-copy">
        <span className="bn-kicker">
          <b>Hosur Basket</b>
          <i className="bn-sep" />
          <span>Fresh offers</span>
        </span>

        <strong className="bn-title">
          {split ? (
            <>
              {split[1].trim() ? <span className="bn-title-lead">{split[1].trim()}</span> : null}
              <span className="bn-hl">
                {hlParts ? (
                  <>
                    <span className="bn-num">{hlParts[1]}</span>
                    <span className="bn-off">{hlParts[2].trim()}</span>
                  </>
                ) : (
                  <span className="bn-num">{split[2].trim()}</span>
                )}
              </span>
              {split[3].trim() ? <span className="bn-title-lead">{split[3].trim()}</span> : null}
            </>
          ) : plainLead ? (
            <span className="bn-title-lead bn-plain">
              {plainLead} <span className="bn-script">{plainLast}</span>
            </span>
          ) : (
            <span className="bn-title-lead bn-plain">{titleText}</span>
          )}
        </strong>

        {banner.subtitle ? (
          <span className="bn-sub">
            <span>
              {subtitleParts.map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}
            </span>
          </span>
        ) : null}

        <div className="bn-actions">
          {href ? (
            <span className="bn-cta">
              Shop Now
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </span>
          ) : null}
          <ul className="bn-trust" aria-hidden="true">
            <li>
              <span className="bn-ico">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 19C5 10 10.5 4.5 20 4.5c0 9.5-5.5 14.5-15 14.5z" />
                  <path d="M5 19 14 10" />
                </svg>
              </span>
              Fresh<br />Products
            </li>
            <li>
              <span className="bn-ico">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2.8 4.5 5.8v5.7c0 4.6 3.1 8 7.5 9.6 4.4-1.6 7.5-5 7.5-9.6V5.8z" />
                  <path d="M8.6 12.2l2.5 2.5 4.6-4.9" />
                </svg>
              </span>
              Trusted<br />Quality
            </li>
            <li>
              <span className="bn-ico">
                <svg viewBox="0 0 28 24" width="38" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 8h4M0 11h3M2 14h3" />
                  <path d="M7 6.5h10V17H7zM17 10h4.2l2.8 3.2V17H17" />
                  <circle cx="11" cy="18" r="2" fill="#23901c" />
                  <circle cx="20.5" cy="18" r="2" fill="#23901c" />
                </svg>
              </span>
              Fast<br />Delivery
            </li>
          </ul>
        </div>
      </div>

      <svg className="bn-wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id="bnWave" clipPathUnits="objectBoundingBox">
            <path d="M0.07 0C0.13 0.15 0.12 0.32 0.06 0.45C0 0.58 0 0.72 0.1 0.84C0.17 0.93 0.23 0.98 0.3 1L1 1L1 0Z" />
          </clipPath>
        </defs>
        <path className="bn-wave-glow" d="M7 0C13 15 12 32 6 45C0 58 0 72 10 84C17 93 23 98 30 100" />
        <path className="bn-wave-rim" d="M7 0C13 15 12 32 6 45C0 58 0 72 10 84C17 93 23 98 30 100" />
      </svg>
      <div className="bn-visual" aria-hidden="true">
        {photo ? <img key={photo} className="bn-photo" src={photo} alt="" /> : null}
      </div>
    </div>
  );

  return (
    <div className="banner-carousel bn" aria-roledescription="carousel">
      {href ? (
        <Link href={href} aria-label={banner.title}>
          {content}
        </Link>
      ) : (
        content
      )}

      {count > 1 ? (
        <>
          <div className="bn-dots" role="tablist" aria-label="Choose a promotion">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={b.title}
                className={`bn-dot${i === index ? " current" : ""}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
