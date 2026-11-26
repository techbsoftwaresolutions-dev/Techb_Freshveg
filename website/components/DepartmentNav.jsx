import Link from "next/link";
import { categoryImage, img } from "@/lib/format";
import CategoryIcon from "./CategoryIcon";

// Desktop department list for a category page, drawn as the same kind of panel
// as the Filters below it. "All products" is a dropdown holding every
// department; each department is its own dropdown holding its aisles (Exotic
// Fruits, Seasonal Fruits…). Native <details>, so no client JS. The department
// you're in starts open. Phones use the icon rail instead.
export default function DepartmentNav({ departments = [], activeSlug = null, total = null }) {
  const onAll = activeSlug === null;
  return (
    <nav className="dept-nav dept-panel" aria-label="Categories">
      <div className="filters-head">
        <h3>Categories</h3>
      </div>

      <details className="filter-section dept-root" open>
        <summary>
          <span className="dept-name">
            All products
            {total ? <span className="dept-count">{total}</span> : null}
          </span>
          <IconChevron />
        </summary>

        <div className="dept-tree">
          <Link
            href="/c"
            className={`dept-link${onAll ? " current" : ""}`}
            aria-current={onAll ? "page" : undefined}
          >
            View all products
          </Link>

          {departments.map((department) => {
            const inside =
              department.slug === activeSlug || department.children?.some((child) => child.slug === activeSlug);
            const aisles = department.children || [];
            return (
              <details key={department.id} className="dept-section" open={inside || undefined}>
                <summary className={department.slug === activeSlug ? "current" : undefined}>
                  <span className="dept-name">
                    {categoryImage(department) ? (
                      <img src={img(categoryImage(department), 80)} alt="" className="dept-icon" />
                    ) : (
                      <CategoryIcon name={department.name} className="dept-icon" />
                    )}
                    {department.name}
                  </span>
                  <IconChevron />
                </summary>

                <div className="dept-aisles">
                  {/* Not the department's own landing page: the All products
                      list, narrowed to just this department's products. */}
                  <Link
                    href={`/c?category=${encodeURIComponent(department.slug)}`}
                    className={`dept-link${department.slug === activeSlug ? " current" : ""}`}
                    aria-current={department.slug === activeSlug ? "page" : undefined}
                  >
                    All {department.name}
                  </Link>
                  {aisles.map((aisle) => (
                    <Link
                      key={aisle.id}
                      href={`/c/${aisle.slug}`}
                      className={`dept-link${aisle.slug === activeSlug ? " current" : ""}`}
                      aria-current={aisle.slug === activeSlug ? "page" : undefined}
                    >
                      {aisle.name}
                      {aisle.productCount ? <span className="dept-count">{aisle.productCount}</span> : null}
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </details>
    </nav>
  );
}

function IconChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon-chevron"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
