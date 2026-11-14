"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";

// "Order delivered successfully" — a top-right toast on whatever page the
// shopper is on, when one of their orders is delivered. Shown once per order
// (remembered in this browser; the order page uses the same key, so the two
// never both show it). Checks every 30s while an order is on its way, every
// 2 minutes otherwise, and straight away when the tab comes back into view.
const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];
const RECENT_MS = 24 * 60 * 60 * 1000; // older deliveries are not announced
const seenKey = (id) => `commerce.web.deliveredToast.${id}`;

export default function DeliveredToast({ signedIn }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!signedIn) return undefined;
    let alive = true;

    async function check() {
      if (document.hidden) return schedule(30000);
      let live = false;
      try {
        const { items = [] } = await api.get("/orders/mine", { limit: 5 }, { force: true });
        live = items.some((o) => !CLOSED.includes(o.status));
        for (const order of items) {
          if (order.status !== "DELIVERED") continue;
          const at = new Date(order.delivery?.deliveredAt || order.updatedAt || 0).getTime();
          if (!at || Date.now() - at > RECENT_MS) continue;
          // The order's own page shows it there instead.
          if (window.location.pathname === `/orders/${order.id}`) continue;
          let seen = true;
          try {
            seen = localStorage.getItem(seenKey(order.id)) === "1";
            if (!seen) localStorage.setItem(seenKey(order.id), "1");
          } catch {}
          if (!seen && alive) {
            setToast({ id: order.id, at: Date.now() });
            break;
          }
        }
      } catch {
        // Offline or signed out: try again later.
      }
      schedule(live ? 30000 : 120000);
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
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div key={toast.at} className="placed-toast" role="status">
      <i aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
      </i>
      <div>
        <strong>Order delivered successfully</strong>
      </div>
      <button type="button" className="placed-toast-close" onClick={() => setToast(null)} aria-label="Close">×</button>
    </div>
  );
}
