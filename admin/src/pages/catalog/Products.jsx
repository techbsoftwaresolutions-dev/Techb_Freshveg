import Select from "../../components/Select";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Loading, Pagination, Pill, Switch, Table, rupees, useConfirm } from "../../components/ui";

const OFFER_LABEL = { discount: "Discount", special: "Special offer", combo: "Combo offer" };

export default function Products() {
  const [confirm, confirmDialog] = useConfirm();
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
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    category: "",
    status: "",
    page: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const canManage = can("catalog.manage");

  useEffect(() => {
    api
      .get("/catalog/categories/tree", { status: "active" })
      .then(({ tree }) => setRoots(tree))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(
      () =>
        api
          .get("/catalog/products", { ...filters, limit: 20 })
          .then(setData)
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false)),
      filters.search ? 250 : 0
    );
    return () => clearTimeout(timer);
  }, [filters, reloadKey]);

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
      patchRow({ status: fresh.status, soldOut: fresh.soldOut, inStock: fresh.inStock, offer: fresh.offer });
    } catch (err) {
      patchRow({ status: product.status, soldOut: product.soldOut, inStock: product.inStock, offer: product.offer });
      setError(`${product.name}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  // Drag a row to a new place. The list moves at once; the server then stores
  // the new order, and the list is put back if that fails.
  async function reorder(from, to) {
    const before = data.items;
    const items = [...before];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    // The rows trade their position numbers along with their places.
    const slots = before.map((p) => p.position);
    setData((d) => ({ ...d, items: items.map((p, i) => ({ ...p, position: slots[i] })) }));
    setError("");
    try {
      await api.post("/catalog/products/reorder", { ids: items.map((p) => p.id) });
    } catch (err) {
      setData((d) => ({ ...d, items: before }));
      setError(`Could not save the new order: ${err.message}`);
    }
  }

  // Typed position: the server moves the product there and the list reloads.
  async function moveTo(product, position) {
    setError("");
    try {
      await api.post(`/catalog/products/${product.id}/move`, { position });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(`${product.name}: ${err.message}`);
    }
  }

  // The backend archives rather than hard-deletes (order history still points
  // at these documents), so drop it from the visible list here rather than
  // trusting a refetch to hide it again.
  async function removeProduct(product) {
    if (!(await confirm({ title: "Delete product?", message: `Delete "${product.name}"? This can't be undone.`, confirmLabel: "Yes, delete" }))) return;
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
      {confirmDialog}
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
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search products…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 220 }}
        />
        <Select value={filters.category} onChange={(e) => set("category", e.target.value)}>
          <option value={tab}>{tab ? "All sub-categories" : "All categories"}</option>
          {subcategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="hidden">Hidden</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Products"
              columns={[
                ...(canManage
                  ? [
                      {
                        key: "position",
                        label: "#",
                        sortable: false,
                        exportable: false,
                        width: 70,
                        render: (row) =>
                          row.position ? <PositionInput row={row} onMove={moveTo} /> : null,
                      },
                    ]
                  : []),
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
                  key: "offer",
                  label: "Offer",
                  sortable: false,
                  exportable: false,
                  width: 170,
                  render: (row) =>
                    canManage && row.status !== "archived" ? (
                      <div onClick={(e) => e.stopPropagation()} draggable={false}>
                        <Select
                          value={row.offer?.kind || ""}
                          disabled={busyId === row.id}
                          onChange={(e) => quickUpdate(row, { offer: { kind: e.target.value } })}
                          aria-label={`Offer for ${row.name}`}
                        >
                          <option value="">No offer</option>
                          <option value="discount">Discount</option>
                          <option value="special">Special offer</option>
                          <option value="combo">Combo offer</option>
                        </Select>
                      </div>
                    ) : (
                      OFFER_LABEL[row.offer?.kind] || "—"
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
              onReorder={canManage && data.items.length > 1 ? reorder : undefined}
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
    </div>
  );
}

// A small number box: type where the product should sit and press Enter (or
// click away). Out-of-range numbers are clamped by the server.
function PositionInput({ row, onMove }) {
  const [value, setValue] = useState(String(row.position));
  useEffect(() => setValue(String(row.position)), [row.position]);
  const commit = () => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) return setValue(String(row.position));
    if (n !== row.position) onMove(row, n);
  };
  return (
    <input
      className="position-input"
      type="number"
      min="1"
      value={value}
      draggable={false}
      title="Type a position and press Enter"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setValue(String(row.position));
      }}
    />
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
