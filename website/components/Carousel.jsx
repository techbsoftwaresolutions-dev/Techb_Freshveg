"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A horizontal product rail with its own controls.
//
// The row itself is plain server-rendered HTML that already scrolls — the
// buttons are an enhancement on top. If this never hydrates, the rail still
// works by touch, trackpad and keyboard; only the arrows are missing.
export default function Carousel({ children, label, className = "", railClassName = "" }) {
  const ref = useRef(null);
  const reduceMotion = useRef(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // A one-pixel tolerance: fractional widths mean scrollLeft rarely lands
    // exactly on the maximum, which would leave the arrow enabled forever.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    measure();
    el.addEventListener("scroll", measure, { passive: true });

    // The row can start fitting, or stop fitting, when the window resizes.
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const readMotion = () => {
      reduceMotion.current = motion.matches;
    };
    readMotion();
    motion.addEventListener("change", readMotion);

    return () => {
      el.removeEventListener("scroll", measure);
      motion.removeEventListener("change", readMotion);
      observer.disconnect();
    };
  }, [measure]);

  const step = (direction) => {
    const el = ref.current;
    if (!el) return;

    // A page at a time, less one card, so the card at the edge stays visible
    // and gives the eye something to carry across.
    const distance = Math.max(el.clientWidth - 232, 232);
    const from = el.scrollLeft;
    const to = Math.max(0, Math.min(from + direction * distance, el.scrollWidth - el.clientWidth));
    if (to === from) return;

    // Animated here rather than with scrollBy({behavior:"smooth"}) or CSS
    // scroll-behavior. Both are accepted and then quietly ignored by some
    // engines, which leaves the button doing nothing at all — a dead control
    // with no error to explain it. Assigning scrollLeft always moves, so the
    // easing is done by hand and the result works everywhere.
    // A hidden document gets no animation frames at all, so a tween here
    // would never advance and the rail would simply not move. Jump instead —
    // and likewise when the reader has asked for less motion.
    if (reduceMotion.current || document.hidden) {
      el.scrollLeft = to;
      measure();
      return;
    }

    const start = performance.now();
    const DURATION = 320;
    const tick = (now) => {
      const t = Math.min((now - start) / DURATION, 1);
      // easeOutCubic
      el.scrollLeft = from + (to - from) * (1 - (1 - t) ** 3);
      if (t < 1) requestAnimationFrame(tick);
      // The arrows are re-checked here rather than left to the scroll event:
      // this moved the rail itself, and a scroll event is not guaranteed to
      // arrive (a hidden document suppresses them entirely).
      else measure();
    };
    requestAnimationFrame(tick);
  };

  // Nothing to scroll: no controls at all rather than two dead buttons.
  const scrollable = !(atStart && atEnd);

  return (
    <div className={`carousel ${className}`.trim()}>
      <button
        type="button"
        className="carousel-btn prev"
        onClick={() => step(-1)}
        hidden={!scrollable || atStart}
        aria-label={`Scroll ${label} left`}
      >
        ‹
      </button>

      <div className={`rail ${railClassName}`.trim()} ref={ref}>
        {children}
      </div>

      <button
        type="button"
        className="carousel-btn next"
        onClick={() => step(1)}
        hidden={!scrollable || atEnd}
        aria-label={`Scroll ${label} right`}
      >
        ›
      </button>
    </div>
  );
}
