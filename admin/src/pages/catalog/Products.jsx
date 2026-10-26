import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, confirmDialog } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Loading, Pagination, Pill, Switch, Table, Tabs, rupees } from "../../components/ui";
import ReorderPanel from "../../components/ReorderPanel";

const PAGE_SIZE = 20;

export default function Products() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState({ items: [], meta: null });
  const [roots, setRoots] = useState([]);
  // Tab = a main (top-level) category; the dropdown then narrows to one of its
  // sub-categories. The API gets whichever is most specific as `category`.
  const [tab, setTab] = useState("");
  // A search typed into the admin's topbar lands here as ?search=, so that
  // box is a real shortcut into this page rather than a decoration.
  // `section` is the Best Seller / Trending / On Discount tab ("" = all).
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    section: "",
    category: "",
    status: "",
    page: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Rows whose Sections or S.No is being saved — one request per row at a
  // time, so quick clicks can't race each other.
  const [savingIds, setSavingIds] = useState(() => new Set());
  // The order open in Reorder Products ({ key, label }), or null.
  const [reordering, setReordering] = useState(null);
  const canManage = can("catalog.manage");

  useEffect(() => {
    api
      .get("/catalog/categories/tree", { status: "active" })
      .then(({ tree }) => setRoots(tree))
      .catch(() => {});
  }, []);

  // Only the newest request may fill the table, so a slow refresh can't land
  // on top of a tab or filter picked after it.
  const latest = useRef(0);
  const load = useCallback(() => {
    const id = ++latest.current;
    return api.get("/catalog/products", { ...filters, limit: PAGE_SIZE }).then((next) => {
      if (id === latest.current) setData(next);
    });
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(
      () =>
        load()
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false)),
      filters.search ? 250 : 0
    );
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  // A section or position change reshuffles other rows (and the tab counts),
  // so the page is re-read quietly behind it — no spinner, nothing unmounts.
  async function saveRow(product, request) {
    setSavingIds((ids) => new Set(ids).add(product.id));
    try {
      await request();
      await load();
    } catch {
      // The API client has already shown the error as a toast.
    } finally {
      setSavingIds((ids) => {
        const next = new Set(ids);
        next.delete(product.id);
        return next;
      });
    }
  }

  const toggleSection = (product, section, enabled) =>
    saveRow(product, async () => {
      const { product: fresh } = await api.patch(`/catalog/products/${product.id}/sections`, { section, enabled });
      setData((d) => ({
        ...d,
        items: d.items.map((p) => (p.id === product.id ? { ...p, sections: fresh.sections, positions: fresh.positions } : p)),
      }));
    });

  const movePosition = (product, position) =>
    saveRow(product, () => api.patch(`/catalog/products/${product.id}/position`, { key: data.order.key, position }));

  const pickTab = (id) => {
    setTab(id);
    setFilters((f) => ({ ...f, category: id, page: 1 }));
  };
  const subcategories = flatten(tab ? roots.find((r) => r.id === tab)?.children || [] : roots);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  // The row's switches. The change shows at once and is undone if the save
  // fails; the server's reply then sets the row's real stock state, since
  // "in stock" also depends on the counts underneath.
  async function quickUpdate(product, change) {
    setBusyId(product.id);
    setError("");
    const patchRow = (fields) =>
      setData((d) => ({ ...d, items: d.items.map((p) => (p.id === product.id ? { ...p, ...fields } : p)) }));
    patchRow(change);
    try {
      const { product: fresh } = await api.patch(`/catalog/products/${product.id}/quick`, change);
      patchRow({ status: fresh.status, soldOut: fresh.soldOut, inStock: fresh.inStock });
    } catch (err) {
      patchRow({ status: product.status, soldOut: product.soldOut, inStock: product.inStock });
      setError(`${product.name}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  // The backend archives rather than hard-deletes (order history still points
  // at these documents), so drop it from the visible list here rather than
  // trusting a refetch to hide it again.
  async function removeProduct(product) {
    const ok = await confirmDialog({
      title: "Delete product?",
      message: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      confirmText: "Delete product",
      danger: true,
    });
    if (!ok) return;
    setRemovingId(product.id);
    setError("");
    try {
      await api.delete(`/catalog/products/${product.id}`);
      setData((d) => ({ ...d, items: d.items.filter((p) => p.id !== product.id) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Products</h1>
        </div>
        {can("catalog.manage") && (
          <button className="btn primary" onClick={() => navigate("/catalog/products/new")}>
            + New product
          </button>
        )}
      </div>

      <Banner tone="error">{error}</Banner>

      <Tabs
        active={filters.section}
        onChange={(section) => set("section", section)}
        tabs={[
          { key: "", label: "All Products", count: data.counts?.all },
          ...(data.sections || []).map((s) => ({ key: s.key, label: s.label, count: data.counts?.[s.key] })),
        ]}
      />

      <div className="toolbar">
        <button className={`btn sm${tab === "" ? " primary" : ""}`} onClick={() => pickTab("")}>
          All
        </button>
        {roots.map((root) => (
          <button
            key={root.id}
            className={`btn sm${tab === root.id ? " primary" : ""}`}
            onClick={() => pickTab(root.id)}
          >
            {root.name}
          </button>
        ))}
        <span className="spacer" />
        <input
          type="search"
          placeholder="Search products…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select value={filters.category} onChange={(e) => set("category", e.target.value)}>
          <option value={tab}>{tab ? "All sub-categories" : "All categories"}</option>
          {subcategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="hidden">Hidden</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            {/* Says whose order S.No is, so a number is never read as the
                product's place everywhere. */}
            <div className="order-note">
              {data.order ? (
                <>
                  <span>
                    S.No is the position in <strong>{data.order.label}</strong>
                    {data.order.key.startsWith("category:") ? " (this category's own order)" : ""}
                    {canManage ? " — type a number to move a product, or arrange the whole section." : "."}
                  </span>
                  {canManage ? (
                    <button className="btn sm" onClick={() => setReordering(data.order)}>
                      Reorder Products
                    </button>
                  ) : null}
                </>
              ) : (
                "S.No is this list's row number. Open a section tab, or pick a category, to see and change saved positions."
              )}
            </div>
            <Table
              title="Products"
              columns={[
                {
                  key: "sno",
                  label: "S.No",
                  align: "right",
                  sortable: false,
                  width: 72,
                  render: (row) => {
                    if (!data.order) {
                      const meta = data.meta || { page: 1, limit: PAGE_SIZE };
                      return (meta.page - 1) * meta.limit + data.items.indexOf(row) + 1;
                    }
                    const position = row.positions?.[data.order.key];
                    return canManage ? (
                      <PositionInput
                        value={position}
                        disabled={savingIds.has(row.id)}
                        onSave={(next) => movePosition(row, next)}
                      />
                    ) : (
                      position ?? "—"
                    );
                  },
                },
                {
                  key: "name",
                  label: "Product",
                  render: (row) => {
                    const media = row.media?.[0];
                    return (
                      <div className="row-with-media">
                        {media ? (
                          <img
                            className="row-media"
                            src={media.url}
                            alt=""
                            style={{ objectPosition: `${media.focalX ?? 50}% ${media.focalY ?? 50}%` }}
                          />
                        ) : (
                          <span className="row-media row-media-empty" aria-hidden="true">
                            <IconImagePlaceholder />
                          </span>
                        )}
                        <div className="stack">
                          <span className="row-title">{row.name}</span>
                          <span className="row-sub">
                            {row.category?.name}
                            {row.brand?.name ? ` · ${row.brand.name}` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "sections",
                  label: "Sections",
                  sortable: false,
                  render: (row) => (
                    <SectionsPicker
                      product={row}
                      sections={data.sections || []}
                      saving={savingIds.has(row.id)}
                      editable={canManage && row.status !== "archived"}
                      onToggle={(section, enabled) => toggleSection(row, section, enabled)}
                    />
                  ),
                },
                {
                  key: "price",
                  label: "Price",
                  align: "right",
                  render: (row) =>
                    row.priceFrom === row.priceTo
                      ? rupees(row.priceFrom)
                      : `${rupees(row.priceFrom)} – ${rupees(row.priceTo)}`,
                },
                {
                  key: "variantCount",
                  label: "Variants",
                  align: "right",
                  render: (row) => row.variantCount || 0,
                },
                {
                  key: "inStock",
                  label: "Stock",
                  render: (row) =>
                    canManage && row.status !== "archived" ? (
                      <div>
                        <Switch
                          checked={!row.soldOut}
                          onChange={(onSale) => quickUpdate(row, { soldOut: !onSale })}
                          disabled={busyId === row.id}
                          onLabel="On sale"
                          offLabel="Sold out"
                          offTone="danger"
                          title={row.soldOut ? "Put back on sale" : "Mark as sold out — stock counts are kept"}
                        />
                        {/* On sale, but nothing on the shelf: a different
                            problem from "sold out", with a different fix. */}
                        {!row.soldOut && !row.inStock ? <span className="switch-note">No stock left</span> : null}
                      </div>
                    ) : row.inStock ? (
                      <Pill tone="ok">In stock</Pill>
                    ) : (
                      <Pill tone="danger">{row.soldOut ? "Sold out" : "Out"}</Pill>
                    ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) =>
                    canManage && row.status !== "archived" ? (
                      <Switch
                        checked={row.status === "active"}
                        onChange={(on) => quickUpdate(row, { status: on ? "active" : "hidden" })}
                        disabled={busyId === row.id}
                        tone="accent"
                        onLabel="Active"
                        offLabel={row.status === "draft" ? "Draft" : "Hidden"}
                        title={row.status === "active" ? "Hide from the store" : "Publish to the store"}
                      />
                    ) : (
                      <Pill tone={row.status === "active" ? "ok" : row.status === "draft" ? "warn" : undefined}>
                        {row.status}
                      </Pill>
                    ),
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  sortable: false,
                  exportable: false,
                  render: (row) =>
                    can("catalog.manage") && (
                      <button
                        className="btn sm danger"
                        disabled={removingId === row.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProduct(row);
                        }}
                      >
                        {removingId === row.id ? "Removing…" : "Delete"}
                      </button>
                    ),
                },
              ]}
              rows={data.items}
              onRowClick={(row) => navigate(`/catalog/products/${row.id}`)}
              empty={
                <Empty
                  title="No products"
                  hint="Create one, or clear the filters above."
                  action={
                    can("catalog.manage") && (
                      <Link className="btn primary" to="/catalog/products/new">
                        + New product
                      </Link>
                    )
                  }
                />
              }
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>

      {reordering ? (
        <ReorderPanel
          orderKey={reordering.key}
          title={reordering.label}
          onClose={() => setReordering(null)}
          onSaved={() => load().catch(() => {})}
        />
      ) : null}
    </div>
  );
}

// The product's place in the order being viewed. Saved on Enter or when the
// box loses focus, and only if the number actually changed; Esc puts it back.
function PositionInput({ value, disabled, onSave }) {
  const [draft, setDraft] = useState(value ?? "");
  // Re-synced when a save finishes too (`disabled` flips back): a number past
  // the end is clamped by the server, and may leave `value` unchanged.
  useEffect(() => setDraft(value ?? ""), [value, disabled]);

  const commit = () => {
    const next = Number(draft);
    if (Number.isInteger(next) && next >= 1 && next !== value) onSave(next);
    else setDraft(value ?? "");
  };

  return (
    <input
      className="position-input"
      type="number"
      min={1}
      step={1}
      value={draft}
      disabled={disabled}
      aria-label="Position"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          e.currentTarget.blur();
        }
      }}
    />
  );
}

// The row's Sections cell: its section tags, and — for someone who can
// manage the catalog — a checklist to add it to or take it off each one.
// The list is drawn in a portal at the button's screen position, so the
// table's scroll container can't clip it. Each tick saves on its own.
function SectionsPicker({ product, sections, saving, editable, onToggle }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const chosen = new Set(product.sections || []);
  const noDiscount = chosen.has("on_discount") && !(product.maxDiscountPct > 0);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const r = buttonRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 170;
    setPlace({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 208)),
      ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
    });

    const onDown = (event) => {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    // A fixed list would drift away from its row on scroll, so it closes.
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const tags = sections.filter((s) => chosen.has(s.key));
  const tagList = (
    <span className="section-tags">
      {tags.map((s) => (
        <span key={s.key} className={`section-tag ${s.key}`}>
          {s.label}
        </span>
      ))}
      {!tags.length ? <span className="faint">{editable ? "Add to section" : "—"}</span> : null}
      {noDiscount ? (
        <span className="section-tag warn" title="No pack is priced below its MRP, so the store won't show it under On Discount">
          No discount
        </span>
      ) : null}
    </span>
  );

  if (!editable) return tagList;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="sections-button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {tagList}
        <span className="sections-caret" aria-hidden="true">▾</span>
      </button>
      {open && place
        ? createPortal(
            // React bubbles portal events up to the row, which would open the
            // product — so they stop here.
            <div ref={menuRef} className="sections-menu" style={place} onClick={(e) => e.stopPropagation()}>
              {sections.map((s) => (
                <label key={s.key} className="sections-option">
                  <input
                    type="checkbox"
                    checked={chosen.has(s.key)}
                    disabled={saving}
                    onChange={(e) => onToggle(s.key, e.target.checked)}
                  />
                  <span className={`section-dot ${s.key}`} aria-hidden="true" />
                  {s.label}
                </label>
              ))}
              {saving ? <div className="sections-saving">Saving…</div> : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

// Plain gray placeholder for products that have no photo yet — a real gap
// in the data (the merchant hasn't uploaded one), not a bug, so this stays
// neutral rather than faking a product image.
function IconImagePlaceholder() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" />
      <path
        d="M4 17l5-5 3.5 3.5L16 12l4 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function flatten(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ id: node.id, name: `${"— ".repeat(depth)}${node.name}` });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}
