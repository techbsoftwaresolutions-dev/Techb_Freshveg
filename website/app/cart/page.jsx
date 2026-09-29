"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useCart, useStore } from "@/components/Providers";
import AddToCart from "@/components/AddToCart";
import EmptyState from "@/components/EmptyState";
import { rupees } from "@/lib/format";

export default function CartPage() {
  const cart = useCart();
  const { signedIn } = useAuth();
  const { store } = useStore();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);

  const summary = cart.summary;

  if (!cart.cart) {
    return (
      <div className="wrap">
        <div className="page-loading">Loading your cart…</div>
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

  // How far along the free-delivery threshold the cart is, for the bar. The
  // cart's own summary carries the threshold it priced against; the store's
  // is only a fallback for an older API.
  const threshold = summary?.freeDeliveryThreshold || store?.freeDeliveryAbove;
  const progress =
    threshold && summary?.amountToFreeDelivery > 0
      ? Math.min(100, Math.max(4, ((threshold - summary.amountToFreeDelivery) / threshold) * 100))
      : null;

  return (
    <div className="wrap">
      <header className="page-title">
        <h1>My Cart</h1>
        <p>
          {cart.items.length} item{cart.items.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="split cart">
        <div className="stack">
          {summary?.amountToFreeDelivery > 0 ? (
            <div className="delivery-meter">
              <span>
                Add <strong>{rupees(summary.amountToFreeDelivery)}</strong> more for <strong>free delivery</strong>
              </span>
              {progress !== null ? (
                <span className="delivery-meter-bar" aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </span>
              ) : null}
            </div>
          ) : summary?.deliveryFree ? (
            <div className="delivery-meter done">
              <span>
                <strong>Free delivery unlocked</strong> on this order
              </span>
            </div>
          ) : null}

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
          <div className="panel">
            <h3>Offers &amp; coupons</h3>
            {cart.offers.applied.length ? (
              <div className="applied-offers">
                {cart.offers.applied.map((offer) => (
                  <div key={offer.id} className="applied-offer">
                    <span>
                      {offer.title}
                      {offer.discount ? ` — ${rupees(offer.discount)}` : ""}
                    </span>
                    {offer.code ? (
                      <button type="button" onClick={() => cart.removeCoupon().catch(() => {})}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {!cart.cart.couponCode ? (
              <form onSubmit={applyCoupon} className="coupon-form">
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
          </div>

          <div className="panel">
            <h3>Bill details</h3>
            <div className="bill">
              <Row label="Item total" value={rupees(summary.mrpTotal)} />
              {summary.catalogueSavings > 0 ? (
                <Row label="Product discount" value={`− ${rupees(summary.catalogueSavings)}`} save />
              ) : null}
              {summary.offerDiscount > 0 ? (
                <Row label="Offer discount" value={`− ${rupees(summary.offerDiscount)}`} save />
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
              className="btn primary block lg"
              style={{ marginTop: 16 }}
              disabled={!summary.meetsMinimum}
              onClick={() => router.push(signedIn ? "/checkout" : "/login?next=/checkout")}
            >
              {signedIn ? "Proceed to checkout" : "Sign in to checkout"}
            </button>
          </div>
        </div>
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
