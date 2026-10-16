import Link from "next/link";
import { img } from "@/lib/format";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCategories, getCategory, getProducts, SITE_URL } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import Filters, { ActiveFilters, SortBar } from "@/components/Filters";
import { DeliveryBar, MobileChips, MobileRail } from "@/components/MobileBrowse";
import { SearchHead, SearchProvider, SearchSwap } from "@/components/ListingSearch";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import InfiniteProducts from "@/components/InfiniteProducts";
import TrustStrip from "@/components/TrustStrip";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getCategory(slug);
  if (!data) return { title: "Category" };

  const { category } = data;
  return {
    title: category.seo?.title || `Buy ${category.name} online`,
    description:
      category.seo?.description ||
      category.description ||
      `Shop ${category.name} at Hosur Basket. Fresh stock, honest prices, delivered from your neighbourhood store.`,
    alternates: { canonical: `/c/${category.slug}` },
    openGraph: {
      title: `${category.name} | Hosur Basket`,
      description: category.description || undefined,
      url: `${SITE_URL}/c/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;

  const landing = await getCategory(slug);
  if (!landing) notFound();

  const {
    category,
    breadcrumb = [],
    children = [],
    // Facets, not the schema's `filters`: only values this shelf actually has.
    facets: filters = [],
    brands = [],
    priceBands = [],
    availability,
    features = {},
  } = landing;

  // Attribute filters arrive as attr.<code>=a,b — passed straight through to
  // the API, which knows what the codes mean. Nothing is enumerated here.
  const apiQuery = { category: slug, limit: 20, page: query.page || 1 };
  if (query.sort) apiQuery.sort = query.sort;
  if (query.brand) apiQuery.brand = query.brand;
  if (query.maxPrice) apiQuery.maxPrice = query.maxPrice;
  if (query.inStock === "true") apiQuery.inStock = "true";
  if (query.offers === "true") apiQuery.offers = "true";
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("attr.")) apiQuery[key] = value;
  }

  const parent = [...breadcrumb].reverse().find((step) => step.slug !== slug);
  const departments = (await getCategories())?.categories || [];

  const result = await getProducts(apiQuery);
  const products = result?.items || [];
  const meta = result?.meta;

  return (
    <SearchProvider className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {breadcrumb.map((step) => (
          <span key={step.id}>
            {" › "}
            <Link href={`/c/${step.slug}`}>{step.name}</Link>
          </span>
        ))}
      </nav>

      {/* No visible title block: the breadcrumb and the highlighted category
          bar already say where you are, so the page opens straight onto the
          aisles and products. The heading stays for search engines and
          screen readers, which need a page title to know what this is. */}
      <h1 className="sr-only">{category.name}</h1>

      <SearchHead title={category.name} backHref={parent ? `/c/${parent.slug}` : "/c"} />

      {children.length ? (
        <nav className="top-cats aisle-tiles cat-hide-mobile" aria-label={`Inside ${category.name}`}>
          {children.map((child) => (
            <Link key={child.id} href={`/c/${child.slug}`} className="top-cat">
              <span className="top-cat-icon">
                {child.image ? (
                  <img src={img(child.image, 160)} alt="" className="top-cat-photo" />
                ) : (
                  <CategoryIcon name={child.name} />
                )}
              </span>
              <span className="top-cat-name">{child.name}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="split browse cat-layout has-rail">
        <MobileRail departments={departments} activeSlug={slug} />

        <Suspense fallback={<aside />}>
          <Filters filters={filters} brands={brands} priceBands={priceBands} availability={availability} />
        </Suspense>

        <div>
          <MobileChips facets={{ filters, brands, priceBands, availability }} />

          <SearchSwap query={{ ...apiQuery, page: undefined }}>
          <div className="browse-head">
            <h2 className="browse-total">
              {meta?.total ?? products.length}{" "}
              {(meta?.total ?? products.length) === 1 ? "product" : "products"}
            </h2>
            <Suspense fallback={null}>
              <SortBar />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <ActiveFilters filters={filters} brands={brands} priceBands={priceBands} />
          </Suspense>

          {products.length ? (
            <>
              <div className="product-grid wide">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {meta && meta.pages > meta.page ? (
                <InfiniteProducts
                  key={JSON.stringify(apiQuery)}
                  query={{ ...apiQuery, page: undefined }}
                  startPage={meta.page + 1}
                  pages={meta.pages}
                  seenIds={products.map((p) => p.id)}
                />
              ) : null}
            </>
          ) : (meta?.total ?? 0) === 0 && !hasFilters(query) ? (
            <EmptyState icon="box" title="Nothing here yet" actions={[{ href: "/c", label: "Browse all products" }]}>
              New stock for {category.name} is on its way. Check back soon.
            </EmptyState>
          ) : (
            <EmptyState
              icon="filter"
              title="Nothing matches those filters"
              actions={[{ href: `/c/${slug}`, label: "Clear filters" }]}
            >
              Try removing a filter, or browse a subcategory above.
            </EmptyState>
          )}
          </SearchSwap>
        </div>
      </div>

      <DeliveryBar />
      <TrustStrip />
    </SearchProvider>
  );
}

function hasFilters(query) {
  return Object.keys(query).some(
    (key) => key.startsWith("attr.") || key === "brand" || key === "maxPrice" || key === "inStock"
  );
}
