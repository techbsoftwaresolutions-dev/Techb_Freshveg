import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table } from "../../components/ui";

// Attributes are the reusable field definitions categories bind. Creating one
// here and binding it to a category is the whole "new kind of product without
// a release" workflow.

const INPUT_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "measure", label: "Number with a unit" },
  { value: "select", label: "Dropdown (one)" },
  { value: "multiselect", label: "Dropdown (many)" },
  { value: "boolean", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "color", label: "Colour" },
];

const blank = {
  code: "",
  name: "",
  inputType: "text",
  group: "General",
  options: [],
  unit: "",
  isVariantAxis: false,
  isFilterable: false,
  filterUi: "checkbox",
  showInSpecs: true,
  showOnCard: false,
  helpText: "",
  placeholder: "",
};

export default function Attributes() {
  const { can } = useAuth();
  const editable = can("catalog.manage");

  const [data, setData] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const load = () =>
    api
      .get("/catalog/attributes", { limit: 20, search, page })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  // A fresh search starts back at page 1 — staying on page 3 of a changed
  // result set is how you end up looking at an empty table.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (loading) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Attributes</h1>
        </div>
        {editable && (
          <button className="btn primary" onClick={() => navigate("/catalog/attributes/new")}>
            + New attribute
          </button>
        )}
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search attributes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />
      </div>

      <Card tight>
        <Table
          title="Attributes"
          columns={[
            {
              key: "name",
              label: "Attribute",
              render: (row) => (
                <div className="stack">
                  <span className="row-title">{row.name}</span>
                  <span className="tag">{row.code}</span>
                </div>
              ),
            },
            { key: "inputType", label: "Type", render: (row) => <span className="muted">{row.inputType}</span> },
            { key: "group", label: "Group", render: (row) => <span className="muted">{row.group}</span> },
            {
              key: "options",
              label: "Options",
              render: (row) =>
                row.options?.length ? (
                  <span className="faint" style={{ fontSize: 12 }}>
                    {row.options.slice(0, 3).map((o) => o.label).join(", ")}
                    {row.options.length > 3 ? ` +${row.options.length - 3}` : ""}
                  </span>
                ) : (
                  <span className="faint">—</span>
                ),
            },
            {
              key: "flags",
              label: "Flags",
              render: (row) => (
                <div className="inline" style={{ gap: 4 }}>
                  {row.isVariantAxis && <Pill tone="accent">variant axis</Pill>}
                  {row.isFilterable && <Pill tone="info">filter</Pill>}
                  {row.isSystem && <Pill>system</Pill>}
                </div>
              ),
            },
          ]}
          rows={data.items}
          onRowClick={editable ? (row) => navigate(`/catalog/attributes/${row.id}`) : undefined}
          empty={<Empty title="No attributes" hint="Create one to start describing products." />}
        />
        <Pagination meta={data.meta} onPage={setPage} />
      </Card>
    </div>
  );
}

// /catalog/attributes/new and /catalog/attributes/:id — the attribute form as a page.
export function AttributeFormPage() {
  return (
    <FormRoute
      backTo="/catalog/attributes"
      backLabel="Attributes"
      load={async (id) => {
        if (!id) return { ...blank };
        const { items } = await api.get("/catalog/attributes", { limit: 100 });
        const attribute = items.find((a) => a.id === id);
        return attribute ? { ...blank, ...attribute } : null;
      }}
      render={(attribute, back, { save, saving }) => (
        <AttributeModal
          value={attribute}
          saving={saving}
          onClose={back}
          onSave={(draft) =>
            save(() =>
              draft.id ? api.patch(`/catalog/attributes/${draft.id}`, draft) : api.post("/catalog/attributes", draft)
            )
          }
        />
      )}
    />
  );
}

function AttributeModal({ value, saving, onClose, onSave }) {
  const [form, setForm] = useState(value);
  const isNew = !form.id;
  const needsOptions = ["select", "multiselect"].includes(form.inputType);

  const set = (key) => (e) => {
    const next = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: next }));
  };

  // The code is the key product documents store values under, so it is only
  // editable while the attribute is new.
  const setName = (e) => {
    const name = e.target.value;
    setForm((f) => ({
      ...f,
      name,
      code: isNew ? name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : f.code,
    }));
  };

  const setOption = (index, key, raw) =>
    setForm((f) => {
      const options = [...f.options];
      options[index] = { ...options[index], [key]: raw };
      if (key === "label" && !options[index].valueTouched) {
        options[index].value = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      }
      return { ...f, options };
    });

  return (
    <Modal
      title={isNew ? "New attribute" : form.name}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={saving || !form.name.trim() || (needsOptions && !form.options.length)}
            onClick={() => onSave(form)}
          >
            {saving ? "Saving…" : isNew ? "Create" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid cols-2">
        <Field label="Name">
          <input type="text" autoFocus value={form.name} onChange={setName} placeholder="e.g. Grain Length" />
        </Field>
        <Field
          label="Code"
        >
          <input type="text" value={form.code} onChange={set("code")} disabled={!isNew} className="mono" />
        </Field>
      </div>

      <div className="grid cols-3">
        <Field label="Input type">
          <select value={form.inputType} onChange={set("inputType")}>
            {INPUT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Group" >
          <input type="text" value={form.group} onChange={set("group")} />
        </Field>
        <Field label="Unit" >
          <input type="text" value={form.unit} onChange={set("unit")} />
        </Field>
      </div>

      {needsOptions && (
        <>
          <div className="section-label">Options</div>
          {form.options.map((option, index) => (
            <div key={index} className="inline" style={{ marginBottom: 8, flexWrap: "nowrap" }}>
              <input
                type="text"
                placeholder="Label"
                value={option.label || ""}
                onChange={(e) => setOption(index, "label", e.target.value)}
              />
              <input
                type="text"
                placeholder="value"
                className="mono"
                value={option.value || ""}
                onChange={(e) => setOption(index, "value", e.target.value)}
              />
              <button
                className="btn ghost sm danger"
                onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== index) }))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn sm"
            onClick={() => setForm((f) => ({ ...f, options: [...f.options, { label: "", value: "" }] }))}
          >
            + Add option
          </button>
          <div className="divider" />
        </>
      )}

      <div className="section-label">Behaviour</div>
      <div className="inline">
        <label className="checkbox">
          <input type="checkbox" checked={form.isVariantAxis} onChange={set("isVariantAxis")} />
          Splits products into variants
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.isFilterable} onChange={set("isFilterable")} />
          Shown as a storefront filter
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.showInSpecs} onChange={set("showInSpecs")} />
          Shown in the spec table
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.showOnCard} onChange={set("showOnCard")} />
          Shown on the product card
        </label>
      </div>

      <Field label="Help text" >
        <input type="text" value={form.helpText} onChange={set("helpText")} />
      </Field>
    </Modal>
  );
}
