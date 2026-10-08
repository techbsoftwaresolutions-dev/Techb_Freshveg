"use client";

import { useCart } from "./Providers";

// The only interactive island on an otherwise server-rendered product card.
// A cart quantity is a count of this variant — packs or pieces — so every tap
// adds or removes exactly one; the pack's weight stays on the card.
export default function AddToCart({ variantId, disabled, size = "sm", qty = 1, fullWidth = false }) {
  const cart = useCart();

  if (!variantId) return null;

  const line = cart.lineFor(variantId);
  const quantity = line?.quantity || 0;
  const busy = Boolean(cart.pending[variantId]);

  if (disabled || (quantity <= 0 && cart.soldOut[variantId])) {
    return (
      <button
        className="add-btn add-oos"
        disabled
        style={{ opacity: 0.5, cursor: "not-allowed", ...(fullWidth ? { width: "100%" } : null) }}
      >
        Out of stock
      </button>
    );
  }

  if (quantity <= 0) {
    return (
      <button
        className="add-btn"
        onClick={() => cart.add(variantId, qty).catch(() => {})}
        disabled={busy}
        aria-label="Add to basket"
        aria-busy={busy}
        style={{
          ...(size === "lg" ? { height: 48, minWidth: 150, fontSize: 15 } : null),
          ...(fullWidth ? { width: "100%" } : null),
        }}
      >
        {busy ? (
          <Dots />
        ) : (
          <>
            {/* the phone's card has room for only "Add" (see .add-short) */}
            <span className="add-full">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 3.5h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.2" />
                <circle cx="9.5" cy="20" r="1.4" />
                <circle cx="17.5" cy="20" r="1.4" />
              </svg>
              Add to Basket
            </span>
            <span className="add-short">Add</span>
          </>
        )}
      </button>
    );
  }

  const min = Math.max(1, line?.minOrderQty ?? 1);
  const max = line?.maxOrderQty ?? 50;

  const change = (next) => {
    if (next < min) cart.remove(variantId).catch(() => {});
    else cart.setQuantity(variantId, Math.min(next, max)).catch(() => {});
  };

  return (
    <div
      className="qty"
      style={{
        ...(size === "lg" ? { height: 48, minWidth: 150 } : null),
        ...(fullWidth ? { width: "100%", justifyContent: "space-between" } : null),
      }}
    >
      <button onClick={() => change(quantity - 1)} disabled={busy} aria-label="Reduce quantity">
        −
      </button>
      <span className="value" aria-busy={busy}>
        {busy ? <Dots /> : quantity}
      </span>
      <button onClick={() => change(quantity + 1)} disabled={busy || quantity + 1 > max} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}

// "..." while the cart request is out — three dots that pulse in turn.
function Dots() {
  return (
    <span className="dots" role="status" aria-label="Updating cart">
      <i />
      <i />
      <i />
    </span>
  );
}
