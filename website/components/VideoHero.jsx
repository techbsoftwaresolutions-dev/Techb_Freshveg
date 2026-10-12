"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { videoPoster } from "@/lib/format";

// The Video Hero design (Admin → Settings → Website): the admin's playlist as
// the hero card's background, with their text and the CTA on the left.
//
// Two <video> elements take turns: one plays while the other has the next
// video buffered, and on `ended` they cross-fade — so there is no black gap
// between videos and the copy above them never re-renders. One video simply
// loops in a single element.
export default function VideoHero({ videos = [], text, ctaLabel }) {
  const count = videos.length;
  const refs = [useRef(null), useRef(null)];
  // Which playlist entry each element holds, and which element is showing.
  const [slots, setSlots] = useState([0, count > 1 ? 1 : 0]);
  const [active, setActive] = useState(0);
  // Reduced motion, or nothing in the list will play: the poster stands in.
  const [still, setStill] = useState(false);
  const failed = useRef(new Set());
  const heroRef = useRef(null);

  // The hero fills the screen *below* the header, so the words at its foot
  // are on screen at load. The header's height changes with the breakpoint
  // (and when the pincode bar opens), so it is measured, not assumed.
  useEffect(() => {
    const header = document.querySelector(".header");
    const hero = heroRef.current;
    if (!header || !hero) return undefined;
    const apply = () => hero.style.setProperty("--header-h", `${header.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill((s) => s || query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Start whichever element just became the visible one, from its beginning.
  useEffect(() => {
    const el = refs[active].current;
    if (!el) return;
    if (still) {
      refs.forEach((ref) => ref.current?.pause());
      return;
    }
    el.muted = true; // React does not render the attribute; autoplay needs it
    el.currentTime = 0;
    // Autoplay blocked: the poster stays up, which is the intended fallback.
    el.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, still]);

  // The next entry after `index` that has not failed to load.
  const nextPlayable = (index) => {
    for (let step = 1; step <= count; step += 1) {
      const candidate = (index + step) % count;
      if (!failed.current.has(candidate)) return candidate;
    }
    return index;
  };

  const advance = (slot) => {
    if (slot !== active || count < 2) return;
    const other = 1 - slot;
    setActive(other);
    // The element that just finished buffers the one after the new current.
    setSlots((current) => {
      const next = [...current];
      next[slot] = nextPlayable(current[other]);
      return next;
    });
  };

  const onError = (slot) => {
    failed.current.add(slots[slot]);
    if (failed.current.size >= count) {
      setStill(true);
      return;
    }
    if (slot === active) advance(slot);
    else setSlots((current) => {
      const next = [...current];
      next[slot] = nextPlayable(current[slot]);
      return next;
    });
  };

  if (!count) return null;
  const poster = videoPoster(videos[0].url);

  return (
    <section ref={heroRef} className="video-hero" style={poster ? { backgroundImage: `url(${poster})` } : undefined}>
      {(count > 1 ? [0, 1] : [0]).map((slot) => {
        const video = videos[slots[slot]];
        return (
          <video
            key={slot}
            ref={refs[slot]}
            className={`video-hero-media${slot === active ? " current" : ""}`}
            src={video.url}
            poster={videoPoster(video.url)}
            muted
            playsInline
            loop={count === 1}
            preload="auto"
            aria-hidden="true"
            onEnded={() => advance(slot)}
            onError={() => onError(slot)}
          />
        );
      })}
      <span className="video-hero-shade" aria-hidden="true" />

      <div className="video-hero-copy">
        <h1 className="video-hero-text">{text}</h1>
        {ctaLabel ? (
          <Link href="/c" className="video-hero-cta">
            {ctaLabel}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
