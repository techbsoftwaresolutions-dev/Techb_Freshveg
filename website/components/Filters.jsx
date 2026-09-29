"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Filters live in the URL, not in component state. That means a filtered view
// is shareable, back/forward works, and the results are still server-rendered —
// which is the whole reason the site exists separately from the app.
//
// Nothing here names a filter: the facets come from the API, built from the
// products actually on this shelf, so binding a new attribute in the admin
// adds a section on the next load — and an option nothing here has is never
// offered.

const VISIBLE_OPTIONS = 5;

function useFilterUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const selected = (key) => (params.get(key) || "").split(",").filter(Boolean);

  const apply = (next) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || (Array.isArray(value) && value.length === 0)) query.delete(key);
      else query.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    // Any filter change resets paging — page 3 of the old result set is
    // meaningless against the new one.
    query.delete("page");
    const qs = query.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const toggle = (key, value) => {
    const current = selected(key);
    apply({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  };

  // Everything filter-shaped goes; the sort stays, since it is not a filter.
  const clearAll = () => {
    const sort = params.get("sort");
    startTransition(() => router.push(sort ? `${pathname}?sort=${sort}` : pathname, { scroll: false }));
  };

  const isFilterKey = (key) =>
    key.startsWith("attr.") || key === "brand" || key === "maxPrice" || key === "inStock";

  const activeCount = [...params.entries()]
    .filter(([key]) => isFilterKey(key))
    .reduce((sum, [, value]) => sum + value.split(",").filter(Boolean).length, 0);

  return { params, selected, apply, toggle, clearAll, activeCount, pending };
}

export default function Filters({ filters = [], brands = [], priceBands = [], availability }) {
  const { params, selected, apply, toggle, clearAll, activeCount, pending } = useFilterUrl();
  const [open, setOpen] = useState(false);

  // The phone's filter sheet covers the page; the page behind it must not
  // scroll under the shopper's thumb.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showStock = availability && availability.inStock > 0 && availability.inStock < availability.total;
  const hasAny = showStock || priceBands.length || brands.length || filters.length;
  if (!hasAny) return <aside className="filters-empty" />;

  return (
    <aside className="filters">
      <button type="button" className="filters-trigger" onClick={() => setOpen(true)} aria-expanded={open}>
        <IconSliders />
        Filters
        {activeCount ? <span className="filters-trigger-count">{activeCount}</span> : null}
      </button>

      {open ? <div className="filters-backdrop" onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <div className={`filters-panel${open ? " open" : ""}`} aria-busy={pending || undefined}>
        <div className="filters-head">
          <h3>Filters</h3>
          {activeCount ? (
            <button type="button" className="filters-clear" onClick={clearAll}>
              Clear all
            </button>
          ) : null}
          <button type="button" className="filters-close" onClick={() => setOpen(false)} aria-label="Close filters">
            <IconClose />
          </button>
        </div>

        <div className="filters-body">
          {showStock ? (
            <FilterSection title="Availability">
              <Option
                type="checkbox"
                label="In stock only"
                count={availability.inStock}
                checked={params.get("inStock") === "true"}
                onChange={() => apply({ inStock: params.get("inStock") === "true" ? "" : "true" })}
              />
            </FilterSection>
          ) : null}

          {priceBands.length ? (
            <FilterSection title="Price">
              {priceBands.map((band) => {
                const on = params.get("maxPrice") === String(band.max);
                return (
                  <Option
                    key={band.max}
                    type="radio"
                    name="price"
                    label={band.label}
                    count={band.count}
                    checked={on}
                    // A radio that can also be un-ticked: clicking the chosen
                    // band again clears the price filter.
                    onChange={() => apply({ maxPrice: on ? "" : String(band.max) })}
                    onClick={() => on && apply({ maxPrice: "" })}
                  />
                );
              })}
            </FilterSection>
          ) : null}

          {brands.length ? (
            <FilterSection title="Brand">
              <OptionList
                options={brands.map((brand) => ({ value: brand.id, label: brand.name, count: brand.count }))}
                selected={selected("brand")}
                onToggle={(value) => toggle("brand", value)}
              />
            </FilterSection>
          ) : null}

          {filters.map((filter) => (
            <FilterSection key={filter.code} title={filter.label}>
              <OptionList
                options={filter.options}
                selected={selected(`attr.${filter.code}`)}
                onToggle={(value) => toggle(`attr.${filter.code}`, value)}
              />
            </FilterSection>
          ))}
        </div>

        {/* Phone only: filters apply as they are ticked, so this just closes
            the sheet onto the results already behind it. */}
        <div className="filters-foot">
          <button type="button" className="btn primary lg block" onClick={() => setOpen(false)}>
            {pending ? "Updating…" : "Show results"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function FilterSection({ title, children }) {
  return (
    <details className="filter-section" open>
      <summary>
        {title}
        <IconChevron />
      </summary>
      <div className="filter-options">{children}</div>
    </details>
  );
}

function OptionList({ options, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  // A ticked option is never hidden behind "Show more".
  const hiddenSelected = options.slice(VISIBLE_OPTIONS).some((option) => selected.includes(option.value));
  const visible = expanded || hiddenSelected ? options : options.slice(0, VISIBLE_OPTIONS);
  const extra = options.length - VISIBLE_OPTIONS;

  return (
    <>
      {visible.map((option) => (
        <Option
          key={option.value}
          type="checkbox"
          label={option.label}
          swatch={option.hex}
          count={option.count}
          checked={selected.includes(option.value)}
          onChange={() => onToggle(option.value)}
        />
      ))}
      {extra > 0 && !hiddenSelected ? (
        <button type="button" className="filter-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show ${extra} more`}
        </button>
      ) : null}
    </>
  );
}

function Option({ type, name, label, count, swatch, checked, onChange, onClick }) {
  return (
    <label className={`filter-option${checked ? " on" : ""}`}>
      <input type={type} name={name} checked={checked} onChange={onChange} onClick={onClick} />
      <span className={`filter-box ${type}`} aria-hidden="true" />
      {swatch ? <span className="swatch" style={{ background: swatch }} aria-hidden="true" /> : null}
      <span className="filter-label">{label}</span>
      {count != null ? <span className="filter-count">{count}</span> : null}
    </label>
  );
}

// The choices in force, as chips above the results — each one removable on its
// own, so a shopper can undo one filter without hunting for it in the sidebar.
export function ActiveFilters({ filters = [], brands = [], priceBands = [] }) {
  const { params, selected, toggle, apply, clearAll, activeCount } = useFilterUrl();
  if (!activeCount) return null;

  const chips = [];
  if (params.get("inStock") === "true") {
    chips.push({ key: "inStock", label: "In stock only", remove: () => apply({ inStock: "" }) });
  }
  const maxPrice = params.get("maxPrice");
  if (maxPrice) {
    const band = priceBands.find((b) => String(b.max) === maxPrice);
    chips.push({
      key: "maxPrice",
      label: band?.label || `Under ₹${Math.round(Number(maxPrice) / 100)}`,
      remove: () => apply({ maxPrice: "" }),
    });
  }
  for (const id of selected("brand")) {
    const brand = brands.find((b) => b.id === id);
    chips.push({ key: `brand:${id}`, label: brand?.name || "Brand", remove: () => toggle("brand", id) });
  }
  for (const filter of filters) {
    for (const value of selected(`attr.${filter.code}`)) {
      const option = filter.options.find((o) => o.value === value);
      chips.push({
        key: `${filter.code}:${value}`,
        label: filter.inputType === "boolean" ? filter.label : option?.label || value,
        remove: () => toggle(`attr.${filter.code}`, value),
      });
    }
  }

  return (
    <div className="active-filters">
      {chips.map((chip) => (
        <button key={chip.key} type="button" className="active-chip" onClick={chip.remove} aria-label={`Remove ${chip.label}`}>
          {chip.label}
          <IconClose />
        </button>
      ))}
      <button type="button" className="active-clear" onClick={clearAll}>
        Clear all
      </button>
    </div>
  );
}

const SORT_OPTIONS = [
  { key: "", label: "Relevance" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
  { key: "discount", label: "Biggest Discount" },
  { key: "newest", label: "Newest First" },
];

// A custom menu rather than a <select>: the browser draws a native select's
// open list itself — square, system font, OS highlight colour — and no CSS
// reaches it. This one follows the listbox pattern: arrow keys move, Enter
// picks, Escape or a click elsewhere closes.
export function SortBar({ total }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("sort") || "";
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const currentIndex = Math.max(0, SORT_OPTIONS.findIndex((o) => o.key === current));

  useEffect(() => {
    if (!open) return undefined;
    setFocus(currentIndex);
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    listRef.current?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, currentIndex]);

  const choose = (value) => {
    setOpen(false);
    if (value === current) return;
    const query = new URLSearchParams(params.toString());
    if (value) query.set("sort", value);
    else query.delete("sort");
    query.delete("page");
    const qs = query.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onListKey = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocus((i) => (i + 1) % SORT_OPTIONS.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocus((i) => (i - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(SORT_OPTIONS[focus].key);
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="sort-bar">
      {/* The count is optional: a page that already states it in its own
          heading passes nothing rather than printing the number twice. */}
      {total == null ? null : (
        <span className="sort-count">
          {total} product{total === 1 ? "" : "s"}
        </span>
      )}
      <div className="sort-menu" ref={rootRef}>
        <button
          type="button"
          className={`sort-select${open ? " open" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <IconSort />
          <span className="sort-label">Sort by</span>
          <strong>{SORT_OPTIONS[currentIndex].label}</strong>
          <IconChevron />
        </button>

        {open ? (
          <ul
            className="sort-list"
            role="listbox"
            tabIndex={-1}
            ref={listRef}
            aria-label="Sort products"
            aria-activedescendant={`sort-opt-${focus}`}
            onKeyDown={onListKey}
          >
            {SORT_OPTIONS.map((option, index) => {
              const selected = option.key === current;
              return (
                <li
                  key={option.key || "relevance"}
                  id={`sort-opt-${index}`}
                  role="option"
                  aria-selected={selected}
                  className={`sort-option${selected ? " selected" : ""}${index === focus ? " focused" : ""}`}
                  onMouseEnter={() => setFocus(index)}
                  onClick={() => choose(option.key)}
                >
                  {option.label}
                  {selected ? <IconTick /> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function IconChevron() {
  return (
    <svg {...iconProps} width="16" height="16" className="icon-chevron">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function IconTick() {
  return (
    <svg {...iconProps} width="16" height="16" strokeWidth="2.4">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
function IconSort() {
  return (
    <svg {...iconProps} width="16" height="16" strokeWidth="1.8">
      <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg {...iconProps} width="14" height="14">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function IconSliders() {
  return (
    <svg {...iconProps} width="18" height="18" strokeWidth="1.8">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
