"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rupees } from "@/lib/format";
import { CLOSED_STATUSES, orderStatusInfo } from "@/lib/orderStatus";
import { useCart } from "./Providers";

// The order list's pieces: the card, the loading skeleton and the empty state.
// They only draw what the orders API already returns — nothing is re-derived
// or stored here — and the detail page stays the place for everything else.

const MAX_THUMBS = 4;

const day = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
const shortDay = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "";
const clock = (value) =>
  new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// The one line under the total: when it arrived, when it was cancelled, or
// when it is due.
function infoLine(order) {
  const reached = (status) => order.statusHistory?.find((h) => h.status === status)?.at;

  if (order.status === "DELIVERED") {
    const at = order.delivery?.deliveredAt || reached("DELIVERED");
    return at ? `Delivered on ${day(at)}` : "Delivered";
  }
  if (["CANCELLED", "REJECTED", "REFUNDED"].includes(order.status)) {
    const at = reached(order.status);
    const word = orderStatusInfo(order.status).label;
    return at ? `${word} on ${day(at)}` : word;
  }
  const due = order.delivery?.expectedBy;
  if (due) {
    return sameDay(due, new Date()) ? `Expected today by ${clock(due)}` : `Expected ${shortDay(due)}`;
  }
  return `Placed on ${day(order.placedAt)}`;
}

export function StatusBadge({ status }) {
  const { label, tone } = orderStatusInfo(status);
  return <span className={`ob ob-${tone}`}>{label}</span>;
}

export default function OrderCard({ order }) {
  const router = useRouter();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const items = order.items || [];
  const shown = items.slice(0, MAX_THUMBS);
  const more = items.length - shown.length;
  const delivered = order.status === "DELIVERED";
  const closed = CLOSED_STATUSES.includes(order.status);

  // Buy Again puts the same lines back in the cart through the cart's own
  // add — so stock limits, steps and prices are checked exactly as usual — then
  // opens the cart. Lines that can't be added right now are skipped.
  async function buyAgain() {
    setBusy(true);
    setNote("");
    let added = 0;
    for (const item of items) {
      try {
        await cart.add(item.variant, item.quantity);
        added += 1;
      } catch {
        // out of stock or no longer sold — carry on with the rest
      }
    }
    setBusy(false);
    if (added) router.push("/cart");
    else setNote("These items aren't available right now.");
  }

  return (
    <article className={`oc${closed ? "" : " oc-open"}`}>
      <Link href={`/orders/${order.id}`} className="oc-main" aria-label={`Order ${order.code}`}>
        <div className="oc-top">
          <span className="oc-id">
            <strong className="tabular">{order.code}</strong>
            <span>{day(order.placedAt)}</span>
          </span>
          <StatusBadge status={order.status} />
        </div>

        <div className="oc-thumbs">
          {shown.map((item, index) => (
            <span key={item.id || item.sku || index} className="oc-thumb" title={item.name}>
              {item.image ? <img src={item.image} alt="" loading="lazy" /> : item.name?.[0]}
            </span>
          ))}
          {more > 0 ? <span className="oc-thumb oc-more">+{more}</span> : null}
        </div>

        <div className="oc-sum">
          <span className="oc-count">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          <strong className="oc-total">{rupees(order.pricing?.total)}</strong>
        </div>
        <p className="oc-info">{infoLine(order)}</p>
      </Link>

      <div className="oc-actions">
        <Link href={`/orders/${order.id}`} className="oc-btn primary">
          View Order
        </Link>
        {delivered ? (
          <button type="button" className="oc-btn" onClick={buyAgain} disabled={busy}>
            {busy ? "Adding…" : "Buy Again"}
          </button>
        ) : null}
      </div>
      {note ? (
        <p className="oc-note" role="status">
          {note}
        </p>
      ) : null}
    </article>
  );
}

// Placeholder cards with the same bones as a real one, so the page does not
// jump when the orders arrive.
export function OrderSkeletons({ count = 3 }) {
  return (
    <div className="order-list" aria-busy="true" aria-label="Loading your orders">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="oc oc-skel" aria-hidden="true">
          <div className="oc-top">
            <span className="sk sk-line" style={{ width: 110 }} />
            <span className="sk sk-pill" />
          </div>
          <div className="oc-thumbs">
            {[0, 1, 2, 3].map((n) => (
              <span key={n} className="sk sk-thumb" />
            ))}
          </div>
          <span className="sk sk-line" style={{ width: "55%" }} />
          <span className="sk sk-line" style={{ width: "40%" }} />
          <div className="oc-actions">
            <span className="sk sk-btn" />
            <span className="sk sk-btn" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrdersEmpty() {
  return (
    <div className="orders-empty">
      <svg viewBox="0 0 120 120" width="112" height="112" fill="none" aria-hidden="true">
        <circle cx="60" cy="60" r="54" fill="var(--brand-soft)" />
        <path
          d="M36 48h48l-4 38a6 6 0 0 1-6 5.4H46a6 6 0 0 1-6-5.4L36 48Z"
          fill="#fff"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M48 48v-6a12 12 0 0 1 24 0v6" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
        <path d="m51 71 6 6 12-13" stroke="var(--brand)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2>No orders yet</h2>
      <p>Your orders will appear here once you make your first purchase.</p>
      <Link href="/" className="oc-btn primary">
        Start Shopping
      </Link>
    </div>
  );
}
