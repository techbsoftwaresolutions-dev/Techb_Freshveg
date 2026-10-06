import Link from "next/link";
import { Suspense } from "react";
import { img } from "@/lib/format";
import CategoryIcon from "./CategoryIcon";
import Filters, { OffersChip, SortBar } from "./Filters";

// The phone's browsing shell, shared by "All products" and every category
// page: a compact header, a vertical category rail, the Filter / Sort / Offers
// chips and the free-delivery bar. All of it is hidden above 720px, where the
// desktop sidebar and header keep doing their job (see globals.css).

export function MobileHead({ title, backHref = "/" }) {
  return (
    <div className="cat-mobile-head">
      <Link href={backHref} aria-label="Back" className="cat-mobile-btn">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </Link>
      <span className="cat-mobile-title">{title}</span>
      <Link href="/search" aria-label="Search" className="cat-mobile-btn">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4-4" />
        </svg>
      </Link>
    </div>
  );
}

// Every department, with the open one's aisles listed straight under it.
// `activeSlug` null means "All products".
export function MobileRail({ departments = [], activeSlug = null }) {
  const items = [{ id: "all", name: "All", slug: null, href: "/c" }];
  for (const department of departments) {
    items.push({ ...department, href: `/c/${department.slug}` });
    const inside =
      department.slug === activeSlug || department.children?.some((child) => child.slug === activeSlug);
    if (inside) {
      for (const child of department.children || []) items.push({ ...child, href: `/c/${child.slug}` });
    }
  }

  return (
    <nav className="cat-rail" aria-label="Categories">
      {items.map((item) => {
        const active = item.slug === activeSlug;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`cat-rail-item${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="cat-rail-icon">
              {item.image ? <img src={img(item.image, 120)} alt="" /> : <CategoryIcon name={item.name} />}
            </span>
            <span className="cat-rail-name">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// `facets` are the category's real filter options; "All products" has none, so
// the Filter chip simply isn't offered there.
export function MobileChips({ facets }) {
  return (
    <div className="cat-chips">
      <Suspense fallback={null}>
        {facets ? <Filters {...facets} /> : null}
        <SortBar />
        <OffersChip />
      </Suspense>
    </div>
  );
}

export function DeliveryBar() {
  return (
    <div className="cat-delivery" role="note">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
        <circle cx="7" cy="17" r="1.8" />
        <circle cx="17" cy="17" r="1.8" />
      </svg>
      <span>
        <strong>FREE DELIVERY</strong> on orders above ₹399
      </span>
    </div>
  );
}
