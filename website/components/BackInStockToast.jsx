"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { isWaiting, refresh, reset } from "@/lib/stock-alerts";

// "Tomatoes are back in stock" — a top-right toast on any page, for items the
// customer tapped "Notify me" on. Checks on load, when the tab comes back, and
// every 2 minutes while something is still being waited for.
export default function BackInStockToast({ signedIn }) {
  const [toast, setToast] = useState(null); // { items: [...], at }
  const timer = useRef(null);

  useEffect(() => {
    if (!signedIn) {
      reset();
      return undefined;
    }
    let alive = true;

    async function check() {
      if (document.hidden) return schedule(60000);
      try {
        const { ready = [] } = await refresh();
        const fresh = ready.filter((r) => r.product);
        if (fresh.length && alive) {
          setToast({ items: fresh, at: Date.now() });
          api.post("/stock-alerts/seen", { ids: fresh.map((r) => r.id) }).catch(() => {});
        }
      } catch {
        // Offline or signed out: try again later.
      }
      if (isWaiting()) schedule(120000);
    }

    function schedule(ms) {
      clearTimeout(timer.current);
      if (alive) timer.current = setTimeout(check, ms);
    }

    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVisible);
    check();
    return () => {
      alive = false;
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const [first, ...rest] = toast.items;
  return (
    <div key={toast.at} className="placed-toast stock-toast" role="status">
      <i aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </i>
      <div>
        <strong>
          {first.product.name} is back in stock
          {rest.length ? ` (+${rest.length} more)` : ""}
        </strong>
        <Link href={`/p/${first.product.slug}`} className="stock-toast-link" onClick={() => setToast(null)}>
          Add to cart →
        </Link>
      </div>
      <button type="button" className="placed-toast-close" onClick={() => setToast(null)} aria-label="Close">×</button>
    </div>
  );
}
