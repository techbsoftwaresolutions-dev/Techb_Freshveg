"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useCart } from "./Providers";
import AddToCart from "./AddToCart";
import FreeDeliveryProgress from "./FreeDeliveryProgress";
import { rupees } from "@/lib/format";
import { gateCheckout } from "@/lib/launch";

export default function CartDrawer() {
  const dialog = useRef(null);
  const previousOverflow = useRef(null);
  const pathname = usePathname();
  const router = useRouter();
  const cart = useCart();
  const { signedIn } = useAuth();
  const summary = cart.summary;

  const restoreScroll = () => {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
  };
  const close = () => { dialog.current?.close(); restoreScroll(); };

  useEffect(() => {
    const open = () => {
      if (dialog.current?.open) return;
      previousOverflow.current = document.body.style.overflow;
      dialog.current.showModal();
      document.body.style.overflow = "hidden";
    };
    window.addEventListener("open-cart", open);
    return () => { window.removeEventListener("open-cart", open); restoreScroll(); };
  }, []);

  useEffect(() => { close(); }, [pathname]);

  return (
    <dialog ref={dialog} id="cart-drawer" className="cart-drawer" aria-labelledby="cart-drawer-title" onClose={restoreScroll}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) close();
      }}>
      <div className="cart-drawer-head">
        <div><h2 id="cart-drawer-title">Your cart</h2><span>{cart.lineCount} item{cart.lineCount === 1 ? "" : "s"}</span></div>
        <button type="button" className="cart-drawer-close" aria-label="Close cart" onClick={close} autoFocus>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div className="cart-drawer-body">
        {cart.error ? <p className="notice error" role="alert">{cart.error}</p> : null}
        {!cart.cart && !cart.error ? <p role="status">Loading your cart…</p> : !cart.items.length ? (
          <div className="cart-drawer-empty">
            <span aria-hidden="true">🛒</span>
            <h3>Your cart is empty</h3>
            <p>Add fresh fruit, vegetables and your everyday essentials.</p>
            <button type="button" className="btn primary" onClick={close}>Continue shopping</button>
          </div>
        ) : <>
          <FreeDeliveryProgress variant="compact" />
          {cart.unavailable.length ? <p className="notice warn">Some items are out of stock and won&apos;t be ordered.</p> : null}
          <div className="cart-drawer-items">
            {cart.items.map((item) => (
              <div key={item.itemId} className="cart-drawer-item">
                <div className="cdi-img">{item.image ? <img src={item.image} alt="" /> : null}</div>
                <div className="cdi-main">
                  <div className="cdi-top">
                    <strong className="cdi-name">{item.name}</strong>
                    <button type="button" className="cart-drawer-remove" disabled={Boolean(cart.pending[item.variant])} onClick={() => cart.remove(item.variant).catch(() => {})} aria-label={`Remove ${item.name}`} title={`Remove ${item.name}`}>
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                      </svg>
                    </button>
                  </div>
                  <span className="cdi-unit">{item.variantName || item.unit}</span>
                  <div className="cdi-bottom">
                    <strong className="cdi-price">{rupees(item.pricing?.payable ?? item.sellingPrice)}</strong>
                    <div className="cart-drawer-controls"><AddToCart variantId={item.variant} /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {summary ? <div className="bill cart-drawer-bill">
            <h3>Bill details</h3>
            <div className="bill-row"><span>Item total</span><span>{rupees(summary.mrpTotal)}</span></div>
            {summary.totalSavings > 0 ? <div className="bill-row save-row"><span>Savings</span><span>− {rupees(summary.totalSavings)}</span></div> : null}
            <div className={`bill-row${summary.deliveryFree ? " save-row" : ""}`}><span>Delivery</span><span>{summary.deliveryFree ? "FREE" : rupees(summary.deliveryCharge)}</span></div>
            {summary.packagingCharge > 0 ? <div className="bill-row"><span>Packaging</span><span>{rupees(summary.packagingCharge)}</span></div> : null}
            {summary.roundOff ? <div className="bill-row"><span>Round off</span><span>{rupees(summary.roundOff, { decimals: true })}</span></div> : null}
            <div className="bill-row total"><span>To pay</span><span>{rupees(summary.total)}</span></div>
          </div> : null}
        </>}
      </div>
      {cart.items.length && summary ? <div className="cart-drawer-foot">
        {!summary.meetsMinimum ? <p className="cart-drawer-min">Add {rupees(summary.shortfallToMinimum)} more to meet the minimum order.</p> : null}
        <div className="cart-drawer-checkout">
          <div className="cdc-total"><span>To pay</span><strong>{rupees(summary.total)}</strong></div>
          <button type="button" className="cdc-btn" disabled={!summary.meetsMinimum} onClick={() => { close(); if (gateCheckout()) return; router.push(signedIn ? "/checkout" : "/login?next=/checkout"); }}>
            <span>{signedIn ? "Checkout" : "Sign in to checkout"}</span>
            <i aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></i>
          </button>
        </div>
      </div> : null}
    </dialog>
  );
}
