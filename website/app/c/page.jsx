import Link from "next/link";
import { Suspense } from "react";
import { getCategories, getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { SortBar } from "@/components/Filters";
import DepartmentNav from "@/components/DepartmentNav";
import EmptyState from "@/components/EmptyState";
import InfiniteProducts from "@/components/InfiniteProducts";
import { DeliveryBar, MobileChips, MobileRail } from "@/components/MobileBrowse";
import { SearchHead, SearchProvider, SearchSwap } from "@/components/ListingSearch";

export const metadata = {
  title: "All categories",
  description:
    "Every department at Hosur Basket — fruit and vegetables, grocery, personal care, household and general store.",
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
    ...(query.category ? { category: query.category } : {}),
    ...(query.sort ? { sort: query.sort } : {}),
    ...(query.offers === "true" ? { offers: "true" } : {}),
    ...(["discount", "special", "combo"].includes(query.offer) ? { offer: query.offer } : {}),
  };

  const [catalog, result] = await Promise.all([getCategories(), getProducts({ ...listQuery, page })]);

  const departments = catalog?.categories || [];
  const products = result?.items || [];
  const meta = result?.meta;

  // "All Fresh Fruits" in the side panel lands here as ?category=<department>:
  // the same page, just the product list narrowed to that department.
  const activeDepartment = query.category
    ? departments.find((d) => d.slug === query.category) || null
    : null;
  const heading = activeDepartment ? activeDepartment.name : "All products";

  return (
    <SearchProvider className="wrap">
      <SearchHead title={heading} backHref={activeDepartment ? "/c" : "/"} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {" › "}
        {activeDepartment ? (
          <>
            <Link href="/c">All categories</Link>
            {" › "}
            <span>{activeDepartment.name}</span>
          </>
        ) : (
          <span>All categories</span>
        )}
      </nav>

      <div className="split cat-layout has-rail">
        <MobileRail departments={departments} activeSlug={activeDepartment?.slug || null} />

        {/* Same dropdown panel as the category pages: All products opens to
            every department, each department opens to its aisles. Real links,
            so a crawler can follow them. */}
        <div className="cat-side">
          <DepartmentNav
            departments={departments}
            activeSlug={activeDepartment?.slug || null}
            total={activeDepartment ? null : meta?.total}
          />
        </div>

        <div>
          <MobileChips />

          <SearchSwap query={listQuery}>
          <div className="browse-head">
            <h1>
              {heading}
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
