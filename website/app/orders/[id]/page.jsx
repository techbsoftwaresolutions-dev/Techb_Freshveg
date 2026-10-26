"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees, when } from "@/lib/format";
import { payWithRazorpay } from "@/lib/razorpay";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

// The customer's order QR is switched off: the delivery partner only needs the OTP.
const SHOW_QR = false;

const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

// Phone: a compact back-arrow header stands in for the site header (its search
// bar, category bar and the footer step aside while this is on the page — see
// the .cat-mobile-head rules in globals.css). Hidden on desktop.
function MobileHead() {
  return (
    <div className="cat-mobile-head">
      <Link href="/orders" aria-label="Back to my orders" className="cat-mobile-btn">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </Link>
      <span className="cat-mobile-title">Order details</span>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap orders-page">
          <MobileHead />
          <div className="empty">Loading…</div>
        </div>
      }
    >
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payMessage, setPayMessage] = useState(params.get("payerror") || "");
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

  // The review prompt (components/ReviewPrompt) listens for this.
  useEffect(() => {
    if (tracking?.status === "DELIVERED") window.dispatchEvent(new Event("reviews:check"));
  }, [tracking?.status]);

  async function cancel() {
    setCancelling(true);
    try {
      await api.post(`/orders/${id}/cancel`, { reason: "Cancelled from the website" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
      setCancelOpen(false);
    }
  }

  async function payNow() {
    setPaying(true);
    setPayMessage("");
    try {
      const result = await payWithRazorpay(id);
      if (!result.paid) setPayMessage("Payment was not completed. You can try again whenever you are ready.");
      await load();
    } catch (err) {
      setPayMessage(err.message);
    } finally {
      setPaying(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="wrap orders-page">
        <MobileHead />
        <div className="empty">Loading your order…</div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="wrap orders-page">
        <MobileHead />
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
    <div className="wrap orders-page">
      <MobileHead />
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        message="Your order will be cancelled and this can't be undone."
        confirmLabel="Yes, cancel order"
        cancelLabel="Keep order"
        busy={cancelling}
        busyLabel="Cancelling…"
        onConfirm={cancel}
        onCancel={() => setCancelOpen(false)}
      />
      {tracking.status === "PAYMENT_PENDING" && order?.payment?.method === "upi" ? (
        <div className="notice warn" role="status" style={{ marginBottom: 14 }}>
          <strong>Payment pending.</strong> Your order is saved but not confirmed until it is paid.
          {payMessage ? <span style={{ display: "block", marginTop: 4 }}>{payMessage}</span> : null}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn primary" onClick={payNow} disabled={paying}>
              {paying ? "Opening Razorpay…" : "Pay now with Razorpay"}
            </button>
          </div>
        </div>
      ) : null}

      {justPlaced && tracking.status !== "PAYMENT_PENDING" ? (
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
              {/* QR hidden for now — only the OTP is shown. Set SHOW_QR = true to bring it back. */}
              {SHOW_QR && tracking.qr ? (
                <div className="otp-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tracking.qr} alt="Order QR for your delivery partner" width={180} height={180} />
                  <small>Show this QR to your delivery partner to scan first</small>
                </div>
              ) : null}
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
                  onClick={() => setCancelOpen(true)}
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
