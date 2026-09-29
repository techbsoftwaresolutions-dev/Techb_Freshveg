import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import FormRoute from "../../components/FormRoute";
import { Banner, Card, Empty, Field, Loading, Modal, Pill, Table } from "../../components/ui";

export default function Brands() {
  const { can } = useAuth();
  const editable = can("catalog.manage");
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/catalog/brands", { limit: 100 })
      .then(({ items: list }) => setItems(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><Loading /></div>;

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

      <Card tight>
        <Table
          columns={[
            { key: "name", label: "Brand", render: (row) => <span className="row-title">{row.name}</span> },
            { key: "slug", label: "Slug", render: (row) => <span className="tag">{row.slug}</span> },
            { key: "productCount", label: "Products", align: "right" },
            {
              key: "status",
              label: "Status",
              render: (row) => <Pill tone={row.status === "active" ? "ok" : undefined}>{row.status}</Pill>,
            },
          ]}
          rows={items}
          onRowClick={editable ? (row) => navigate(`/catalog/brands/${row.id}`) : undefined}
          empty={<Empty title="No brands" hint="Add one to enable brand filters." />}
        />
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
          <select value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="archived">Archived</option>
          </select>
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
