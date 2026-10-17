"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useCart } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees, when } from "@/lib/format";
import { payOnline } from "@/lib/razorpay";
import EmptyState from "@/components/EmptyState";

const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

// What the checkout (or a "Pay now" here) came back with, as a banner.
const PAYMENT_NOTICES = {
  dismissed: { tone: "warn", text: "Payment not completed. Your order is held for 30 minutes — pay now, or cancel it." },
  failed: { tone: "error", text: "The payment didn't go through. No money was taken for this order — try again." },
  pending: { tone: "warn", text: "Payment received — we're confirming it with your bank. This page updates on its own." },
};

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

// The delivery partner's photo of your products at the door, taken before
// handover. Until the order is delivered it says so: a photo is not a
// handover. The link is issued per page load and expires within two hours.
function DeliveryPhoto({ photo, delivered }) {
  const [state, setState] = useState("loading");
  if (!photo.url) return null;
  return (
    <div className="panel delivery-photo">
      <h3>Product photo at delivery</h3>
      <p className="delivery-photo-status">
        {delivered ? "Delivered" : "Delivery photo captured · not handed over yet"}
        {photo.uploadedAt ? <span> · {when(photo.uploadedAt)}</span> : null}
      </p>
      {state === "error" ? (
        <p className="notice error">The photo couldn&rsquo;t load. Refresh the page to try again.</p>
      ) : (
        <a href={photo.url} target="_blank" rel="noopener noreferrer" className={`delivery-photo-frame ${state}`} title="Open full size">
          <img
            src={photo.url}
            alt="Your products, photographed at your door before handover"
            width={photo.width || undefined}
            height={photo.height || undefined}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
          />
        </a>
      )}
    </div>
  );
}

function OrderDetail() {
  const { id } = useParams();
  const router = useRouter();
  const params = useSearchParams();
  const justPlaced = params.get("placed") === "1";
  const { ready, signedIn } = useAuth();
  const cart = useCart();

  const [tracking, setTracking] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState("");
  const [paymentNotice, setPaymentNotice] = useState(PAYMENT_NOTICES[params.get("payment")] || null);
  const poller = useRef(null);

  useEffect(() => {
    if (ready && !signedIn) router.replace(`/login?next=/orders/${id}`);
  }, [ready, signedIn, router, id]);

  const load = useCallback(async () => {
    try {
      const track = await api.get(`/orders/${id}/track`);
      setTracking(track.tracking);
      setOrder(track.order);
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
  // While an online payment is being confirmed, check every few seconds so
  // the customer sees "confirmed" as soon as the API does.
  const awaitingPayment = tracking?.status === "PAYMENT_PENDING" && order?.payment.method === "online";
  useEffect(() => {
    clearInterval(poller.current);
    if (!tracking || CLOSED.includes(tracking.status)) return undefined;
    poller.current = setInterval(load, awaitingPayment ? 5000 : 20000);
    return () => clearInterval(poller.current);
  }, [tracking, load, awaitingPayment]);

  // Once the API has the payment, the "confirming" banner has done its job.
  useEffect(() => {
    if (tracking && tracking.status !== "PAYMENT_PENDING") setPaymentNotice(null);
  }, [tracking]);

  async function payNow() {
    setPaying("Opening payment…");
    setError("");
    try {
      const result = await payOnline(id, {
        // Retry the way the customer chose at checkout.
        upiOnly: params.get("via") === "upi",
        onVerifying: () => setPaying("Verifying payment…"),
      });
      setPaymentNotice(
        result.status === "failed" && result.message
          ? { tone: "error", text: result.message }
          : PAYMENT_NOTICES[result.status] || null
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying("");
    }
  }

  // The review prompt (components/ReviewPrompt) listens for this.
  useEffect(() => {
    if (tracking?.status === "DELIVERED") window.dispatchEvent(new Event("reviews:check"));
  }, [tracking?.status]);

  async function cancel() {
    if (!confirm("Cancel this order? This cannot be undone.")) return;
    setCancelling(true);
    try {
      await api.post(`/orders/${id}/cancel`, { reason: "Cancelled from the website" });
      // Cancelling an unpaid online order gives the cart back (API side).
      await Promise.all([load(), cart.refresh()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
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
      {justPlaced ? (
        <div className="placed-banner" role="status">
          <strong>Thank you! Your order is placed.</strong>
          <span>The store is preparing it now — you can follow every step below.</span>
        </div>
      ) : null}

      {awaitingPayment && paymentNotice ? (
        <p className={`notice ${paymentNotice.tone}`} role="status">
          {paymentNotice.text}
        </p>
      ) : null}
      {error && tracking ? <p className="notice error">{error}</p> : null}

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

          {order?.delivery?.productPhoto ? <DeliveryPhoto key={order.delivery.productPhoto.url} photo={order.delivery.productPhoto} delivered={tracking.status === "DELIVERED"} /> : null}

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
                {order.pricing.offerDiscount - (order.pricing.rewardDiscount || 0) > 0 ? (
                  <div className="bill-row save-row">
                    <span className="label">Offers</span>
                    <span>− {rupees(order.pricing.offerDiscount - (order.pricing.rewardDiscount || 0))}</span>
                  </div>
                ) : null}
                {order.pricing.rewardDiscount > 0 ? (
                  <div className="bill-row save-row">
                    <span className="label">Reward coupon{order.rewardCoupon?.code ? ` (${order.rewardCoupon.code})` : ""}</span>
                    <span>− {rupees(order.pricing.rewardDiscount)}</span>
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
                Payment:{" "}
                <strong>
                  {order.payment.method === "cod"
                    ? "Cash on delivery"
                    : order.payment.method === "online"
                      ? "Online (Razorpay)"
                      : order.payment.method.toUpperCase()}
                </strong>
                {" · "}
                {order.payment.status.replace(/_/g, " ").toLowerCase()}
              </p>

              {awaitingPayment ? (
                <button
                  className="btn primary block lg"
                  style={{ marginTop: 14 }}
                  onClick={payNow}
                  disabled={Boolean(paying) || cancelling}
                >
                  {paying || `Pay ${rupees(order.pricing.total)} now`}
                </button>
              ) : null}

              {tracking.status === "DELIVERED" ? <ReturnPanel orderId={id} onDone={load} /> : null}

              <Link href={`/help?order=${id}&code=${encodeURIComponent(tracking.code)}`} className="btn block" style={{ marginTop: 14 }}>
                Get help with this order
              </Link>

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

// Raise a return on a delivered order. Which lines qualify, and for how long,
// is the API's answer (each item's category sets its window) — the same
// endpoints the app uses.
function ReturnPanel({ orderId, onDone }) {
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState(null);
  const [picked, setPicked] = useState([]);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setOpen(true);
    setError("");
    try {
      setCheck(await api.get(`/returns/orders/${orderId}/returnable`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit() {
    setSending(true);
    setError("");
    try {
      await api.post(`/returns/orders/${orderId}/request`, {
        items: picked.map((orderItem) => ({ orderItem })),
        reason: reason.trim(),
      });
      setOpen(false);
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button className="btn block" style={{ marginTop: 14 }} onClick={start}>
        Return items
      </button>
    );
  }

  return (
    <div className="return-panel" style={{ marginTop: 14 }}>
      <h3>Return items</h3>
      {error ? <p className="notice error">{error}</p> : null}
      {!check ? (
        error ? null : <p className="muted-line">Checking what can be returned…</p>
      ) : !check.eligible ? (
        <p className="notice warn">{check.reason}</p>
      ) : (
        <>
          <div className="choice-list">
            {check.items.map((item) => (
              <label
                key={item.orderItem}
                className={`choice choice-main${picked.includes(item.orderItem) ? " on" : ""}${item.eligible ? "" : " off"}`}
              >
                <input
                  type="checkbox"
                  disabled={!item.eligible}
                  checked={picked.includes(item.orderItem)}
                  onChange={(e) =>
                    setPicked((p) => (e.target.checked ? [...p, item.orderItem] : p.filter((x) => x !== item.orderItem)))
                  }
                />
                <span className="choice-radio choice-check" aria-hidden="true" />
                <span className="choice-copy">
                  <strong>
                    {item.name}
                    {item.variantName ? ` · ${item.variantName}` : ""}
                  </strong>
                  <span>
                    {item.eligible
                      ? `${rupees(item.amount)} · ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left to return`
                      : item.reason}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What went wrong? e.g. damaged, wrong item"
            style={{ marginTop: 10 }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="btn primary" onClick={submit} disabled={!picked.length || sending}>
              {sending ? "Sending…" : "Request return"}
            </button>
            <button className="btn" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
