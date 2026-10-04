"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./Providers";
import AddToCart from "./AddToCart";
import { rupees } from "@/lib/format";

// The live cart, kept visible beside the catalogue instead of tucked behind
// a header icon. Same cart the /cart page reads — no separate state, so a
// change here or there is never out of sync.
export default function HomeCartSidebar() {
  const cart = useCart();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = cart.items || [];
  const summary = cart.summary;

  // Nothing in the cart yet: render nothing at all, rather than an empty
  // panel. The homepage grid below collapses its reserved column to match,
  // so an empty cart doesn't leave a blank rail down the page.
  if (!items.length) return null;

  async function applyCoupon(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await cart.applyCoupon(code.trim());
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="home-aside">
      <div className="panel mini-cart sticky">
        <div className="mini-cart-head">
          <h3>Your cart</h3>
          <span className="pill brand" suppressHydrationWarning>
            {cart.lineCount} item{cart.lineCount === 1 ? "" : "s"}
          </span>
        </div>

        {!items.length ? (
          <div className="mini-cart-empty">
            <p>Your cart is empty.</p>
            <span>Add fresh picks from the shelf and they&apos;ll show up here.</span>
          </div>
        ) : (
          <>
            <div className="mini-cart-items">
              {items.slice(0, 5).map((item) => (
                <div key={item.itemId} className="mini-cart-item">
                  <div className="mini-cart-thumb">
                    {item.image ? <img src={item.image} alt="" /> : null}
                  </div>
                  <div className="mini-cart-info">
                    <strong>{item.name}</strong>
                    <span>{item.variantName || item.unit}</span>
                    <em>{rupees(item.pricing?.payable ?? item.sellingPrice)}</em>
                  </div>
                  <AddToCart variantId={item.variant} />
                </div>
              ))}
              {items.length > 5 ? (
                <Link href="/cart" className="mini-cart-more">
                  + {items.length - 5} more item{items.length - 5 === 1 ? "" : "s"} in cart
                </Link>
              ) : null}
            </div>

            {summary ? (
              <div className="bill mini-cart-bill">
                <div className="bill-row">
                  <span className="label">Subtotal</span>
                  <span>{rupees(summary.mrpTotal)}</span>
                </div>
                <div className="bill-row">
                  <span className="label">Delivery</span>
                  <span>{summary.deliveryFree ? "FREE" : rupees(summary.deliveryCharge)}</span>
                </div>
                <div className="bill-row total">
                  <span>Total</span>
                  <span>{rupees(summary.total)}</span>
                </div>
              </div>
            ) : null}

            {summary?.amountToFreeDelivery > 0 ? (
              <p className="notice info" style={{ fontSize: 12.5, padding: "9px 11px" }}>
                Add {rupees(summary.amountToFreeDelivery)} more for free delivery
              </p>
            ) : null}

            {!cart.offers.applied.some((o) => o.code) ? (
              <form onSubmit={applyCoupon} className="mini-cart-coupon">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  placeholder="Promo code"
                  aria-label="Promo code"
                />
                <button className="btn" disabled={!code.trim() || busy}>
                  {busy ? "…" : "Apply"}
                </button>
              </form>
            ) : null}
            {error ? (
              <p className="notice error" style={{ fontSize: 12.5, padding: "9px 11px" }}>
                {error}
              </p>
            ) : null}

            <Link href="/checkout" className="btn primary block lg" style={{ marginTop: 14 }}>
              Proceed to checkout →
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
