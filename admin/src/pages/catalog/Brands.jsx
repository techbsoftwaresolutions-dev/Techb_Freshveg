import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, confirmDialog } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import FormRoute from "../../components/FormRoute";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table } from "../../components/ui";
import { Select } from "../../components/SelectMenu";

export default function Brands() {
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
    const ok = await confirmDialog({
      title: "Delete brand?",
      message: `Are you sure you want to delete "${brand.name}"? This action cannot be undone.`,
      confirmText: "Delete brand",
      danger: true,
    });
    if (!ok) return;
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
    <div className="page">
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

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search brands…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 220 }}
        />
        <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
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
              title="Brands"
              columns={[
                { key: "name", label: "Brand", render: (row) => <span className="row-title">{row.name}</span> },
                { key: "slug", label: "Slug", render: (row) => <span className="tag">{row.slug}</span> },
                { key: "productCount", label: "Products", align: "right" },
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
                        className="btn sm danger"
                        disabled={removingId === row.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBrand(row);
                        }}
                      >
                        {removingId === row.id ? "Removing…" : "Delete"}
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
      <Field label="Name">
        <input
          type="text"
          autoFocus
          value={form.name || ""}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Description">
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
    </Modal>
  );
}
