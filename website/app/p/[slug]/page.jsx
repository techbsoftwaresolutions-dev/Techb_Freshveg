import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, SITE_URL } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import Carousel from "@/components/Carousel";
import VariantPicker from "@/components/VariantPicker";
import ProductGallery from "@/components/ProductGallery";
import PdpDelivery from "@/components/PdpDelivery";
import ProductTabs from "@/components/ProductTabs";
import { discountPct, rupees } from "@/lib/format";
import { SHARE_IMAGE, imageAlt, jsonLdHtml } from "@/lib/seo";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) return { title: "Product" };

  const { product } = data;
  const title = product.seo?.title || `Buy ${product.name} Online in Bangalore`;
  const description =
    product.seo?.description ||
    `Buy fresh ${product.name} online in Bangalore at The Farmers Basket — sourced direct from local farmers. ` +
      (product.shortDescription ? `${product.shortDescription} ` : "") +
      "Same-day home delivery, free delivery on qualifying orders.";

  return {
    title,
    description,
    keywords: [
      ...(product.seo?.keywords || []),
      `${product.name} online Bangalore`,
      `buy ${product.name.toLowerCase()} online`,
      `fresh ${product.name.toLowerCase()} delivery`,
      "direct from farmers Bangalore",
    ],
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${title} | The Farmers Basket`,
      description,
      url: `${SITE_URL}/p/${product.slug}`,
      images: product.media?.[0]?.url
        ? [{ url: product.media[0].url, alt: imageAlt(product.name, product.media[0]) }]
        : [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title: `${title} | The Farmers Basket`, description },
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) notFound();

  const { product, variants = [], specs = [], features = {}, related = [], breadcrumb = [] } = data;

  const cheapest = variants.reduce(
    (low, v) => (!low || v.sellingPrice < low.sellingPrice ? v : low),
    null
  );
  const off = discountPct(cheapest?.mrp, cheapest?.sellingPrice);
  const anyInStock = variants.some((v) => (v.availability?.available ?? 0) > 0);

  // Product structured data, so a search engine can show price and stock in
  // the result itself. Offers are per variant — that is what schema.org's
  // AggregateOffer is for.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description || undefined,
    url: `${SITE_URL}/p/${product.slug}`,
    // Each photo with its alt text as the caption, for Google Images.
    image: (product.media || [])
      .filter((m) => m?.url)
      .map((m, index) => ({
        "@type": "ImageObject",
        url: m.url,
        contentUrl: m.url,
        caption: imageAlt(product.name, m, index),
        name: product.name,
      })),
    sku: cheapest?.sku,
    brand: product.brand?.name ? { "@type": "Brand", name: product.brand.name } : undefined,
    category: breadcrumb.map((b) => b.name).join(" > ") || undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: (Math.min(...variants.map((v) => v.sellingPrice)) / 100).toFixed(2),
      highPrice: (Math.max(...variants.map((v) => v.sellingPrice)) / 100).toFixed(2),
      offerCount: variants.length,
      availability: anyInStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      areaServed: { "@type": "City", name: "Bengaluru" },
      seller: { "@type": "Organization", name: "The Farmers Basket", url: SITE_URL },
    },
    ...(product.rating?.count
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
          },
        }
      : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ...breadcrumb.map((step, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: step.name,
        item: `${SITE_URL}/c/${step.slug}`,
      })),
      { "@type": "ListItem", position: breadcrumb.length + 2, name: product.name },
    ],
  };

  return (
    <div className="wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(jsonLd)}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(breadcrumbLd)}
      />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {breadcrumb.map((step) => (
          <span key={step.id}>
            {" › "}
            <Link href={`/c/${step.slug}`}>{step.name}</Link>
          </span>
        ))}
        {" › "}
        <span>{product.name}</span>
      </nav>

      {/* Columns set in CSS, not inline: an inline style outranks the media
          query that stacks them on a phone. */}
      <div className="split pdp">
        <div className="sticky">
          <ProductGallery
            media={product.media}
            name={product.name}
            badge={off > 0 ? <span className="badge">{off}% OFF</span> : null}
          />
        </div>

        <div className="pdp-info">
          {product.brand?.name ? <span className="pdp-brand">{product.brand.name}</span> : null}
          <h1 className="pdp-title">{product.name}</h1>

          {product.rating?.count ? (
            <div className="rating-row">
              <span className="rating-stars" style={{ "--rating": product.rating.average }} aria-hidden="true" />
              <span className="rating-value">{Number(product.rating.average).toFixed(1)}</span>
              <span className="rating-count">
                ({product.rating.count} review{product.rating.count === 1 ? "" : "s"})
              </span>
            </div>
          ) : null}

          {product.shortDescription ? <p className="pdp-lede">{product.shortDescription}</p> : null}

          {/* Badges driven by the category's capability flags, not by product type. */}
          <div className="pdp-tags">
            {features.perishable ? <span className="pill brand">Fresh stock</span> : null}
            {product.attributes?.organic ? <span className="pill save">Organic</span> : null}
            {features.returnable ? (
              <span className="pill">
                {product.returnWindowDays ? `${product.returnWindowDays}-day return` : "Returnable"}
              </span>
            ) : (
              <span className="pill accent">No returns</span>
            )}
            {features.allowSubstitution ? <span className="pill">Substitution allowed</span> : null}
          </div>

          {/* One card: pack picker, price and buttons together. */}
          <div className="panel pdp-buy">
            <VariantPicker product={product} variants={variants} />
          </div>

          <PdpDelivery />

          {specs.length ? (
            <div className="panel pdp-specs">
              <h3>Product details</h3>
              <dl>
                {specs.map((spec) => (
                  <div key={spec.label}>
                    <dt>{spec.label}</dt>
                    <dd>
                      {formatSpec(spec.value)}
                      {spec.unit ? ` ${spec.unit}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <ProductTabs product={product} />
        </div>
      </div>

      {related.length ? (
        <section className="section">
          <div className="section-head">
            <h2 className="accent">You may also like</h2>
          </div>
          <Carousel label="You may also like">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </Carousel>
        </section>
      ) : null}
    </div>
  );
}

function formatSpec(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
