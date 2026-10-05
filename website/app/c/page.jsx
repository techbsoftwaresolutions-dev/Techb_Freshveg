import Link from "next/link";
import { img } from "@/lib/format";
import { Suspense } from "react";
import { getCategories, getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { SortBar } from "@/components/Filters";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";

export const metadata = {
  title: "All categories",
  description:
    "Every department at FreshMart — fruit and vegetables, grocery, personal care, household and general store.",
  alternates: { canonical: "/c" },
};

// Twelve fills the four-column grid exactly three times, so the last row of
// a full page is never a ragged one or two cards.
const PER_PAGE = 12;

export default async function CategoriesPage({ searchParams }) {
  const query = (await searchParams) || {};
  const page = Number(query.page) || 1;

  const [catalog, result] = await Promise.all([
    getCategories(),
    getProducts({ limit: PER_PAGE, page, ...(query.sort ? { sort: query.sort } : {}) }),
  ]);

  const departments = catalog?.categories || [];
  const products = result?.items || [];
  const meta = result?.meta;

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {" › "}
        <span>All categories</span>
      </nav>

      <div className="split">
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
            </>
          ) : (
            <EmptyState icon="box" title="Nothing to show yet" actions={[{ href: "/", label: "Go to home" }]}>
              Products appear here as soon as the store adds them.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
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
