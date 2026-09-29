import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Loading, Pagination, Pill, Switch, Table, rupees } from "../../components/ui";

export default function Products() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState({ items: [], meta: null });
  const [categories, setCategories] = useState([]);
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
  const canManage = can("catalog.manage");

  useEffect(() => {
    api
      .get("/catalog/categories/tree", { status: "active" })
      .then(({ tree }) => setCategories(flatten(tree)))
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
  }, [filters]);

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
    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) return;
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

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search products…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select value={filters.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
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
            <Table
              columns={[
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
    </div>
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
