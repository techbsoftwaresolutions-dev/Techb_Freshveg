import Link from "next/link";
import { img } from "@/lib/format";
import { Suspense } from "react";
import { getCategories, getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { SortBar } from "@/components/Filters";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import InfiniteProducts from "@/components/InfiniteProducts";
import { DeliveryBar, MobileChips, MobileRail } from "@/components/MobileBrowse";
import { SearchHead, SearchProvider, SearchSwap } from "@/components/ListingSearch";

export const metadata = {
  title: "Shop Fresh Vegetables, Fruits & Milk Online in Bangalore",
  description:
    "Shop every fresh vegetable, fruit and dairy product at The Farmers Basket — leafy greens, organic and export-quality produce, " +
    "sourced direct from farmers and delivered across Bangalore. Free delivery on qualifying orders.",
  alternates: { canonical: "/c" },
};

// Twelve fills the four-column grid exactly three times, so the last row of
// a full page is never a ragged one or two cards.
const PER_PAGE = 12;

export default async function CategoriesPage({ searchParams }) {
  const query = (await searchParams) || {};
  const page = Number(query.page) || 1;

  // Everything but the page number: the phone's infinite scroll reuses it to
  // fetch the pages after this one.
  const listQuery = {
    limit: PER_PAGE,
    ...(query.sort ? { sort: query.sort } : {}),
    ...(query.offers === "true" ? { offers: "true" } : {}),
  };

  const [catalog, result] = await Promise.all([getCategories(), getProducts({ ...listQuery, page })]);

  const departments = catalog?.categories || [];
  const products = result?.items || [];
  const meta = result?.meta;

  return (
    <SearchProvider className="wrap">
      <SearchHead title="All products" backHref="/" />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {" › "}
        <span>All categories</span>
      </nav>

      <div className="split cat-layout has-rail">
        <MobileRail departments={departments} activeSlug={null} />

        {/* The aisle rail. Real links, one URL per aisle, so a crawler can
            follow them and a shopper can bookmark where they got to. */}
        <aside>
          <nav className="cat-panel sticky" aria-label="Categories">
            <div className="cat-panel-title">Shop by Category</div>

            <span className="cat-panel-dept current" aria-current="page">
              <span className="cat-panel-thumb cat-panel-thumb-all" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
                  <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
                  <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
                  <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
                </svg>
              </span>
              <span className="cat-panel-name">All products</span>
              {meta?.total ? <span className="cat-panel-count">{meta.total}</span> : null}
            </span>

            {departments.map((department) => {
              const aisles = department.children || [];
              const total =
                department.productCount || aisles.reduce((sum, aisle) => sum + (aisle.productCount || 0), 0);
              return (
                <div key={department.id} className="cat-panel-group">
                  <Link href={`/c/${department.slug}`} className="cat-panel-dept">
                    <span className="cat-panel-thumb">
                      {department.image ? <img src={img(department.image, 96)} alt={`${department.name} — fresh from farmers`} loading="lazy" /> : <CategoryIcon name={department.name} />}
                    </span>
                    <span className="cat-panel-name">{department.name}</span>
                    {total ? <span className="cat-panel-count">{total}</span> : null}
                  </Link>
                  {aisles.length ? (
                    <div className="cat-panel-aisles">
                      {aisles.map((aisle) => (
                        <Link key={aisle.id} href={`/c/${aisle.slug}`} className="cat-panel-aisle">
                          <span>{aisle.name}</span>
                          {aisle.productCount ? <span className="cat-panel-aisle-count">{aisle.productCount}</span> : null}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <div>
          <MobileChips />

          <SearchSwap query={listQuery}>
          <div className="browse-head">
            <h1>
              All products
              {meta?.total ? <span className="browse-count">{meta.total} items</span> : null}
            </h1>
            <Suspense fallback={null}>
              <SortBar />
            </Suspense>
          </div>

          {products.length ? (
            <>
              <div className="product-grid wide">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {meta && meta.pages > 1 ? <Pagination meta={meta} query={query} /> : null}
              {meta && meta.pages > page ? (
                <InfiniteProducts
                  key={JSON.stringify(listQuery)}
                  query={listQuery}
                  startPage={page + 1}
                  pages={meta.pages}
                  seenIds={products.map((p) => p.id)}
                />
              ) : null}
            </>
          ) : (
            <EmptyState icon="box" title="Nothing to show yet" actions={[{ href: "/", label: "Go to home" }]}>
              Products appear here as soon as the store adds them.
            </EmptyState>
          )}
          </SearchSwap>
        </div>
      </div>

      <DeliveryBar />
    </SearchProvider>
  );
}

// Numbered pages, as real links. Someone deep in a catalogue wants to jump,
// not press "next" eleven times.
function Pagination({ meta, query }) {
  const linkFor = (page) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key !== "page" && value) params.set(key, String(value));
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/c${qs ? `?${qs}` : ""}`;
  };

  // A window around the current page rather than every page: forty page
  // numbers is not navigation, it is wallpaper.
  const pages = [];
  const first = Math.max(1, Math.min(meta.page - 2, meta.pages - 4));
  const last = Math.min(meta.pages, first + 4);
  for (let p = first; p <= last; p += 1) pages.push(p);

  return (
    <nav className="pager" aria-label="Pagination">
      <span className="pager-status">
        Page {meta.page} of {meta.pages}
      </span>

      {meta.page > 1 ? (
        <Link href={linkFor(meta.page - 1)} className="pager-step" rel="prev">
          Previous
        </Link>
      ) : (
        <span className="pager-step disabled">Previous</span>
      )}

      {first > 1 ? (
        <>
          <Link href={linkFor(1)} className="pager-page">1</Link>
          {first > 2 ? <span className="pager-gap">…</span> : null}
        </>
      ) : null}

      {pages.map((p) =>
        p === meta.page ? (
          <span key={p} className="pager-page current" aria-current="page">
            {p}
          </span>
        ) : (
          <Link key={p} href={linkFor(p)} className="pager-page">
            {p}
          </Link>
        )
      )}

      {last < meta.pages ? (
        <>
          {last < meta.pages - 1 ? <span className="pager-gap">…</span> : null}
          <Link href={linkFor(meta.pages)} className="pager-page">
            {meta.pages}
          </Link>
        </>
      ) : null}

      {meta.hasNext ? (
        <Link href={linkFor(meta.page + 1)} className="pager-step" rel="next">
          Next
        </Link>
      ) : (
        <span className="pager-step disabled">Next</span>
      )}
    </nav>
  );
}
