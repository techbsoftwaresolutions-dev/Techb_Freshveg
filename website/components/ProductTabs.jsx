"use client";

import { useState } from "react";
import ReviewsPanel from "./ReviewsPanel";

// Description / Ingredients / Reviews, switched client-side. Ingredients
// only appears when the product actually has that text — the field exists
// on every product, but nothing is seeded with it yet, so most products
// simply won't show the tab rather than showing an empty one.
export default function ProductTabs({ product }) {
  const tabs = [
    { key: "description", label: "Description" },
    ...(product.ingredients ? [{ key: "ingredients", label: "Ingredients" }] : []),
    { key: "reviews", label: product.rating?.count ? `Reviews (${product.rating.count})` : "Reviews" },
  ];
  const [active, setActive] = useState(tabs[0].key);

  return (
    <section className="pdp-tabs">
      <div className="pdp-tab-list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            className={`pdp-tab${active === tab.key ? " on" : ""}`}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pdp-tab-body" role="tabpanel">
        {active === "description" ? (
          product.description ? (
            <p style={{ color: "var(--text-muted)" }}>{product.description}</p>
          ) : (
            <p style={{ color: "var(--text-faint)" }}>No description yet.</p>
          )
        ) : null}

        {active === "ingredients" ? (
          <p style={{ color: "var(--text-muted)", whiteSpace: "pre-line" }}>{product.ingredients}</p>
        ) : null}

        {active === "reviews" ? <ReviewsPanel productId={product.id} rating={product.rating} /> : null}
      </div>
    </section>
  );
}
