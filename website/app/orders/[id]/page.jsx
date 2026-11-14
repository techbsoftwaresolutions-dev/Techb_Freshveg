"use client";

import Link from "next/link";
import CallButton from "@/components/CallButton";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees, when } from "@/lib/format";
import { payWithRazorpay } from "@/lib/razorpay";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import ReturnRequest from "@/components/ReturnRequest";
import OrderTrackMap from "@/components/OrderTrackMap";

// The customer's order QR is switched off: the delivery partner only needs the OTP.
const SHOW_QR = false;

const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

// What the top-right toast says when the order moves to a new step while the
// shopper is watching. Steps not listed fall back to the status label.
const STATUS_TOAST = {
  ORDER_CONFIRMED: ["Your order is confirmed", "The store has accepted your order."],
  PAYMENT_CONFIRMED: ["Payment received", "Thank you — your payment went through."],
  ORDER_ACCEPTED: ["Preparing your order", "The store has started on your order."],
  PICKING: ["Collecting your items", "Your items are being picked from the shelves."],
  PACKING: ["Packing your order", "Almost ready to leave the store."],
  READY_FOR_PICKUP: ["Your order is packed", "Waiting for a delivery partner."],
  ASSIGNED_TO_DELIVERY: ["Delivery partner assigned", "Someone is on the way to collect it."],
  PICKED_UP: ["Picked up from the store", "Your order is on its way."],
  OUT_FOR_DELIVERY: ["Out for delivery", "Your order is on the way to you."],
  ARRIVED: ["Your delivery partner has arrived", "Share your handover code at the door."],
  DELIVERED: ["Order delivered successfully", ""],
  CANCELLED: ["Your order was cancelled", "Any payment made will be refunded."],
  REJECTED: ["Your order could not be fulfilled", "Any payment made will be refunded."],
  RETURN_REQUESTED: ["Return requested", "We'll let you know once it's approved."],
  RETURN_APPROVED: ["Return approved", "A partner will collect the items."],
  RETURN_PICKED: ["Return collected", "Your refund is on its way."],
  REFUNDED: ["Refund done", "Your refund has been processed."],
};
const ORDER_PROGRESS_STAGES = [
  { label: "Order placed", statuses: ["ORDER_PLACED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED"] },
  { label: "Order confirmed", statuses: ["ORDER_CONFIRMED"] },
  { label: "Preparing your order", statuses: ["ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP", "ASSIGNED_TO_DELIVERY", "PICKED_UP"] },
  { label: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"] },
  { label: "Executive arrived at location", statuses: ["ARRIVED"] },
  { label: "Delivered", statuses: ["DELIVERED"] },
];

function groupedProgress(timeline = [], currentStatus) {
  const currentIndex = ORDER_PROGRESS_STAGES.findIndex((stage) => stage.statuses.includes(currentStatus))
    ?? timeline.findIndex((step) => step.state === "active");
  const activeIndex = currentIndex < 0 ? timeline.reduce((found, step) => {
    if (step.state !== "active") return found;
    return ORDER_PROGRESS_STAGES.findIndex((stage) => stage.statuses.includes(step.status));
  }, -1) : currentIndex;

  return ORDER_PROGRESS_STAGES.map((stage, index) => {
    const events = timeline.filter((step) => stage.statuses.includes(step.status));
    const reached = [...events].reverse().find((step) => step.at);
    return {
      status: stage.statuses[0],
      label: stage.label,
      at: reached?.at || null,
      state: index === activeIndex ? "active" : activeIndex >= 0 && index < activeIndex ? "done" : "pending",
    };
  });
}

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

const laterDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

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
  // Top-right toast: "order placed" after checkout, then one for each new
  // step (confirmed, out for delivery, delivered...) seen while on this page.
  // Closes itself after a few seconds.
  const [toast, setToast] = useState(
    justPlaced ? { title: "Thank you! Your order is placed.", text: "The store is preparing it now — follow every step below.", tone: "ok", at: 0 } : null
  );
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const lastStatus = useRef(null);
  // "?placed=1" is only for the moment after checkout: drop it from the address
  // so a refresh or a later visit (say, after delivery) never says "placed" again.
  useEffect(() => {
    if (!justPlaced) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("placed");
    url.searchParams.delete("paid");
    window.history.replaceState(window.history.state, "", url.pathname + (url.search || ""));
  }, [justPlaced]);

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
      const status = track.tracking?.status;
      // An order that is already finished never shows the "placed" toast.
      if (!lastStatus.current && CLOSED.includes(status)) {
        setToast((t) => (t && t.at === 0 ? null : t));
      }
      if (lastStatus.current === "RETURN_REQUESTED" && status === "DELIVERED") {
        setToast({ title: "Return declined", text: "See the reason below the bill.", tone: "bad", at: Date.now() });
      } else if (lastStatus.current && status && status !== lastStatus.current) {
        const [title, text] = STATUS_TOAST[status] || [track.tracking.statusLabel, ""];
        setToast({ title, text, tone: ["CANCELLED", "REJECTED"].includes(status) ? "bad" : "ok", at: Date.now() });
      }
      // Delivered: also shown the first time the shopper opens the order after
      // delivery (not only when watching live) — once per order, per browser.
      if (status === "DELIVERED") {
        const seenKey = `commerce.web.deliveredToast.${id}`;
        let seen = false;
        try { seen = localStorage.getItem(seenKey) === "1"; localStorage.setItem(seenKey, "1"); } catch {}
        if (!seen && lastStatus.current !== "DELIVERED" && !(lastStatus.current && lastStatus.current !== status)) {
          const [title, text] = STATUS_TOAST.DELIVERED;
          setToast({ title, text, tone: "ok", at: Date.now() });
        }
      }
      if (status) lastStatus.current = status;
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
    // Not while the tab is hidden; catch up as soon as the shopper comes back.
    // Every 10s while a rider is bringing it (the map follows them), else 20s.
    const riding = ["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"].includes(tracking.status);
    poller.current = setInterval(() => { if (!document.hidden) load(); }, riding ? 10000 : 20000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(poller.current); document.removeEventListener("visibilitychange", onVisible); };
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

  // Items held back from this delivery and coming on a later day.
  const waitingItems = (order?.items || []).filter((i) => i.deferred?.expectedOn && !i.deferred.deliveredAt);

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

      {toast && tracking.status !== "PAYMENT_PENDING" ? (
        <div key={toast.at} className={`placed-toast${toast.tone === "bad" ? " bad" : ""}`} role="status">
          <i aria-hidden="true">
            {toast.tone === "bad" ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            )}
          </i>
          <div>
            <strong>{toast.title}</strong>
            {toast.text ? <span>{toast.text}</span> : null}
          </div>
          <button type="button" className="placed-toast-close" onClick={() => setToast(null)} aria-label="Close">×</button>
        </div>
      ) : null}

      {tracking.status === "ARRIVED" ? (
        <div className="notice warn" role="alert" style={{ marginBottom: 14, background: "#fff8e1", borderColor: "#ffe082", color: "#e65100", padding: "14px 18px", borderRadius: 8 }}>
          <strong style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📍</span> Delivery Executive Arrived at Your Location!
          </strong>
          <p style={{ margin: "6px 0 0 0", fontSize: 14 }}>
            Our delivery partner has arrived at your address with your fresh vegetables. Please share your handover code <strong>{tracking.otp}</strong> at the door to collect your package.
          </p>
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
              {tracking.expectedBy && !CLOSED.includes(tracking.status) ? (
                <p>
                  Expected by{" "}
                  <strong>
                    {new Date(tracking.expectedBy).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </p>
              ) : null}
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
              <CallButton
                phone={tracking.partner.phone}
                name={tracking.partner.name}
                title="Call your delivery partner"
              />
            </div>
          ) : null}

          {tracking.map && !CLOSED.includes(tracking.status) && !/^RETURN|^PAYMENT_PENDING$/.test(tracking.status) ? (
            <OrderTrackMap map={tracking.map} status={tracking.status} />
          ) : null}

          <div className="panel">
            <h3>Order progress</h3>
            <ol className="timeline">
              {/* Steps the order skipped — a COD order never passes through
                  "payment received" — are left out, not shown as done. */}
              {groupedProgress(tracking.timeline, order?.status)
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
                {order.items.length - waitingItems.length} item{order.items.length - waitingItems.length === 1 ? "" : "s"}
                {waitingItems.length ? <small className="item-later-count"> · {waitingItems.length} arriving later</small> : null}
              </h3>
              {waitingItems.length ? (
                <p className="notice info" style={{ marginBottom: 12 }}>
                  {waitingItems.length === 1 ? "1 item" : `${waitingItems.length} items`} from this order will be
                  delivered separately on <strong>{laterDate(waitingItems[0].deferred.expectedOn)}</strong>
                  {waitingItems[0].deferred.reason ? ` — ${waitingItems[0].deferred.reason}` : ""}. We're sorry for the wait.
                </p>
              ) : null}
              <div className="order-items">
                {order.items.filter((i) => !waitingItems.includes(i)).map((item) => (
                  <div key={item.id || item.sku} className="order-item">
                    <span className="order-thumb">{item.image ? <img src={item.image} alt="" /> : item.name?.[0]}</span>
                    <span className="order-item-name">
                      {item.name}
                      <span>
                        {item.variantName ? `${item.variantName} · ` : ""}×{item.quantity}
                      </span>
                      {item.itemStatus === "returned" ? <span className="item-returned">Return requested</span> : null}
                      {item.deferred?.expectedOn ? (
                        <span className={`item-later${item.deferred.deliveredAt ? " done" : ""}`}>
                          {item.deferred.deliveredAt ? "Delivered later" : `Arriving ${laterDate(item.deferred.expectedOn)}`}
                        </span>
                      ) : null}
                    </span>
                    <strong>{rupees(item.payable)}</strong>
                  </div>
                ))}
              </div>

              {waitingItems.length ? (
                <>
                  <h4 className="items-later-head">Arriving later</h4>
                  <div className="order-items">
                    {waitingItems.map((item) => (
                  <div key={item.id || item.sku} className="order-item">
                    <span className="order-thumb">{item.image ? <img src={item.image} alt="" /> : item.name?.[0]}</span>
                    <span className="order-item-name">
                      {item.name}
                      <span>
                        {item.variantName ? `${item.variantName} · ` : ""}×{item.quantity}
                      </span>
                      {item.deferred?.expectedOn ? (
                        <span className={`item-later${item.deferred.deliveredAt ? " done" : ""}`}>
                          {item.deferred.deliveredAt ? "Delivered later" : `Arriving ${laterDate(item.deferred.expectedOn)}`}
                        </span>
                      ) : null}
                    </span>
                    <strong>{rupees(item.payable)}</strong>
                  </div>
                    ))}
                  </div>
                </>
              ) : null}

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

              {["DELIVERED", "RETURN_REQUESTED"].includes(tracking.status) ? (
                <ReturnRequest
                  key={tracking.status}
                  pending={tracking.status === "RETURN_REQUESTED"}
                  orderId={id}
                  items={order.items}
                  autoOpen={params.get("return") === "1"}
                  onDone={async () => {
                    await load();
                    setToast({ title: "Return requested", text: "", tone: "ok", at: Date.now() });
                  }}
                />
              ) : null}

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
