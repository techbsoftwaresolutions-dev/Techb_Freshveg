import Link from "next/link";
import { discountPct, rupees } from "@/lib/format";
import AddToCart from "./AddToCart";
import WishlistButton from "./WishlistButton";

// Server-rendered: the card itself is HTML a crawler can read, with only the
// add-to-cart control hydrated as a client island.
export default function ProductCard({ product }) {
  const price = product.priceFrom;
  const mrp = product.mrpFrom;
  const off = discountPct(mrp, price);
  const primaryMedia = product.media?.[0];
  const image = primaryMedia?.url;
  // Falls back to dead-center for older photos saved before this existed.
  const focalX = primaryMedia?.focalX ?? 50;
  const focalY = primaryMedia?.focalY ?? 50;
  const outOfStock = product.inStock === false;

  const multi = product.variantCount > 1;
  // What the price actually buys. A figure with no size beside it cannot be
  // compared — ₹155 means nothing until you know it is 5 kg. The API sends the
  // default variant's pack size; the unit is the fallback for older payloads.
  const size = product.packLabel || product.unit || "";

  // Sold out means there's nothing to view — a details page for a product
  // you can't buy just wastes the tap, so the card stops navigating and only
  // the built-in "Out of stock" pill/overlay is left to look at.
  const MediaWrap = outOfStock ? "div" : Link;
  const mediaProps = outOfStock ? {} : { href: `/p/${product.slug}` };
  const NameWrap = outOfStock ? "div" : Link;
  const nameProps = outOfStock ? {} : { href: `/p/${product.slug}` };

  return (
    <article className="card">
      <div className="card-media-wrap">
        <MediaWrap {...mediaProps} className="card-media" aria-label={product.name}>
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              style={{ objectPosition: `${focalX}% ${focalY}%` }}
            />
          ) : null}
          {off > 0 && !outOfStock ? <span className="badge">{off}% OFF</span> : null}
          {outOfStock ? (
            <span className="out-overlay">
              <span className="pill danger">Out of stock</span>
            </span>
          ) : null}
        </MediaWrap>
        <WishlistButton productId={product.id} variantId={product.defaultVariant} />
      </div>

      <NameWrap {...nameProps}>
        <h3 className="card-name">{product.name}</h3>
      </NameWrap>
      <div className="card-pack">{size}</div>

      <div className="card-foot">
        <div>
          <span className="price">{rupees(price)}</span>
          {off > 0 ? <span className="mrp">{rupees(mrp)}</span> : null}
        </div>
        <AddToCart variantId={product.defaultVariant} disabled={outOfStock} />
      </div>
    </article>
  );
}
