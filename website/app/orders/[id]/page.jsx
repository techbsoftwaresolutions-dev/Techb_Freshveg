"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees, when } from "@/lib/format";
import EmptyState from "@/components/EmptyState";

const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="wrap"><div className="empty">Loading…</div></div>}>
      <OrderDetail />
    </Suspense>
  );
}

function OrderDetail() {
  const { id } = useParams();
  const router = useRouter();
  const params = useSearchParams();
  const justPlaced = params.get("placed") === "1";
  const { ready, signedIn } = useAuth();

  const [tracking, setTracking] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const poller = useRef(null);

  useEffect(() => {
    if (ready && !signedIn) router.replace(`/login?next=/orders/${id}`);
  }, [ready, signedIn, router, id]);

  const load = useCallback(async () => {
    try {
      const [track, mine] = await Promise.all([
        api.get(`/orders/${id}/track`),
        api.get("/orders/mine", { limit: 30 }),
      ]);
      setTracking(track.tracking);
      setOrder(mine.items.find((o) => o.id === id) || null);
      setError("");
      return track.tracking;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  // Poll while the order is live. A websocket would be better; polling a small
  // endpoint every 20s is honest about what exists today and stops the moment
  // the order closes.
  useEffect(() => {
    clearInterval(poller.current);
    if (!tracking || CLOSED.includes(tracking.status)) return undefined;
    poller.current = setInterval(load, 20000);
    return () => clearInterval(poller.current);
  }, [tracking, load]);

  async function cancel() {
    if (!confirm("Cancel this order? This cannot be undone.")) return;
    setCancelling(true);
    try {
      await api.post(`/orders/${id}/cancel`, { reason: "Cancelled from the website" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="wrap">
        <div className="empty">Loading your order…</div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="wrap">
        <EmptyState icon="box" title="Couldn't load this order" actions={[{ href: "/orders", label: "Back to my orders" }]}>
          {error}
        </EmptyState>
      </div>
    );
  }

  const canCancel =
    !CLOSED.includes(tracking.status) &&
    !["OUT_FOR_DELIVERY", "ARRIVED", "PICKED_UP"].includes(tracking.status);

  return (
    <div className="wrap">
      {justPlaced ? (
        <div className="placed-banner" role="status">
          <strong>Thank you! Your order is placed.</strong>
          <span>The store is preparing it now — you can follow every step below.</span>
        </div>
      ) : null}

      <nav className="crumbs">
        <Link href="/">Home</Link> › <Link href="/orders">My orders</Link> › <span>{tracking.code}</span>
      </nav>

      <div className="split cart">
        <div className="stack">
          <div
            className={`order-hero ${
              tracking.status === "DELIVERED"
                ? "done"
                : ["CANCELLED", "REJECTED", "REFUNDED"].includes(tracking.status)
                  ? "stopped"
                  : "live"
            }`}
          >
            <span className="order-hero-icon" aria-hidden="true">
              {tracking.status === "DELIVERED" ? (
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : ["CANCELLED", "REJECTED", "REFUNDED"].includes(tracking.status) ? (
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6.5h11.5v9.5H2z" />
                  <path d="M13.5 10h4.2l3.3 3.2V16h-7.5" />
                  <circle cx="6.5" cy="17.8" r="1.7" />
                  <circle cx="17" cy="17.8" r="1.7" />
                </svg>
              )}
            </span>
            <div>
              <h1>{tracking.statusLabel}</h1>
              <p>
                Order <strong className="tabular">{tracking.code}</strong>
                {tracking.expectedBy && !CLOSED.includes(tracking.status) ? (
                  <>
                    {" · "}Expected by{" "}
                    <strong>
                      {new Date(tracking.expectedBy).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {tracking.otp ? (
            <div className="otp-card">
              <span>Share this code with your delivery partner</span>
              <strong className="tabular">{tracking.otp}</strong>
            </div>
          ) : null}

          {tracking.partner ? (
            <div className="panel partner-card">
              <span className="avatar small" aria-hidden="true">
                {tracking.partner.name?.[0]?.toUpperCase() || "?"}
              </span>
              <div>
                <strong>{tracking.partner.name}</strong>
                <span>Your delivery partner</span>
              </div>
              <a href={`tel:${tracking.partner.phone}`} className="btn sm primary">
                Call
              </a>
            </div>
          ) : null}

          <div className="panel">
            <h3>Order progress</h3>
            <ol className="timeline">
              {/* Steps the order skipped — a COD order never passes through
                  "payment received" — are left out, not shown as done. */}
              {tracking.timeline
                .filter((step) => step.state !== "skipped")
                .map((step) => (
                  <li key={step.status} className={`timeline-step ${step.state}`}>
                    <span className="timeline-dot" aria-hidden="true">
                      {step.state === "done" ? (
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="timeline-copy">
                      <strong>{step.label}</strong>
                      {step.at ? <span>{when(step.at)}</span> : null}
                    </span>
                  </li>
                ))}
            </ol>
          </div>
        </div>

        {order ? (
          <div className="sticky">
            <div className="panel">
              <h3>
                {order.items.length} item{order.items.length === 1 ? "" : "s"}
              </h3>
              <div className="order-items">
                {order.items.map((item) => (
                  <div key={item.id || item.sku} className="order-item">
                    <span className="order-thumb">{item.image ? <img src={item.image} alt="" /> : item.name?.[0]}</span>
                    <span className="order-item-name">
                      {item.name}
                      <span>
                        {item.variantName ? `${item.variantName} · ` : ""}×{item.quantity}
                      </span>
                    </span>
                    <strong>{rupees(item.payable)}</strong>
                  </div>
                ))}
              </div>

              <div className="bill">
                <div className="bill-row">
                  <span className="label">Subtotal</span>
                  <span>{rupees(order.pricing.subtotal)}</span>
                </div>
                {order.pricing.offerDiscount > 0 ? (
                  <div className="bill-row save-row">
                    <span className="label">Offers</span>
                    <span>− {rupees(order.pricing.offerDiscount)}</span>
                  </div>
                ) : null}
                <div className="bill-row">
                  <span className="label">Delivery</span>
                  <span>{order.pricing.deliveryFree ? "FREE" : rupees(order.pricing.deliveryCharge)}</span>
                </div>
                <div className="bill-row total">
                  <span>Total</span>
                  <span>{rupees(order.pricing.total)}</span>
                </div>
              </div>

              <p className="payment-line">
                Payment: <strong>{order.payment.method === "cod" ? "Cash on delivery" : order.payment.method.toUpperCase()}</strong>
                {" · "}
                {order.payment.status.replace(/_/g, " ").toLowerCase()}
              </p>

              {canCancel ? (
                <button
                  className="btn block danger-outline"
                  style={{ marginTop: 14 }}
                  onClick={cancel}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling…" : "Cancel order"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
