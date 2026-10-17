"use client";

import { memo, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import ProductCard from "./ProductCard";
import { MorphingSquare } from "./ui/morphing-square";

// On every screen size: instead of page links, the rest of the catalogue loads
// as the shopper nears the bottom. The server has already rendered the first
// page; this appends pages startPage..pages with the very same query, so
// filters, sort and category carry over with no second copy of that logic.
//
// Every fetched page is kept as its own chunk (a grid of up to 20 cards). A
// chunk that has scrolled far out of view swaps its cards for an empty box of
// the same height, and puts them back as it comes near again — so however far
// someone scrolls, only the few chunks around the viewport are mounted.
// How far outside the viewport a chunk stays mounted. Generous, so cards are
// back well before they scroll into sight and fast flings never show a gap.
const KEEP_MOUNTED = "1500px 0px";

export default function InfiniteProducts({ query, startPage, pages, seenIds = [] }) {
  const [chunks, setChunks] = useState([]);
  const [next, setNext] = useState(startPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef(null);
  const inFlight = useRef(false); // one request at a time, whatever the observer says
  const seen = useRef(new Set(seenIds));

  const done = next > pages;

  useEffect(() => {
    if (done || failed || !sentinel.current) return undefined;

    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      try {
        const result = await api.get("/storefront/products", { ...query, page: next });
        // A product can shift between pages while someone scrolls (new stock,
        // a re-sort); never show the same card twice.
        const fresh = (result.items || []).filter((item) => !seen.current.has(item.id));
        fresh.forEach((item) => seen.current.add(item.id));
        if (fresh.length) setChunks((current) => [...current, { page: next, items: fresh }]);
        setNext(next + 1);
      } catch {
        setFailed(true);
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    };

    // Starts loading well before the last row is reached, so scrolling never
    // stalls; appended cards go below the viewport, so the scroll position
    // is not disturbed.
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && load(), {
      rootMargin: "600px 0px",
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [done, failed, next, query]);

  return (
    <>
      {chunks.map((chunk) => (
        <Chunk key={chunk.page} items={chunk.items} />
      ))}

      {!done && !failed ? (
        <div ref={sentinel} className="more-status" role="status" aria-live="polite">
          {loading ? <MorphingSquare className="sm" /> : null}
        </div>
      ) : null}

      {failed ? (
        <div className="more-status">
          <button type="button" className="btn sm" onClick={() => setFailed(false)}>
            Couldn't load more. Try again
          </button>
        </div>
      ) : null}
    </>
  );
}

// One fetched page. Memoised: appending a page must not re-render the pages
// before it — their items never change.
const Chunk = memo(function Chunk({ items }) {
  const box = useRef(null);
  const height = useRef(0);
  const [near, setNear] = useState(true);

  useEffect(() => {
    const el = box.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Measure while the cards are still there, so the stand-in is exact
        // and nothing below it moves.
        if (!entry.isIntersecting) height.current = el.offsetHeight;
        setNear(entry.isIntersecting);
      },
      { rootMargin: KEEP_MOUNTED }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className="product-grid wide more-products"
      data-chunk={near ? "mounted" : "placeholder"}
      style={near ? undefined : { height: height.current }}
    >
      {near ? items.map((product) => <ProductCard key={product.id} product={product} />) : null}
    </div>
  );
});
