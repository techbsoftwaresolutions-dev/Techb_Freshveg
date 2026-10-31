"use client";

import Link from "next/link";
import { img } from "@/lib/format";
import { useEffect, useRef, useState } from "react";

const STORIES = [
  { tag: "The fresh edit", title: "A little fresher.", accent: "Every single day.", description: "Colourful vegetables, juicy fruit and good food for your table. Your everyday shop starts here.", cta: "Shop fresh picks", match: /vegetable|fruit/i, tone: "forest", label: "Fresh picks", note: "Good food. Great beginnings." },
  { tag: "The everyday edit", title: "Small essentials.", accent: "A well-stocked home.", description: "From breakfast favourites to pantry staples, bring your weekly shopping list together in one basket.", cta: "Explore essentials", match: /grocery|daily/i, tone: "cream", label: "Everyday essentials", note: "Your week, a little easier." },
  { tag: "The home edit", title: "More time for you.", accent: "We’ll bring the basket.", description: "Household helpers, personal care and all the little things that keep your day moving.", cta: "Shop home essentials", match: /household|personal|home care/i, tone: "peach", label: "For your home", note: "A happy home starts here." },
];

function hrefFor(target) {
  if (target?.kind === "category") return `/c/${target.value}`;
  if (target?.kind === "product") return `/p/${target.value}`;
  if (target?.kind === "search") return `/search?q=${encodeURIComponent(target.value)}`;
  if (target?.kind === "url" && /^(https?:\/\/|\/(?!\/))/.test(target.value)) return target.value;
  return null;
}

export default function HeroCarousel({ banners = [], categories = [], storeName, fallbackArt }) {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touch = useRef(null);
  const slides = banners.length > 1 ? banners : STORIES;
  const count = slides.length;
  const active = index % count;
  const go = (next) => setIndex((next + count) % count);
  const stopped = reduced || hidden;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(query.matches);
    const visibility = () => setHidden(document.hidden);
    motion(); visibility();
    query.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => { query.removeEventListener("change", motion); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    if (stopped || count < 2) return;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % count), 4500);
    return () => clearTimeout(timer);
  }, [active, count, stopped]);

  return (
    <section className="market-carousel" aria-label="Discover Hosur Basket" aria-roledescription="carousel"
      onTouchStart={(event) => { touch.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => { if (touch.current !== null) { const delta = touch.current - event.changedTouches[0].clientX; if (Math.abs(delta) > 50) go(active + (delta > 0 ? 1 : -1)); } touch.current = null; }}>
      <div aria-live={stopped ? "polite" : "off"}>
        {slides.map((entry, i) => {
          const story = STORIES[i % STORIES.length];
          const banner = banners.length > 1 ? entry : (i === 0 ? banners[0] : null);
          const category = categories.find((cat) => story.match.test(cat.name));
          const photo = banner?.image || category?.image;
          const href = hrefFor(banner?.target) || (category ? `/c/${category.slug}` : "/c");
          return (
            <div key={banner?.id || i} hidden={i !== active} className={`market-slide market-${story.tone}`} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
              <div className="market-copy">
                <h1>{banner?.title || story.title}<span>{story.accent}</span></h1>
                <p>{story.description}</p>
                <div className="market-actions"><Link href={href} className="market-shop">{story.cta}<span aria-hidden="true">↗</span></Link><Link href="/c" className="market-browse">All categories <span aria-hidden="true">→</span></Link></div>
                <div className="market-signoff"><span aria-hidden="true">✦</span> Your neighbourhood basket <span>•</span> {storeName || "Hosur"}</div>
              </div>
              <div className={`market-visual${photo ? " has-photo" : ""}`}>
                <span className="market-orbit" aria-hidden="true" />
                <div className="market-photo">{photo ? <img src={img(photo, 1400)} alt={banner?.title || category?.name || ""} fetchPriority={i === 0 ? "high" : undefined} loading={i === 0 ? "eager" : "lazy"} style={{ objectPosition: `${banner?.focalX ?? 50}% ${banner?.focalY ?? 50}%` }} /> : fallbackArt}</div>
                <div className="market-seal"><span>HOSUR BASKET</span><strong>Everyday<br />goodness.</strong><span>FRESH FINDS · HAPPY HOMES</span></div>
                <span className="market-caption">{story.note}</span>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="market-edge-arrow market-edge-prev" aria-label="Previous slide" onClick={() => go(active - 1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
      </button>
      <button type="button" className="market-edge-arrow market-edge-next" aria-label="Next slide" onClick={() => go(active + 1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
      </button>
    </section>
  );
}
