import Select from "../../components/Select";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import FormRoute from "../../components/FormRoute";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, useConfirm } from "../../components/ui";

const TONES = ["green", "blue", "amber", "violet", "pink", "indigo"];
const toneFor = (name = "") => TONES[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TONES.length];
const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "hidden", label: "Hidden" },
  { value: "archived", label: "Archived" },
];

// Logo when the brand has one, otherwise a coloured initial.
function BrandMark({ name, logo, size = 40 }) {
  const style = { width: size, height: size, borderRadius: size * 0.3, fontSize: size * 0.42 };
  return logo ? (
    <span className="cat-avatar" style={{ ...style, backgroundImage: `url(${logo})` }} />
  ) : (
    <span className={`cat-avatar letter ${toneFor(name)}`} style={style}>
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

export default function Brands() {
  const [confirm, confirmDialog] = useConfirm();
  const { can } = useAuth();
  const editable = can("catalog.manage");
  const navigate = useNavigate();

  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: "", status: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/catalog/brands", { ...filters, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  // The search box fires on every keystroke, so it gets a short debounce; a
  // page or status change is a deliberate click and should feel instant.
  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  // No order ever points straight at a brand, so — unlike a product — it's
  // really removed rather than archived. The backend still refuses when a
  // live product is still filed under it, and that refusal's message is
  // what ends up in the banner below.
  async function removeBrand(brand) {
    if (!(await confirm({ title: "Delete brand?", message: `Delete "${brand.name}"? This can't be undone.`, confirmLabel: "Yes, delete" }))) return;
    setRemovingId(brand.id);
    setError("");
    try {
      await api.delete(`/catalog/brands/${brand.id}`);
      setData((d) => ({ ...d, items: d.items.filter((b) => b.id !== brand.id) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="page products-page brands-page">
      {confirmDialog}
      <div className="page-head">
        <div>
          <h1>Brands</h1>
        </div>
        {editable && (
          <button className="btn primary" onClick={() => navigate("/catalog/brands/new")}>
            + New brand
          </button>
        )}
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="toolbar products-filters">
        <span className="search-field">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search"
            placeholder="Search brands…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </span>
        <div className="chip-row brand-tabs" role="tablist" aria-label="Status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              role="tab"
              aria-selected={filters.status === tab.value}
              className={`cat-chip${filters.status === tab.value ? " on" : ""}`}
              onClick={() => set("status", tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Brands"
              columns={[
                {
                  key: "name",
                  label: "Brand",
                  render: (row) => (
                    <span className="brand-cell">
                      <BrandMark name={row.name} logo={row.logo} />
                      <span className="row-title">{row.name}</span>
                    </span>
                  ),
                },
                { key: "slug", label: "Slug", render: (row) => <span className="tag">{row.slug}</span> },
                {
                  key: "productCount",
                  label: "Products",
                  align: "right",
                  render: (row) => <span className="count">{row.productCount || 0}</span>,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Pill tone={row.status === "active" ? "ok" : undefined}>{row.status}</Pill>,
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  sortable: false,
                  exportable: false,
                  render: (row) =>
                    editable && (
                      <button
                        type="button"
                        className="icon-delete"
                        disabled={removingId === row.id}
                        title={`Delete ${row.name}`}
                        aria-label={`Delete ${row.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBrand(row);
                        }}
                      >
                        {removingId === row.id ? (
                          "…"
                        ) : (
                          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                          </svg>
                        )}
                      </button>
                    ),
                },
              ]}
              rows={data.items}
              onRowClick={editable ? (row) => navigate(`/catalog/brands/${row.id}`) : undefined}
              empty={<Empty title="No brands" hint="Add one to enable brand filters." />}
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>
    </div>
  );
}

// /catalog/brands/new and /catalog/brands/:id — the brand form as a page.
export function BrandFormPage() {
  return (
    <FormRoute
      backTo="/catalog/brands"
      backLabel="Brands"
      load={async (id) => {
        if (!id) return { name: "", status: "active" };
        const { items } = await api.get("/catalog/brands", { limit: 100 });
        return items.find((b) => b.id === id) || null;
      }}
      render={(brand, back, { save, saving }) => (
        <BrandForm
          value={brand}
          saving={saving}
          onClose={back}
          onSave={(draft) =>
            save(() => (draft.id ? api.patch(`/catalog/brands/${draft.id}`, draft) : api.post("/catalog/brands", draft)))
          }
        />
      )}
    />
  );
}

function BrandForm({ value, saving, onClose, onSave }) {
  const [form, setForm] = useState(value);

  return (
    <Modal
      title={form.id ? value.name : "New brand"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={saving || !form.name?.trim()} onClick={() => onSave(form)}>
            {saving ? "Saving…" : "Save brand"}
          </button>
        </>
      }
    >
      <div className="newcat-layout">
        <div className="newcat-fields">
          <Field label="Name" help="The brand name shoppers see, e.g. Aashirvaad.">
            <input
              type="text"
              autoFocus
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Aashirvaad"
            />
          </Field>
          <Field label="Description" help="Optional: a line about the brand.">
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid cols-2">
            <Field label="Status">
              <Select value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={form.seq ?? 0}
                onChange={(e) => setForm({ ...form, seq: Number(e.target.value) })}
              />
            </Field>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(form.isFeatured)}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
            />
            Featured brand
          </label>
        </div>

        <aside className="newcat-preview" aria-label="Preview">
          <span className="newcat-preview-label">Preview</span>
          <div className="newcat-tile">
            {form.logo ? (
              <span className="newcat-badge has-image" style={{ backgroundImage: `url(${form.logo})` }} />
            ) : (
              <span className={`newcat-badge ${toneFor(form.name)}`}>
                {(form.name || "").trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
            <strong>{(form.name || "").trim() || "Brand name"}</strong>
            <span className="newcat-where">
              {form.isFeatured ? "Featured · " : ""}
              {(form.status || "active").replace(/^./, (c) => c.toUpperCase())}
            </span>
          </div>
          <p>Brands appear as filters on the store once products are filed under them.</p>
        </aside>
      </div>
    </Modal>
  );
}
