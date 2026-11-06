"use client";

import ReviewsPanel from "./ReviewsPanel";

// Product information stays together in compact, expandable rows.
export default function ProductTabs({ product, specs = [] }) {
  return (
    <section className="pdp-accordions" aria-label="Product information">
      <details className="pdp-accordion">
        <summary>Description</summary>
        <div className="pdp-accordion-body">
          {product.description ? (
            <p>{product.description}</p>
          ) : (
            <p className="muted">No description yet.</p>
          )}
          {product.ingredients ? <p><strong>Ingredients:</strong> {product.ingredients}</p> : null}
        </div>
      </details>

      <details className="pdp-accordion">
        <summary>Product Details</summary>
        {specs.length ? (
          <dl className="pdp-accordion-specs">
            {specs.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{formatSpec(spec.value)}{spec.unit ? ` ${spec.unit}` : ""}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="pdp-accordion-body"><p className="muted">No product details available.</p></div>
        )}
      </details>

      <details className="pdp-accordion">
        <summary>{product.rating?.count ? `Reviews (${product.rating.count})` : "Reviews"}</summary>
        <div className="pdp-accordion-body">
          <ReviewsPanel productId={product.id} rating={product.rating} />
        </div>
      </details>
    </section>
  );
}

function formatSpec(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
