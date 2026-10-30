import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, SITE_URL } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import Carousel from "@/components/Carousel";
import VariantPicker from "@/components/VariantPicker";
import ProductGallery from "@/components/ProductGallery";
import ProductTabs from "@/components/ProductTabs";
import ShareRow from "@/components/ShareRow";
import { discountPct, offerLabel, productMedia, rupees } from "@/lib/format";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) return { title: "Product" };

  const { product } = data;
  const title = product.seo?.title || product.name;
  const description =
    product.seo?.description ||
    product.shortDescription ||
    `Buy ${product.name} online at Hosur Basket. Delivered fresh from your neighbourhood store.`;

  return {
    title,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} | Hosur Basket`,
      description,
      url: `${SITE_URL}/p/${product.slug}`,
      images: productMedia(product)[0]?.url ? [productMedia(product)[0].url] : undefined,
    },
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) notFound();

  const { product, variants = [], specs = [], features = {}, related = [], breadcrumb = [] } = data;
  const media = productMedia(product);

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
    image: media.map((m) => m.url).filter(Boolean),
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
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
            media={media}
            name={product.name}
            badge={off > 0 ? <span className="badge">{off}% OFF</span> : null}
          />
        </div>

        <div className="pdp-info">
          {/* One card: pack picker, price and buttons together. */}
          <div className="panel pdp-buy">
            <div className="pdp-summary">
              <ShareRow name={product.name} />
              {product.brand?.name ? <span className="pdp-brand">{product.brand.name}</span> : null}
              <h1 className="pdp-title">{product.name}</h1>
              {breadcrumb.length ? (
                <Link className="pdp-similar-link" href={`/c/${breadcrumb[breadcrumb.length - 1].slug}`}>
                  View all similar products
                </Link>
              ) : null}
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
              {product.offer?.kind === "combo" && product.offer.details ? (
                <p className="pdp-lede"><strong>Combo includes:</strong> {product.offer.details}</p>
              ) : null}
              <div className="pdp-tags">
                {offerLabel(product.offer) ? <span className="pill save">{offerLabel(product.offer)}</span> : null}
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
            </div>
            <VariantPicker product={product} variants={variants} />
          </div>

          <div className="panel pdp-tabs-panel">
            <ProductTabs product={product} specs={specs} />
          </div>
        </div>
      </div>

      {related.length ? (
        <section className="section pdp-related">
          <div className="section-head">
            <h2>You may also like</h2>
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
