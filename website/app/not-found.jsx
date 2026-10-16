import EmptyState from "@/components/EmptyState";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="wrap not-found-page">
      <EmptyState
        icon="map"
        title="We couldn't find that page"
        actions={[
          { href: "/", label: "Go to home" },
          { href: "/c", label: "Browse categories" },
        ]}
      >
        It may have moved, or the product is no longer stocked.
      </EmptyState>
    </div>
  );
}
