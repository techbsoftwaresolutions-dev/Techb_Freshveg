"use client";

import { useState } from "react";
import AddToCart from "./AddToCart";

// Card-level pack picker: a plain <select> rather than VariantPicker's chip
// row, because this has to fit inside a product card next to a dozen others,
// not fill a whole product page. Picking a pack only changes which variant
// "ADD" adds — nothing refetches or navigates.
//
// Options list pack size only, no price: the card's headline price is
// "priceFrom" — the cheapest pack across all sizes, not necessarily this
// select's default pack — so a price printed next to a different-sized
// option here just reads as a mismatch against the number above it.
export default function SizeAndAdd({ options, defaultVariantId, disabled }) {
  const [variantId, setVariantId] = useState(
    () => options.find((o) => o.id === defaultVariantId)?.id || options[0]?.id
  );

  return (
    <div className="card-size-add">
      <select
        className="card-size-select"
        value={variantId}
        onChange={(e) => setVariantId(e.target.value)}
        aria-label="Select pack size"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <AddToCart variantId={variantId} disabled={disabled} />
    </div>
  );
}
