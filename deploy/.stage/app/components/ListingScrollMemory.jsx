"use client";

import { useEffect } from "react";

// Brings a product listing back to where the shopper was after they open a
// product and come back, instead of the top of the category.
//
// - Clicking a product on the listing marks "came from here" and saves where
//   the list was scrolled (the page itself on a phone; on wide screens the
//   product column scrolls in its own box).
// - Coming back to that same listing (same path and filters) puts the scroll
//   back. More products loaded by infinite scroll are put back first by
//   InfiniteProducts, from the same tab's storage, so the spot exists again.
// - Opening a listing any other way (menu, a link, a refresh) starts at the top.

export const listingKey = () =>
  typeof window === "undefined" ? "" : `listing:${window.location.pathname}${window.location.search}`;
const RETURN_KEY = "listing:return";

// The element the product list scrolls in: the column box on wide screens,
// otherwise the page.
function scroller() {
  const box = document.querySelector(".split.cat-layout.has-rail > div");
  if (box) {
    const style = getComputedStyle(box);
    if ((style.overflowY === "auto" || style.overflowY === "scroll") && box.scrollHeight > box.clientHeight) return box;
  }
  return null; // the window
}
const getY = (box) => (box ? box.scrollTop : window.scrollY);
const setY = (box, y) => (box ? (box.scrollTop = y) : window.scrollTo(0, y));

const read = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the list just starts at the top next time
  }
};

// True when this listing is being shown because the shopper came back to it
// from one of its products. InfiniteProducts asks this before restoring pages.
export function isReturning() {
  try {
    return sessionStorage.getItem(RETURN_KEY) === listingKey();
  } catch {
    return false;
  }
}

export default function ListingScrollMemory() {
  useEffect(() => {
    const key = listingKey();

    // Remember the spot when a product is opened from this listing.
    const onClick = (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/p/")) return;
      const here = listingKey(); // filters may have changed since this mounted
      const box = scroller();
      write(`${here}:scroll`, { y: getY(box), box: Boolean(box) });
      try {
        sessionStorage.setItem(RETURN_KEY, here);
      } catch {
        // ignore
      }
    };
    document.addEventListener("click", onClick, true);

    // Coming back: put the scroll back. The page is still filling in (the
    // extra products, images), so keep trying for a moment until it holds,
    // and stop at once if the shopper scrolls themselves.
    let stop = false;
    const cancel = () => {
      stop = true;
    };
    if (isReturning()) {
      const target = read(`${key}:scroll`)?.y || 0;
      const started = performance.now();
      window.addEventListener("wheel", cancel, { passive: true, once: true });
      window.addEventListener("touchstart", cancel, { passive: true, once: true });
      window.addEventListener("keydown", cancel, { once: true });
      const tick = () => {
        if (stop) return;
        const box = scroller();
        setY(box, target);
        const reached = Math.abs(getY(box) - target) < 2;
        if (performance.now() - started < 2500 && !(reached && performance.now() - started > 600)) {
          requestAnimationFrame(tick);
        } else {
          try {
            sessionStorage.removeItem(RETURN_KEY);
          } catch {
            // ignore
          }
        }
      };
      requestAnimationFrame(tick);
    }

    return () => {
      stop = true;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, []);

  return null;
}
