"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddToCart from "./AddToCart";
import { useCart } from "./Providers";
import { discountPct, formatQty, rupees, unitSuffix } from "@/lib/format";

// Picking a pack changes the price and the stock line, so this part of the
// product page is a client island. Everything around it stays server HTML.
export default function VariantPicker({ product, variants }) {
  const cart = useCart();
  const router = useRouter();
  const [buying, setBuying] = useState(false);

  const [variantId, setVariantId] = useState(() => {
    const preferred =
      variants.find((v) => v.id === product.defaultVariant) ||
      variants.find((v) => (v.availability?.available ?? 0) > 0) ||
      variants[0];
    return preferred?.id || null;
  });

  const variant = variants.find((v) => v.id === variantId) || variants[0];

  // How many to add on the first tap — a shopper who already knows they want
  // three shouldn't have to hit "ADD" then "+" twice. Resets whenever the
  // selected pack changes, since its step/min rules can differ from the last
  // one's (loose produce steps in quarter kilos, a packed item in whole units).
  const [pendingQty, setPendingQty] = useState(() => variant?.minOrderQty ?? variant?.stepQty ?? 1);
  useEffect(() => {
    setPendingQty(variant?.minOrderQty ?? variant?.stepQty ?? 1);
  }, [variantId]);

  if (!variant) return null;

  const available = variant.availability?.available ?? 0;
  const off = discountPct(variant.mrp, variant.sellingPrice);
  const alreadyInCart = cart.quantityOf(variant.id) > 0;
  const qtyStep = variant.stepQty ?? 1;
  const qtyMin = variant.minOrderQty ?? qtyStep;
  const qtyMax = variant.maxOrderQty ?? 50;
  const qtySuffix = unitSuffix(variant);

  // No wrapping panel of its own any more: the product page puts this
  // inside the same card as "Product details", so the pack picker, price,
  // buttons and specs read as one unit instead of two stacked boxes.
  return (
    <>
      {variants.length > 1 ? (
          <section className="pack-picker">
            <h3>Choose a pack</h3>
            <div className="pack-options">
              {variants.map((option) => {
                const soldOut = (option.availability?.available ?? 0) <= 0;
                const selected = option.id === variantId;
                // Only the selected pack gets an AddToCart control below, so
                // without this a pack you already have in your cart looks
                // empty the moment you switch to a different one — the line
                // is still there (cart total/header are unaffected), it's
                // just not visible on this page until you flip back to it.
                const inCartQty = cart.quantityOf(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setVariantId(option.id)}
                    className={`pack-option${selected ? " on" : ""}${soldOut ? " sold-out" : ""}`}
                    aria-pressed={selected}
                  >
                    {inCartQty > 0 ? <span className="pack-in-cart">{inCartQty} in cart</span> : null}
                    <strong>{option.name}</strong>
                    <span>
                      {rupees(option.sellingPrice)}
                      {soldOut ? " · sold out" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

      {!alreadyInCart && available > 0 ? (
        <div className="pdp-qty">
          <span>Quantity</span>
          <div className="qty">
            <button
              type="button"
              onClick={() => setPendingQty((q) => Math.max(qtyMin, Math.round((q - qtyStep) * 100) / 100))}
              disabled={pendingQty <= qtyMin + 0.0001}
              aria-label="Reduce quantity"
            >
              −
            </button>
            <span className="value">{formatQty(pendingQty, qtySuffix)}</span>
            <button
              type="button"
              onClick={() => setPendingQty((q) => Math.min(qtyMax, Math.round((q + qtyStep) * 100) / 100))}
              disabled={pendingQty + qtyStep > qtyMax + 0.0001}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      <div className="pdp-price">
        {/* With one pack there is no picker to say what the price buys, so
            say it here — "₹68" alone could be for any amount. */}
        {variants.length === 1 && variant.name ? (
          <div className="pdp-pack">
            Pack size <strong>{packLabel(variant)}</strong>
          </div>
        ) : null}
        <div className="pdp-price-row">
          <span className="pdp-price-now">{rupees(variant.sellingPrice)}</span>
          {off > 0 ? (
            <>
              <span className="mrp">MRP {rupees(variant.mrp)}</span>
              <span className="pill save">{off}% off</span>
            </>
          ) : null}
        </div>
        <div className="pdp-price-note">
          {variant.unitPrice ? (
            // Lets someone compare a 1 KG pack against a 5 KG one honestly.
            <span>{rupees(variant.unitPrice.amount)} per {variant.unitPrice.unit} · </span>
          ) : null}
          Inclusive of all taxes
        </div>
      </div>

      <div className="pdp-actions">
        <div>
          <AddToCart variantId={variant.id} disabled={available <= 0} size="lg" qty={pendingQty} fullWidth />
        </div>
        {available > 0 ? (
          <button
            type="button"
            className="btn lg pdp-buy-now"
            disabled={buying}
            onClick={async () => {
              setBuying(true);
              try {
                if (cart.quantityOf(variant.id) <= 0) await cart.add(variant.id, pendingQty);
                router.push("/checkout");
              } catch {
                // AddToCart's own error handling already surfaces the
                // problem via cart.error — nothing more to do here.
              } finally {
                setBuying(false);
              }
            }}
          >
            {buying ? "…" : "Buy now"}
          </button>
        ) : null}
      </div>
      {available > 0 && available <= 5 ? (
        <div className="pdp-low-stock">Hurry — only {available} left</div>
      ) : null}

      {cart.error ? (
        <p className="notice error" style={{ marginTop: 12 }}>
          {cart.error}
        </p>
      ) : null}
    </>
  );
}

// What one pack physically is, from its recorded size — the same figure the
// per-kg price and the product cards are worked out from, so the three always
// agree even if the pack's typed name says otherwise. The name is the
// fallback, tidied from "2 KG" to "2 kg".
function packLabel(variant) {
  const size = variant.packSize;
  if (size?.value > 0 && size.unit) {
    const trim = (n) => Number(n.toFixed(2)).toString();
    if (size.unit === "kg" && size.value < 1) return `${trim(size.value * 1000)} g`;
    if (size.unit === "l" && size.value < 1) return `${trim(size.value * 1000)} ml`;
    if (size.unit === "pcs") return size.value === 1 ? "1 piece" : `${trim(size.value)} pieces`;
    return `${trim(size.value)} ${size.unit}`;
  }
  return String(variant.name).replace(/^(\d+(?:\.\d+)?)\s*(KG|G|ML|L)$/i, (_, n, unit) => `${n} ${unit.toLowerCase()}`);
}
