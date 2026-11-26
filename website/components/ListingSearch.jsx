"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import EmptyState from "./EmptyState";
import ProductCard from "./ProductCard";
import { MorphingSquare } from "./ui/morphing-square";

// In-page search for the listing screens ("All products" and every category).
// The search icon swaps the header for an input; typing replaces the listing
// below with live results from the same products API — same category, filters
// and sort, no navigation. Clearing or closing it brings the listing back.
// (The site header's search box on desktop talks to this too, through the
// "listing-search" event, so it also stays on the page.)

const SearchContext = createContext(null);
const MAX_RESULTS = 48;

export function SearchProvider({ className, children }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onHeaderSearch = (event) => setQuery(String(event.detail ?? ""));
    window.addEventListener("listing-search", onHeaderSearch);
    return () => window.removeEventListener("listing-search", onHeaderSearch);
  }, []);

  return (
    <SearchContext.Provider value={{ open, setOpen, query, setQuery }}>
      <div className={className}>{children}</div>
    </SearchContext.Provider>
  );
}

const useSearch = () => useContext(SearchContext);

const icon = {
  viewBox: "0 0 24 24",
  width: 22,
  height: 22,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

// Phone header: round back · title + "Delivering to" pill · round share, and a
// search row underneath (typing swaps the listing for live results; the mic
// searches by voice where the browser supports it).
export function SearchHead({ title, backHref = "/" }) {
  const { open, setOpen, query, setQuery } = useSearch();
  const input = useRef(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else if (navigator.clipboard) await navigator.clipboard.writeText(url);
    } catch {
      // the share sheet was dismissed
    }
  };

  const close = () => {
    setQuery("");
    setOpen(false);
  };

  // ✕ clears the text first (the listing comes back, the field stays ready);
  // a second tap on the empty field closes search and restores the title bar.
  const clear = () => {
    if (query) {
      setQuery("");
      input.current?.focus();
    } else {
      close();
    }
  };

  const [micOk, setMicOk] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef(null);
  useEffect(() => {
    setMicOk(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recognition.current?.abort?.();
  }, []);

  const toggleMic = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (event) => {
      const heard = (event.results?.[0]?.[0]?.transcript || "").replace(/[.?!]+$/, "").trim();
      if (heard) setQuery(heard);
    };
    recognition.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <div className={`cat-mobile-head ref${open ? " searching" : ""}`}>
      <Link href={backHref} aria-label="Back" className="cat-mobile-btn round">
        <svg {...icon}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </Link>

      {open ? (
        <>
          <div className="cat-search-field">
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && close()}
              aria-label="Search products"
              enterKeyHint="search"
            />
            {!query && micOk ? (
              <button
                type="button"
                className={`cat-field-btn${listening ? " listening" : ""}`}
                aria-label={listening ? "Stop voice search" : "Search by voice"}
                aria-pressed={listening}
                onClick={toggleMic}
              >
                <svg {...icon}>
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
                </svg>
              </button>
            ) : null}
            <button type="button" className="cat-field-btn" aria-label={query ? "Clear search" : "Close search"} onClick={clear}>
              <svg {...icon}>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </>
      ) : (
        <>
          <button type="button" className="cat-mobile-pill cat-mobile-pill-btn" aria-label="Search products" onClick={() => setOpen(true)} />
          {/* Search icon button hidden for now — the bar above opens search instead.
          <button type="button" className="cat-mobile-btn round" aria-label="Search" onClick={() => setOpen(true)}>
            <svg {...icon}>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4-4" />
            </svg>
          </button>
          */}
          <button type="button" className="cat-mobile-btn round" aria-label="Share" onClick={share}>
            <svg {...icon}>
              <path d="M12 15V4M8 8l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

// Wraps the normal listing. While a search is active the listing is only
// hidden (so closing the search restores it instantly, exactly as it was) and
// the results render in its place.
export function SearchSwap({ query: listQuery, children }) {
  const { query } = useSearch();
  const term = query.trim();
  const active = term.length > 0;

  const [debounced, setDebounced] = useState(term);
  const [state, setState] = useState({ items: [], total: 0, loading: false, error: false });

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const listKey = JSON.stringify(listQuery);
  useEffect(() => {
    if (!debounced) return undefined;
    let current = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    api
      .get("/storefront/products", { ...listQuery, page: 1, limit: MAX_RESULTS, q: debounced })
      .then((result) => {
        if (current) setState({ items: result.items || [], total: result.meta?.total ?? 0, loading: false, error: false });
      })
      .catch(() => {
        if (current) setState({ items: [], total: 0, loading: false, error: true });
      });
    return () => {
      current = false;
    };
    // listKey stands in for listQuery: the object is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, listKey]);

  // Typed but not yet searched: show what we have rather than flashing the
  // old listing back for a quarter of a second.
  const pending = active && (state.loading || debounced !== term);

  return (
    <>
      <div hidden={active}>{children}</div>

      {active ? (
        <section className="search-results" aria-live="polite" aria-busy={pending || undefined}>
          {state.error ? (
            <EmptyState icon="box" title="Search isn't working right now">
              Check your connection and try again.
            </EmptyState>
          ) : state.items.length ? (
            <>
              <h2 className="search-results-head">
                Search results
                <span>
                  {state.total} for “{debounced}”
                </span>
              </h2>
              <div className={`product-grid wide${pending ? " is-pending" : ""}`}>
                {state.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {state.total > MAX_RESULTS ? (
                <p className="search-results-note">Showing the first {MAX_RESULTS}. Add more letters to narrow it down.</p>
              ) : null}
            </>
          ) : pending ? (
            <div className="more-status" role="status">
              <MorphingSquare className="sm" message="Searching…" messagePlacement="right" />
            </div>
          ) : (
            <EmptyState icon="box" title="No products found">
              Try searching for another product.
            </EmptyState>
          )}
        </section>
      ) : null}
    </>
  );
}
