"use client";

import { useEffect, useRef, useState } from "react";

// The offer cards as one sliding row on every screen: three in view on a
// desktop, two on a tablet, one on a phone. Arrows (desktop), swipe, the dots,
// or wait — it slides on by itself, one card at a time, and loops back.
export default function PromoRow({ count, children }) {
  const row = useRef(null);
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: count <= 1 });
  const [stops, setStops] = useState(count); // positions the row can rest at
  const paused = useRef(false);

  // Width of one card plus the gap: one "step" of the slider.
  function step() {
    const el = row.current;
    const first = el?.children[0];
    if (!el || !first) return 0;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    return first.getBoundingClientRect().width + gap;
  }

  function onScroll() {
    const el = row.current;
    const s = step();
    if (!el || !s) return;
    const inView = Math.max(1, Math.round((el.clientWidth + 1) / s));
    const n = Math.max(1, count - inView + 1);
    setStops(n);
    setActive(Math.min(n - 1, Math.max(0, Math.round(el.scrollLeft / s))));
    setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }

  function goTo(i) {
    const el = row.current;
    if (el) el.scrollTo({ left: i * step(), behavior: "smooth" });
  }

  function move(dir) {
    const el = row.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (dir > 0 && atEnd) return el.scrollTo({ left: 0, behavior: "smooth" });
    el.scrollBy({ left: dir * step(), behavior: "smooth" });
  }

  useEffect(() => {
    onScroll();
    window.addEventListener("resize", onScroll);
    return () => window.removeEventListener("resize", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // Slides on by itself; pauses while the pointer is over it or a finger is on it.
  useEffect(() => {
    if (count < 2) return undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = setInterval(() => {
      const el = row.current;
      if (!el || paused.current || reduced.matches || document.hidden) return;
      if (el.scrollWidth <= el.clientWidth + 4) return; // everything already in view
      move(1);
    }, 4500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const pause = () => { paused.current = true; };
  const resume = () => { paused.current = false; };

  return (
    <div className="promo-wrap" onMouseEnter={pause} onMouseLeave={resume}>
      <div
        className="promo-row promo-slider"
        id="offers"
        ref={row}
        onScroll={onScroll}
        onTouchStart={pause}
        onTouchEnd={() => { setTimeout(resume, 6000); }}
      >
        {children}
      </div>
      {count > 1 ? (
        <>
          <button type="button" className="carousel-btn prev promo-arrow" onClick={() => move(-1)} hidden={edges.start} aria-label="Previous offer">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          <button type="button" className="carousel-btn next promo-arrow" onClick={() => move(1)} hidden={edges.start && edges.end} aria-label="Next offer">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </button>
          {stops > 1 ? <div className="promo-dots" role="tablist" aria-label="Offers">
            {Array.from({ length: stops }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Offers, position ${i + 1} of ${stops}`}
                className={i === active ? "current" : ""}
                onClick={() => goTo(i)}
              />
            ))}
          </div> : null}
        </>
      ) : null}
    </div>
  );
}
