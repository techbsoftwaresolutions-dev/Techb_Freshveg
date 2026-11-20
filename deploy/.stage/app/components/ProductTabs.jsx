"use client";

import ReviewsPanel from "./ReviewsPanel";

// Product information stays together in compact, expandable rows. "Product details" is
// open by default and is never empty: when the product has no hand-written specs it is
// built from what we do know (brand, pack sizes, shelf life, returns, origin ...).
export default function ProductTabs({ product, specs = [], variants = [], category = null, features = {} }) {
  const details = specs.length ? specs.map((s) => ({ label: s.label, value: `${formatSpec(s.value)}${s.unit ? ` ${s.unit}` : ""}` })) : autoDetails({ product, variants, category, features });

  return (
    <section className="pdp-accordions" aria-label="Product information">
      <details className="pdp-accordion" open>
        <summary>Product details</summary>
        {details.length ? (
          <dl className="pdp-accordion-specs">
            {details.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="pdp-accordion-body"><p className="muted">Details will be added soon.</p></div>
        )}
      </details>

      <details className="pdp-accordion">
        <summary>Description</summary>
        <div className="pdp-accordion-body">
          {product.description ? (
            <p>{product.description}</p>
          ) : product.shortDescription ? (
            <p>{product.shortDescription}</p>
          ) : (
            <p className="muted">No description yet.</p>
          )}
          {product.ingredients ? <p><strong>Ingredients:</strong> {product.ingredients}</p> : null}
        </div>
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

const ATTRIBUTE_LABELS = { origin: "Origin", variety: "Variety", storage_instructions: "Storage", organic: "Organic", is_veg: "Vegetarian", fssai_licence: "FSSAI licence", ingredients_list: "Ingredients" };

function autoDetails({ product, variants, category, features }) {
  const rows = [];
  if (product.brand?.name) rows.push({ label: "Brand", value: product.brand.name });
  if (category?.name) rows.push({ label: "Category", value: category.name });
  const sizes = variants.map((v) => v.name || (v.packSize ? `${v.packSize.value} ${v.packSize.unit}` : "")).filter(Boolean);
  if (sizes.length) rows.push({ label: sizes.length > 1 ? "Available sizes" : "Pack size", value: sizes.join(", ") });
  if (product.shelfLifeDays) rows.push({ label: "Shelf life", value: `${product.shelfLifeDays} day${product.shelfLifeDays === 1 ? "" : "s"}` });
  for (const [key, label] of Object.entries(ATTRIBUTE_LABELS)) {
    const v = product.attributes?.[key];
    if (v !== undefined && v !== null && v !== "") rows.push({ label, value: formatSpec(v) });
  }
  rows.push({ label: "Returns", value: features.returnable ? (product.returnWindowDays ? `${product.returnWindowDays}-day return` : "Returnable") : "Not returnable" });
  if (variants.some((v) => v.taxInclusive !== false)) rows.push({ label: "Price", value: "Inclusive of all taxes" });
  return rows;
}

function formatSpec(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
