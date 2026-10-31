"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddToCart from "./AddToCart";
import { useCart } from "./Providers";
import { discountPct, rupees } from "@/lib/format";

// Picking a pack changes the price and the stock line, so this part of the
// product page is a client island. Everything around it stays server HTML.
export default function VariantPicker({ product, variants }) {
  const cart = useCart();
  const router = useRouter();
  const [buying, setBuying] = useState(false);

  // Packs ticked on the page — one or several ("1 L and 5 L together"). The
  // first is the one the price block and single-pack controls describe.
  const [selectedIds, setSelectedIds] = useState(() => {
    // The default pack when it can be bought, else the first that can.
    const buyable = (v) => (v.availability?.available ?? 0) >= 1;
    const preferred =
      variants.find((v) => v.id === product.defaultVariant && buyable(v)) ||
      variants.find(buyable) ||
      variants.find((v) => v.id === product.defaultVariant) ||
      variants[0];
    return preferred?.id ? [preferred.id] : [];
  });
  const variantId = selectedIds[0] || null;
  const variant = variants.find((v) => v.id === variantId) || variants[0];

  // Several packs at once: each has its own quantity.
  const [multiQty, setMultiQty] = useState({});
  const [addingAll, setAddingAll] = useState(false);
  const picked = variants.filter((v) => selectedIds.includes(v.id)); // in the order the packs are listed
  const multi = picked.length > 1;
  const qtyOfPick = (v) => multiQty[v.id] ?? Math.max(1, v.minOrderQty ?? 1);
  const multiTotal = picked.reduce((sum, v) => sum + v.sellingPrice * qtyOfPick(v), 0);
  const multiUnits = picked.reduce((sum, v) => sum + qtyOfPick(v), 0);

  function togglePack(option) {
    const soldOut = (option.availability?.available ?? 0) < 1;
    // A sold-out pack can be looked at, but only on its own.
    if (soldOut) return setSelectedIds([option.id]);
    setSelectedIds((current) => {
      const live = current.filter((id) => (variants.find((v) => v.id === id)?.availability?.available ?? 0) >= 1);
      if (live.includes(option.id)) return live.length > 1 ? live.filter((id) => id !== option.id) : live;
      return [...live, option.id];
    });
  }

  // Adds every ticked pack, one after another so the cart settles in between.
  async function addAll() {
    setAddingAll(true);
    try {
      for (const v of picked) await cart.add(v.id, qtyOfPick(v));
      return true;
    } catch {
      // The cart's error toast already says what went wrong.
      return false;
    } finally {
      setAddingAll(false);
    }
  }

  // How many packs to add on the first tap — a shopper who already knows they
  // want three shouldn't have to hit "ADD" then "+" twice. Resets whenever the
  // selected pack changes, since its minimum can differ from the last one's.
  const minOf = (v) => Math.max(1, v?.minOrderQty ?? 1);
  const [pendingQty, setPendingQty] = useState(() => minOf(variant));
  useEffect(() => {
    setPendingQty(minOf(variant));
  }, [variantId]);

  if (!variant) return null;

  const available = variant.availability?.available ?? 0;
  const off = discountPct(variant.mrp, variant.sellingPrice);
  const alreadyInCart = cart.quantityOf(variant.id) > 0;
  const qtyMin = minOf(variant);
  const qtyMax = variant.maxOrderQty ?? 50;

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
                const soldOut = (option.availability?.available ?? 0) < 1;
                const selected = selectedIds.includes(option.id);
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
                    onClick={() => togglePack(option)}
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

      {multi ? (
        <div className="pack-multi">
          {picked.map((v) => {
            const q = qtyOfPick(v);
            const min = Math.max(1, v.minOrderQty ?? 1);
            const max = v.maxOrderQty ?? 50;
            return (
              <div className="pack-multi-row" key={v.id}>
                <div className="pack-multi-name">
                  <strong>{v.name}</strong>
                  <span>{rupees(v.sellingPrice)}</span>
                </div>
                <div className="qty">
                  <button type="button" onClick={() => setMultiQty((m) => ({ ...m, [v.id]: Math.max(min, q - 1) }))} disabled={q <= min} aria-label={`Reduce ${v.name}`}>
                    −
                  </button>
                  <span className="value">{q}</span>
                  <button type="button" onClick={() => setMultiQty((m) => ({ ...m, [v.id]: Math.min(max, q + 1) }))} disabled={q + 1 > max} aria-label={`Increase ${v.name}`}>
                    +
                  </button>
                </div>
                <strong className="pack-multi-sub">{rupees(v.sellingPrice * q)}</strong>
              </div>
            );
          })}
          <div className="pack-multi-total">
            <span>
              Total · {picked.length} packs, {multiUnits} items
            </span>
            <strong>{rupees(multiTotal)}</strong>
          </div>
        </div>
      ) : null}

      {!multi && !alreadyInCart && available >= 1 ? (
        <div className="pdp-qty">
          <span>Quantity</span>
          <div className="qty">
            <button
              type="button"
              onClick={() => setPendingQty((q) => Math.max(qtyMin, q - 1))}
              disabled={pendingQty <= qtyMin}
              aria-label="Reduce quantity"
            >
              −
            </button>
            <span className="value">{pendingQty}</span>
            <button
              type="button"
              onClick={() => setPendingQty((q) => Math.min(qtyMax, q + 1))}
              disabled={pendingQty + 1 > qtyMax}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      {!multi ? (
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
      ) : null}

      <div className="pdp-actions">
        <div>
          {multi ? (
            <button type="button" className="add-btn" disabled={addingAll} onClick={addAll} style={{ height: 48, fontSize: 15, width: "100%" }}>
              {addingAll ? "…" : `Add ${picked.length} packs to cart`}
            </button>
          ) : (
            <AddToCart variantId={variant.id} disabled={available < 1} size="lg" qty={pendingQty} fullWidth />
          )}
        </div>
        {multi || available >= 1 ? (
          <button
            type="button"
            className="btn lg pdp-buy-now"
            disabled={buying}
            onClick={async () => {
              setBuying(true);
              try {
                if (multi) {
                  if (await addAll()) router.push("/checkout");
                  return;
                }
                if (cart.quantityOf(variant.id) <= 0) await cart.add(variant.id, pendingQty);
                router.push("/checkout");
              } catch {
                // The cart's error toast already says what went wrong.
              } finally {
                setBuying(false);
              }
            }}
          >
            {buying ? "…" : "Buy now"}
          </button>
        ) : null}
      </div>
      {!multi && available >= 1 && available <= 5 ? (
        <div className="pdp-low-stock">Hurry — only {Math.floor(available)} left</div>
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
