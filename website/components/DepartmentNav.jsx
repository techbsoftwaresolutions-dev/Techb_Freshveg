import Link from "next/link";
import { img } from "@/lib/format";
import CategoryIcon from "./CategoryIcon";

// Desktop department list for a category page: every department, with the one you're in
// opened to show its aisles. It fills the left column above the filters, so that column
// is never just one small price box over blank space. Phones use the icon rail instead.
export default function DepartmentNav({ departments = [], activeSlug = null }) {
  return (
    <nav className="aisles dept-nav" aria-label="Categories">
      <Link href="/c" className="aisles-item">All products</Link>

      {departments.map((department) => {
        const inside = department.slug === activeSlug || department.children?.some((child) => child.slug === activeSlug);
        return (
          <div key={department.id} className={`aisles-group${inside ? " open" : ""}`}>
            <Link href={`/c/${department.slug}`} className={`aisles-head${department.slug === activeSlug ? " current" : ""}`}>
              {department.image ? (
                <img src={img(department.image, 80)} alt="" className="aisles-head-icon aisles-head-photo" />
              ) : (
                <CategoryIcon name={department.name} className="aisles-head-icon" />
              )}
              {department.name}
            </Link>
            {inside
              ? department.children?.map((aisle) => (
                  <Link
                    key={aisle.id}
                    href={`/c/${aisle.slug}`}
                    className={`aisles-item${aisle.slug === activeSlug ? " current" : ""}`}
                    aria-current={aisle.slug === activeSlug ? "page" : undefined}
                  >
                    {aisle.name}
                    {aisle.productCount ? <span className="aisles-count">{aisle.productCount}</span> : null}
                  </Link>
                ))
              : null}
          </div>
        );
      })}
    </nav>
  );
}
