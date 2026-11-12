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
    ...(query.sort ? { sort: query.sort } : {}),
    ...(query.offers === "true" ? { offers: "true" } : {}),
    ...(["discount", "special", "combo"].includes(query.offer) ? { offer: query.offer } : {}),
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
          <nav className="aisles sticky" aria-label="Categories">
            <span className="aisles-item current" aria-current="page">
              All products
              {meta?.total ? <span className="aisles-count">{meta.total}</span> : null}
            </span>

            {departments.map((department) => (
              <div key={department.id} className="aisles-group">
                <Link href={`/c/${department.slug}`} className="aisles-head">
                  {department.image ? (
                    <img src={img(department.image, 80)} alt="" className="aisles-head-icon aisles-head-photo" />
                  ) : (
                    <CategoryIcon name={department.name} className="aisles-head-icon" />
                  )}
                  {department.name}
                </Link>
                {department.children?.map((aisle) => (
                  <Link key={aisle.id} href={`/c/${aisle.slug}`} className="aisles-item">
                    {aisle.name}
                    {aisle.productCount ? (
                      <span className="aisles-count">{aisle.productCount}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ))}
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
