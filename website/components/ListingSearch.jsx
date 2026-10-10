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

// Phone header: back · title · search icon — or back · input · ✕ once open.
export function SearchHead({ title, backHref = "/" }) {
  const { open, setOpen, query, setQuery } = useSearch();
  const input = useRef(null);
  const [railOpen, setRailOpen] = useState(true);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    const onState = (event) => setRailOpen(Boolean(event.detail));
    window.addEventListener("cat-rail-state", onState);
    return () => window.removeEventListener("cat-rail-state", onState);
  }, []);

  const close = () => {
    setQuery("");
    setOpen(false);
  };

  // ✕ clears the text first (listing comes back, field stays ready); a second
  // tap on the empty field closes it and restores the normal header.
  const clear = () => {
    if (query) {
      setQuery("");
      input.current?.focus();
    } else {
      close();
    }
  };

  return (
    <div className={`cat-mobile-head${open ? " searching" : ""}`}>
      <Link href={backHref} aria-label="Back" className="cat-mobile-btn">
        <svg {...icon}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </Link>

      {open ? (
        <>
          <label className="cat-search-field">
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && close()}
              placeholder="Search products"
              aria-label="Search products"
              enterKeyHint="search"
            />
          </label>
          <button type="button" className="cat-mobile-btn" aria-label={query ? "Clear search" : "Close search"} onClick={clear}>
            <svg {...icon}>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </>
      ) : (
        <>
          {/* The title opens the category drawer (RailDrawer) — no menu icon. */}
          <button
            type="button"
            className="cat-mobile-title cat-title-toggle"
            onClick={() => window.dispatchEvent(new Event("cat-rail-toggle"))}
            aria-expanded={railOpen}
            aria-label={`${title} — show categories`}
          >
            <span className="cat-title-text">{title}</span>
            <svg viewBox="0 0 10 10" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`cat-title-caret${railOpen ? " up" : ""}`}>
              <path d="M2 3.5L5 6.5L8 3.5" />
            </svg>
          </button>
          <button type="button" className="cat-mobile-btn" aria-label="Search" onClick={() => setOpen(true)}>
            <svg {...icon}>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4-4" />
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
