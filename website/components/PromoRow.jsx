"use client";

import { useEffect, useRef, useState } from "react";

// The offer cards. On desktop they sit side by side; on a phone they become a
// one-card-at-a-time carousel: swipe, tap a dot, or wait for it to slide on.
export default function PromoRow({ count, children }) {
  const row = useRef(null);
  const [active, setActive] = useState(0);
  const paused = useRef(false);

  function onScroll() {
    const el = row.current;
    if (!el || !el.clientWidth) return;
    setActive(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }

  function goTo(i) {
    const el = row.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  useEffect(() => {
    if (count < 2) return undefined;
    const mobile = window.matchMedia("(max-width: 720px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = setInterval(() => {
      const el = row.current;
      if (!el || paused.current || !mobile.matches || reduced.matches || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(timer);
  }, [count]);

  return (
    <div className="promo-wrap">
      <div
        className="promo-row"
        id="offers"
        ref={row}
        onScroll={onScroll}
        onTouchStart={() => { paused.current = true; }}
        onTouchEnd={() => { setTimeout(() => { paused.current = false; }, 6000); }}
      >
        {children}
      </div>
      {count > 1 ? (
        <div className="promo-dots" role="tablist" aria-label="Offers">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Offer ${i + 1} of ${count}`}
              className={i === active ? "current" : ""}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
