import Link from "next/link";
import { Suspense } from "react";
import { img } from "@/lib/format";
import CategoryIcon from "./CategoryIcon";
import Filters, { OffersChip, SortBar } from "./Filters";
import FreeDeliveryProgress from "./FreeDeliveryProgress";

// The phone's browsing shell, shared by "All products" and every category
// page: a compact header, a vertical category rail, the Filter / Sort / Offers
// chips and the free-delivery bar. All of it is hidden above 720px, where the
// desktop sidebar and header keep doing their job (see globals.css).

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

// The phone's floating free-delivery progress. Empty (and so hidden) when the
// admin has the rule switched off.
export function DeliveryBar() {
  return (
    <div className="cat-delivery">
      <FreeDeliveryProgress variant="floating" />
    </div>
  );
}
