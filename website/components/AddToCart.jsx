"use client";

import { useCart } from "./Providers";
import { formatQty, unitSuffix } from "@/lib/format";

// The only interactive island on an otherwise server-rendered product card.
// Quantity rules come from the cart line the API returns — so a loose vegetable
// steps in quarter kilos and a packed one steps in whole packs, without this
// component knowing which is which.
export default function AddToCart({ variantId, disabled, size = "sm", qty = 1, fullWidth = false }) {
  const cart = useCart();

  if (!variantId) return null;

  const line = cart.lineFor(variantId);
  const quantity = line?.quantity || 0;
  const busy = Boolean(cart.pending[variantId]);

  if (disabled) {
    return (
      <button
        className="add-btn"
        disabled
        style={{ opacity: 0.5, cursor: "not-allowed", ...(fullWidth ? { width: "100%" } : null) }}
      >
        Sold out
      </button>
    );
  }

  if (quantity <= 0) {
    return (
      <button
        className="add-btn"
        onClick={() => cart.add(variantId, qty).catch(() => {})}
        disabled={busy}
        aria-label="Add to cart"
        style={{
          ...(size === "lg" ? { height: 48, minWidth: 150, fontSize: 15 } : null),
          ...(fullWidth ? { width: "100%" } : null),
        }}
      >
        {busy ? (
          "…"
        ) : (
          <>
            {/* the phone's card has room for only "Add" (see .add-short) */}
            <span className="add-full">Add to Cart</span>
            <span className="add-short">Add</span>
          </>
        )}
      </button>
    );
  }

  const step = line?.stepQty ?? 1;
  const min = line?.minOrderQty ?? step;
  const max = line?.maxOrderQty ?? 50;
  const suffix = unitSuffix(line);

  const change = (next) => {
    const rounded = Math.round(next * 100) / 100;
    if (rounded < min - 0.0001) cart.remove(variantId).catch(() => {});
    else cart.setQuantity(variantId, Math.min(rounded, max)).catch(() => {});
  };

  return (
    <div
      className="qty"
      style={{
        ...(size === "lg" ? { height: 48, minWidth: 150 } : null),
        ...(fullWidth ? { width: "100%", justifyContent: "space-between" } : null),
      }}
    >
      <button onClick={() => change(quantity - step)} disabled={busy} aria-label="Reduce quantity">
        −
      </button>
      <span className="value">{busy ? "…" : formatQty(quantity, suffix)}</span>
      <button
        onClick={() => change(quantity + step)}
        disabled={busy || quantity + step > max + 0.0001}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
