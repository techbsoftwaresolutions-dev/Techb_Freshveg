import Link from "next/link";
import { search } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import EmptyState from "@/components/EmptyState";

export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams;
  return {
    title: q ? `Search results for “${q}”` : "Search",
    // Search result pages are thin and infinite; keep them out of the index
    // while still letting a crawler follow the product links on them.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }) {
  const { q = "", page = 1 } = await searchParams;
  const term = String(q).trim();

  if (term.length < 2) {
    return (
      <div className="wrap">
        <EmptyState icon="search" title="What are you looking for?" actions={[{ href: "/c", label: "Browse categories" }]}>
          Type at least two letters in the search box — a product, a brand or an aisle.
        </EmptyState>
      </div>
    );
  }

  const data = await search(term, { page, limit: 20 });
  const products = data?.items || [];
  const suggestions = data?.suggestions || [];
  const total = data?.meta?.total ?? products.length;

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        {" › "}
        <span>Search</span>
      </nav>

      <header className="page-title">
        <h1>
          Results for <span className="page-title-accent">“{term}”</span>
        </h1>
        <p>
          {total} product{total === 1 ? "" : "s"} found
        </p>
      </header>

      {suggestions.length ? (
        <div className="suggest-row">
          <span>Matching aisles</span>
          {suggestions.map((category) => (
            <Link key={category.id} href={`/c/${category.slug}`} className="suggest-chip">
              {category.name}
            </Link>
          ))}
        </div>
      ) : null}

      {products.length ? (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title={`Nothing found for “${term}”`}
          actions={[
            { href: "/c", label: "Browse categories" },
            { href: "/", label: "Go to home" },
          ]}
        >
          Check the spelling, or try a shorter word — “tomato” instead of “tomatoes”.
        </EmptyState>
      )}
    </div>
  );
}
