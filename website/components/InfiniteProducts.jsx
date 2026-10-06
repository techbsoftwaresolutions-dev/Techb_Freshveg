"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import ProductCard from "./ProductCard";
import { MorphingSquare } from "./ui/morphing-square";

// Phone only: instead of page links, the rest of the catalogue loads as the
// shopper nears the bottom. The server has already rendered the first page;
// this appends pages startPage..pages with the very same query, so filters,
// sort and category carry over with no second copy of that logic. Above the
// phone breakpoint it does nothing — the numbered pager keeps working.
const PHONE = "(max-width: 720px)";

export default function InfiniteProducts({ query, startPage, pages, seenIds = [] }) {
  const [phone, setPhone] = useState(false);
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(startPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef(null);
  const seen = useRef(new Set(seenIds));

  useEffect(() => {
    const media = window.matchMedia(PHONE);
    const sync = () => setPhone(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const done = next > pages;

  useEffect(() => {
    if (!phone || done || failed || !sentinel.current) return undefined;

    const load = async () => {
      setLoading(true);
      try {
        const result = await api.get("/storefront/products", { ...query, page: next });
        // A product can shift between pages while someone scrolls (new stock,
        // a re-sort); never show the same card twice.
        const fresh = (result.items || []).filter((item) => !seen.current.has(item.id));
        fresh.forEach((item) => seen.current.add(item.id));
        setItems((current) => [...current, ...fresh]);
        setNext(next + 1);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    };

    // Starts loading well before the last row is reached, so scrolling never
    // stalls; appended cards go below the viewport, so the scroll position
    // is not disturbed.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) load();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [phone, done, failed, loading, next, query]);

  if (!phone) return null;

  return (
    <>
      {items.length ? (
        <div className="product-grid wide more-products">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}

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
