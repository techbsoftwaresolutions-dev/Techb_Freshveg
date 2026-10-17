import Link from "next/link";
import { img } from "@/lib/format";
import CategoryIcon from "./CategoryIcon";

// The vertical department list beside the homepage content — the same
// aisles-list building blocks already used on the /c category-browser page
// (aisles / aisles-item / aisles-head), reused here rather than invented
// fresh, so the two nav styles stay consistent across the site. Hidden on
// narrow screens (see globals.css), where the icon-tile "Top categories"
// row below the hero already covers the same ground.
export default function HomeSidebar({ departments = [], hasOffers = false }) {
  return (
    <aside className="home-sidebar">
      <nav className="aisles" aria-label="Shop by department">
        <span className="aisles-item current" aria-current="page">
          Home
        </span>
        <Link href="/c" className="aisles-item">
          All categories
        </Link>

        {departments.map((department) => (
          <Link key={department.id} href={`/c/${department.slug}`} className="aisles-item">
            <span style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              {department.image ? (
                <img src={img(department.image, 80)} alt="" className="aisles-head-icon aisles-head-photo" />
              ) : (
                <CategoryIcon name={department.name} className="aisles-head-icon" />
              )}
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {department.name}
              </span>
            </span>
            {department.productCount ? (
              <span className="aisles-count">{department.productCount}</span>
            ) : null}
          </Link>
        ))}

        {hasOffers ? (
          <a href="#offers" className="aisles-item aisles-offers">
            <span style={{ display: "flex", alignItems: "center" }}>
              <CategoryIcon name="offer" className="aisles-head-icon" />
              Special offers
            </span>
          </a>
        ) : null}
      </nav>
    </aside>
  );
}
