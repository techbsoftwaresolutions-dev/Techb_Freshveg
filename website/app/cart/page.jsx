"use client";

import CouponPicker from "@/components/CouponPicker";
import Link from "next/link";
import { MorphingSquare } from "@/components/ui/morphing-square";
import FreeDeliveryProgress from "@/components/FreeDeliveryProgress";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth, useCart, useStore } from "@/components/Providers";
import { api } from "@/lib/client-api";
import AddToCart from "@/components/AddToCart";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { rupees } from "@/lib/format";

export default function CartPage() {
  const cart = useCart();
  const { signedIn } = useAuth();
  const router = useRouter();
  const { store } = useStore();
  const billRef = useRef(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Phone only: the coupon box starts folded to one line.
  const [offersOpen, setOffersOpen] = useState(false);
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);

  const summary = cart.summary;

  if (!cart.cart) {
    return (
      <div className="wrap">
        <div className="page-loading"><MorphingSquare message="Loading your cart…" /></div>
      </div>
    );
  }

  if (!cart.items.length) {
    return (
      <div className="wrap">
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          actions={[
            { href: "/", label: "Start shopping" },
            { href: "/c", label: "Browse categories" },
          ]}
        >
          Fresh fruit, vegetables and the weekly shop are a few taps away.
        </EmptyState>
      </div>
    );
  }

  // Empties the cart through the API's own "clear" and re-reads it.
  async function clearCart() {
    setConfirmClear(false);
    try {
      await api.del("/cart", { store: store?.id });
    } catch {
      // fall through — the refresh below shows what the cart really holds
    }
    await cart.refresh();
  }

  const checkout = () => router.push(signedIn ? "/checkout" : "/login?next=/checkout");
  const itemCount = cart.items.length;

  async function applyCoupon(event) {
    event.preventDefault();
    setApplying(true);
    setCouponError("");
    try {
      await cart.applyCoupon(code.trim());
      setCode("");
    } catch (err) {
      // The engine explains why — "Add ₹120 more to use this" — which beats
      // a flat "invalid coupon".
      setCouponError(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="wrap cart-page">
      <header className="page-title cart-title">
        <div>
          <h1>My Cart</h1>
          <p>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" className="cart-clear" onClick={() => setConfirmClear(true)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5" />
          </svg>
          Clear Cart
        </button>
      </header>

      <div className="split cart">
        <div className="stack">
          <FreeDeliveryProgress variant="inline" />

          {cart.unavailable.length ? (
            <p className="notice error">
              {cart.unavailable.length} item{cart.unavailable.length === 1 ? "" : "s"} went out of stock
              and won&apos;t be ordered.
            </p>
          ) : null}

          <div className="panel cart-lines">
            {cart.items.map((item) => (
              <div key={item.itemId} className="cart-line">
                <div className="cart-line-media">{item.image ? <img src={item.image} alt="" /> : null}</div>

                <div className="cart-line-info">
                  <strong>{item.name}</strong>
                  <span className="cart-line-pack">{item.variantName || item.unit}</span>
                  <span className="cart-line-price">
                    {rupees(item.pricing?.payable ?? item.sellingPrice)}
                    {item.pricing?.discount > 0 ? <span className="mrp">{rupees(item.pricing.lineTotal)}</span> : null}
                  </span>
                  {!item.inStock ? <span className="pill danger">Only {item.available} left</span> : null}
                </div>

                <div className="cart-line-qty">
                  <AddToCart variantId={item.variant} />
                </div>

                <button
                  type="button"
                  className="cart-line-remove"
                  onClick={() => cart.remove(item.variant).catch(() => {})}
                  aria-label={`Remove ${item.name}`}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <Link href="/" className="continue-link">
            ← Continue shopping
          </Link>
        </div>

        <div className="sticky stack">
          <div className={`panel offers-card${offersOpen ? " open" : ""}`}>
            <h3 className="offers-h3">Offers &amp; coupons</h3>
            <button
              type="button"
              className="offers-toggle"
              aria-expanded={offersOpen}
              onClick={() => setOffersOpen((open) => !open)}
            >
              <span className="offers-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 18 18 6" />
                  <circle cx="7.5" cy="7.5" r="2" />
                  <circle cx="16.5" cy="16.5" r="2" />
                </svg>
              </span>
              <span className="offers-copy">
                <strong>Offers &amp; coupons</strong>
                <span>
                  {cart.offers.applied.length
                    ? `${cart.offers.applied.length} offer${cart.offers.applied.length === 1 ? "" : "s"} applied`
                    : "Enter coupon code to get discount"}
                </span>
              </span>
              <svg className="offers-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {cart.offers.applied.length ? (
              <div className="applied-offers">
                {cart.offers.applied.map((offer) => (
                  <div key={offer.id} className="applied-offer">
                    <span>
                      {offer.title}
                      {offer.discount ? ` — ${rupees(offer.discount)}` : ""}
                    </span>
                    {offer.code ? (
                      <button type="button" onClick={() => cart.removeCoupon(offer.code).catch(() => {})}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {/* A stored coupon that no longer qualifies is not in `applied`,
                so the box must stay open to replace it. */}
            {!cart.offers.applied.some((o) => o.code) ? (
              <form onSubmit={applyCoupon} className="coupon-form offers-body">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  placeholder="Enter coupon code"
                  aria-label="Coupon code"
                />
                <button className="btn primary" disabled={!code.trim() || applying}>
                  {applying ? "…" : "Apply"}
                </button>
              </form>
            ) : null}

            {couponError ? <p className="notice error" style={{ marginTop: 10, marginBottom: 0 }}>{couponError}</p> : null}
            <div className="offers-body">
              <CouponPicker />
            </div>
          </div>

          <div className="panel bill-card" id="bill" ref={billRef}>
            <h3>Bill details</h3>
            <div className="bill">
              <Row label="Item total" value={rupees(summary.mrpTotal)} />
              {summary.catalogueSavings > 0 ? (
                <Row label="Product discount" value={`− ${rupees(summary.catalogueSavings)}`} save />
              ) : null}
              {summary.offerDiscount - (summary.rewardDiscount || 0) > 0 ? (
                <Row label="Offer discount" value={`− ${rupees(summary.offerDiscount - (summary.rewardDiscount || 0))}`} save />
              ) : null}
              {summary.rewardDiscount > 0 ? (
                <Row label="Reward coupon" value={`− ${rupees(summary.rewardDiscount)}`} save />
              ) : null}
              <Row
                label="Delivery fee"
                value={summary.deliveryFree ? "FREE" : rupees(summary.deliveryCharge)}
                save={summary.deliveryFree}
              />
              {summary.packagingCharge > 0 ? <Row label="Packaging" value={rupees(summary.packagingCharge)} /> : null}
              {summary.roundOff !== 0 ? (
                <Row label="Round off" value={rupees(summary.roundOff, { decimals: true })} />
              ) : null}
              <div className="bill-row total">
                <span>To pay</span>
                <span>{rupees(summary.total)}</span>
              </div>
            </div>

            {summary.totalSavings > 0 ? (
              <p className="savings-banner">You save {rupees(summary.totalSavings)} on this order</p>
            ) : null}

            {!summary.meetsMinimum ? (
              <p className="notice warn" style={{ marginTop: 14, marginBottom: 0 }}>
                Minimum order is {rupees(summary.minOrderValue)} — add {rupees(summary.shortfallToMinimum)} more.
              </p>
            ) : null}

            <button
              className="btn primary block lg bill-checkout"
              style={{ marginTop: 16 }}
              disabled={!summary.meetsMinimum}
              onClick={checkout}
            >
              {signedIn ? "Proceed to checkout" : "Sign in to checkout"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear your cart?"
        message={`${itemCount === 1 ? "The item" : `All ${itemCount} items`} will be removed from your cart.`}
        confirmText="Clear cart"
        onConfirm={clearCart}
        onCancel={() => setConfirmClear(false)}
      />

      {/* Phone: the total and the way forward stay in reach at the bottom. */}
      <div className="cart-bar">
        <div className="cart-bar-total">
          <strong>{rupees(summary.total)}</strong>
          <span>
            {itemCount} item{itemCount === 1 ? "" : "s"} ·{" "}
            <button type="button" onClick={() => billRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              View details
            </button>
          </span>
        </div>
        <button type="button" className="cart-bar-cta" disabled={!summary.meetsMinimum} onClick={checkout}>
          <span className="cta-full">{signedIn ? "Proceed to checkout" : "Sign in to checkout"}</span>
          <span className="cta-short">{signedIn ? "Checkout" : "Sign in"}</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, save }) {
  return (
    <div className={`bill-row${save ? " save-row" : ""}`}>
      <span className="label">{label}</span>
      <span>{value}</span>
    </div>
  );
}
