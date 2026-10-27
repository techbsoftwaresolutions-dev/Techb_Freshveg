import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, confirmDialog } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pill, Switch, Table } from "../../components/ui";
import SelectMenu from "../../components/SelectMenu";
import { IconTrash } from "../../components/Icons";
import ReorderPanel from "../../components/ReorderPanel";

const TYPES = [
  { key: "category", label: "Category", hint: "Every product in a category, in that category's own order." },
  { key: "classification", label: "Classification", hint: "Products tagged Best Seller, Trending or On Discount, in that tag's order." },
  { key: "curated", label: "Curated", hint: "Products you pick, in the order you put them." },
];
const typeLabel = (type) => TYPES.find((t) => t.key === type)?.label || type;

// Landing Page → Sections: which blocks the customer landing page shows, in
// what order, and where (website, app, both, neither). The products inside a
// block come from the catalog — this page never changes a product or its
// place in a category or classification.
export default function LandingSections() {
  const { can } = useAuth();
  const canManage = can("marketing.manage");

  const [data, setData] = useState({ items: [], classifications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Rows with a save in flight — one change per row at a time, so quick
  // clicks on its switches can't race each other.
  const [busy, setBusy] = useState(() => new Set());
  const [form, setForm] = useState(null); // { section } — null section = create
  // The section whose products are open in Reorder Products, or null. A
  // curated section's order is the section's own (marketing); a category's or
  // classification's is the catalog's, shared with the Products page.
  const [arranging, setArranging] = useState(null);
  const canArrange = (s) => can(s.type === "curated" ? "marketing.manage" : "catalog.manage");

  const load = useCallback(
    () =>
      api
        .get("/marketing/landing-sections")
        .then(setData)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false)),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  async function withRow(section, task) {
    if (busy.has(section.id)) return;
    setBusy((b) => new Set(b).add(section.id));
    try {
      await task();
    } catch {
      // The API client has already shown the error as a toast.
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(section.id);
        return next;
      });
    }
  }

  const replaceRow = (id, fields) =>
    setData((d) => ({ ...d, items: d.items.map((s) => (s.id === id ? { ...s, ...fields } : s)) }));

  // A switch shows its new state at once and goes back if the save fails.
  const toggle = (section, field, value) =>
    withRow(section, async () => {
      replaceRow(section.id, { [field]: value });
      try {
        const { section: fresh } = await api.patch(`/marketing/landing-sections/${section.id}`, { [field]: value });
        replaceRow(section.id, { [field]: fresh[field] });
      } catch (err) {
        replaceRow(section.id, { [field]: section[field] });
        throw err;
      }
    });

  const move = (section, position) =>
    withRow(section, async () => {
      await api.patch(`/marketing/landing-sections/${section.id}/position`, { position });
      await load();
    });

  const remove = (section) =>
    withRow(section, async () => {
      const ok = await confirmDialog({
        title: "Delete section?",
        message: `Delete "${section.name}" from the landing page? Its products, categories and their order are not touched — only this section goes. Set it to Inactive instead to keep it for later.`,
        confirmText: "Delete section",
        danger: true,
      });
      if (!ok) return;
      await api.delete(`/marketing/landing-sections/${section.id}`);
      await load();
    });

  const items = data.items;
  const sourceOf = (s) => {
    if (s.type === "category") return s.source.category?.name || "Category removed";
    if (s.type === "classification") {
      return data.classifications.find((c) => c.key === s.source.classification)?.label || s.source.classification;
    }
    const n = s.source.products?.length || 0;
    return `${n} product${n === 1 ? "" : "s"} picked`;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Sections</h1>
        </div>
        {canManage && (
          <button className="btn primary" onClick={() => setForm({ section: null })}>
            + Create Section
          </button>
        )}
      </div>

      <Banner tone="error">{error}</Banner>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <Table
            title="Landing page sections"
            pageSize={100}
            rows={items}
            empty={<Empty title="No sections yet" hint="Create one to put products on the landing page." />}
            columns={[
              {
                key: "seq",
                label: "S.No",
                width: 92,
                sortable: false,
                render: (s) => (
                  <div className="order-cell">
                    <span className="order-num">{s.seq}</span>
                    {canManage ? (
                      <span className="order-arrows">
                        <button
                          type="button"
                          className="btn ghost sm"
                          aria-label={`Move ${s.name} up`}
                          disabled={s.seq <= 1 || busy.has(s.id)}
                          onClick={() => move(s, s.seq - 1)}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          aria-label={`Move ${s.name} down`}
                          disabled={s.seq >= items.length || busy.has(s.id)}
                          onClick={() => move(s, s.seq + 1)}
                        >
                          ▼
                        </button>
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "name",
                label: "Section Name",
                render: (s) => (
                  <div className="stack">
                    <span className="row-title">{s.name}</span>
                    <span className="row-sub">{s.description || s.slug}</span>
                  </div>
                ),
              },
              {
                key: "type",
                label: "Section Type",
                render: (s) => (
                  <div className="stack">
                    <Pill tone={s.type === "category" ? "accent" : s.type === "classification" ? "info" : undefined}>
                      {typeLabel(s.type)}
                    </Pill>
                    <span className="row-sub">{sourceOf(s)}</span>
                  </div>
                ),
              },
              {
                key: "liveProducts",
                label: "Products",
                align: "right",
                render: (s) =>
                  s.liveProducts ? (
                    s.liveProducts
                  ) : (
                    <span title="Nothing to show, so it's left off the landing page until it has products">
                      <Pill tone="warn">Empty</Pill>
                    </span>
                  ),
              },
              {
                key: "showOnWebsite",
                label: "Website",
                sortable: false,
                render: (s) => (
                  <Switch
                    checked={s.showOnWebsite}
                    disabled={!canManage || busy.has(s.id)}
                    onChange={(on) => toggle(s, "showOnWebsite", on)}
                    tone="accent"
                    onLabel="Shown"
                    offLabel="Hidden"
                    title={s.showOnWebsite ? "Hide on the website" : "Show on the website"}
                  />
                ),
              },
              {
                key: "showOnApp",
                label: "Mobile App",
                sortable: false,
                render: (s) => (
                  <Switch
                    checked={s.showOnApp}
                    disabled={!canManage || busy.has(s.id)}
                    onChange={(on) => toggle(s, "showOnApp", on)}
                    tone="info"
                    onLabel="Shown"
                    offLabel="Hidden"
                    title={s.showOnApp ? "Hide in the mobile app" : "Show in the mobile app"}
                  />
                ),
              },
              {
                key: "status",
                label: "Status",
                sortable: false,
                render: (s) => (
                  <Switch
                    checked={s.status === "active"}
                    disabled={!canManage || busy.has(s.id)}
                    onChange={(on) => toggle(s, "status", on ? "active" : "inactive")}
                    onLabel="Active"
                    offLabel="Inactive"
                    offTone="danger"
                    title={s.status === "active" ? "Take it off both platforms" : "Put it back where it's switched on"}
                  />
                ),
              },
              {
                key: "actions",
                label: "Actions",
                align: "right",
                sortable: false,
                exportable: false,
                render: (s) =>
                  canManage && (
                    <div className="inline" style={{ gap: 6, justifyContent: "flex-end" }}>
                      {s.orderKey && canArrange(s) ? (
                        <button
                          className="btn sm"
                          disabled={busy.has(s.id)}
                          title="Drag the products in this section into order"
                          onClick={() => setArranging(s)}
                        >
                          Arrange
                        </button>
                      ) : null}
                      <button className="btn sm" disabled={busy.has(s.id)} onClick={() => setForm({ section: s })}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn sm danger icon-btn"
                        aria-label={`Delete ${s.name}`}
                        title={s.system ? "Built-in section — set it to Inactive instead" : "Delete section"}
                        disabled={s.system || busy.has(s.id)}
                        onClick={() => remove(s)}
                      >
                        <IconTrash width="16" height="16" />
                      </button>
                    </div>
                  ),
              },
            ]}
          />
        )}
      </Card>

      {arranging ? (
        <ReorderPanel
          orderKey={arranging.orderKey}
          title={arranging.name}
          onClose={() => setArranging(null)}
          onSaved={load}
        />
      ) : null}

      {form && (
        <SectionForm
          section={form.section}
          total={items.length}
          classifications={data.classifications}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// Create or edit one section. Only the source that matches the chosen type is
// sent, so a curated section's picks survive a trip to another type and back.
function SectionForm({ section, total, classifications, onClose, onSaved }) {
  const editing = Boolean(section);
  const [values, setValues] = useState(() => ({
    name: section?.name || "",
    description: section?.description || "",
    type: section?.type || "category",
    category: section?.source.category?.id || "",
    classification: section?.source.classification || "",
    products: section?.source.products || [],
    position: section?.seq || total + 1,
    showOnWebsite: section?.showOnWebsite ?? true,
    showOnApp: section?.showOnApp ?? true,
    status: section?.status || "active",
  }));
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  useEffect(() => {
    api
      .get("/catalog/categories/tree", { status: "all" })
      .then(({ tree }) => setCategories(flatten(tree)))
      .catch(() => { });
  }, []);

  const sourceFor = (v) =>
    v.type === "category"
      ? { category: v.category }
      : v.type === "classification"
        ? { classification: v.classification }
        : { products: v.products.map((p) => p.id) };

  const sourceLabel = (type, v) =>
    type === "category"
      ? categories.find((c) => c.id === v.category)?.rawName || "a category"
      : type === "classification"
        ? classifications.find((c) => c.key === v.classification)?.label || "a classification"
        : `${v.products.length} picked product${v.products.length === 1 ? "" : "s"}`;

  function validate() {
    const next = {};
    if (!values.name.trim()) next.name = "Give the section a name";
    if (values.type === "category" && !values.category) next.source = "Pick a category";
    if (values.type === "classification" && !values.classification) next.source = "Pick a classification";
    if (values.type === "curated" && !values.products.length) next.source = "Pick at least one product";
    const position = Number(values.position);
    if (!Number.isInteger(position) || position < 1) next.position = "Enter a position of 1 or more";
    setErrors(next);
    return !Object.keys(next).length;
  }

  async function save() {
    if (saving || !validate()) return;
    const body = {
      name: values.name.trim(),
      description: values.description.trim(),
      type: values.type,
      source: sourceFor(values),
      position: Number(values.position),
      showOnWebsite: values.showOnWebsite,
      showOnApp: values.showOnApp,
      status: values.status,
    };

    if (editing) {
      const was = {
        type: section.type,
        category: section.source.category?.id || "",
        classification: section.source.classification || "",
        products: section.source.products || [],
      };
      const changed =
        values.type !== was.type ||
        JSON.stringify(sourceFor(values)) !== JSON.stringify(sourceFor({ ...was, type: values.type }));
      if (changed) {
        const ok = await confirmDialog({
          title: "Change what this section shows?",
          message:
            `"${section.name}" will show ${sourceLabel(values.type, values)} instead of ${sourceLabel(was.type, was)}. ` +
            "No product, category or product order is changed by this" +
            (was.type === "curated" && values.type !== "curated" ? ", and the products you picked are kept in case you switch back." : "."),
          confirmText: "Change it",
        });
        if (!ok) return;
        body.confirmSourceChange = true;
      }
    }

    setSaving(true);
    setSaveError("");
    try {
      if (editing) await api.patch(`/marketing/landing-sections/${section.id}`, body);
      else await api.post("/marketing/landing-sections", body);
      onSaved();
    } catch (err) {
      // Everything typed stays in the form, so a fix and a second save is all
      // it takes.
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? `Edit ${section.name}` : "Create Section"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Section"}
          </button>
        </>
      }
    >
      <Banner tone="error">{saveError}</Banner>

      <Field label="Section Name" error={errors.name}>
        <input
          type="text"
          value={values.name}
          maxLength={60}
          placeholder="e.g. Seasonal Offers"
          onChange={(e) => set("name", e.target.value)}
          autoFocus
        />
      </Field>

      <Field label="Section Type" help={TYPES.find((t) => t.key === values.type)?.hint}>
        <div className="inline" style={{ gap: 6, flexWrap: "wrap" }}>
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn sm${values.type === t.key ? " primary" : ""}`}
              aria-pressed={values.type === t.key}
              disabled={section?.system && t.key !== section.type}
              onClick={() => set("type", t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      {values.type === "category" && (
        <Field label="Category" error={errors.source}>
          <SelectMenu
            value={values.category}
            onChange={(category) => set("category", category)}
            placeholder="Select a category"
            searchable
            options={categories.map((c) => ({ value: c.id, label: c.rawName, depth: c.depth }))}
          />
        </Field>
      )}
      {values.type === "classification" && (
        <Field label="Classification" error={errors.source}>
          <SelectMenu
            value={values.classification}
            onChange={(classification) => set("classification", classification)}
            placeholder="Select a classification"
            disabled={section?.system}
            options={classifications.map((c) => ({ value: c.key, label: c.label }))}
          />
        </Field>
      )}
      {values.type === "curated" && (
        <Field label="Products" error={errors.source} help="Shown in this order. Up to 50.">
          <ProductPicker value={values.products} onChange={(products) => set("products", products)} />
        </Field>
      )}

      <Field label="Description (optional)">
        <textarea
          rows={2}
          maxLength={200}
          value={values.description}
          placeholder="A short line under the section title"
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="grid cols-2">
        <Field label="Display Order" error={errors.position} help={`1 is the top of the landing page.`}>
          <input
            type="number"
            min={1}
            max={editing ? total : total + 1}
            value={values.position}
            onChange={(e) => set("position", e.target.value)}
          />
        </Field>
        <Field label="Status" help="Inactive hides it everywhere, whatever the switches below say.">
          <Switch
            checked={values.status === "active"}
            onChange={(on) => set("status", on ? "active" : "inactive")}
            onLabel="Active"
            offLabel="Inactive"
            offTone="danger"
          />
        </Field>
      </div>
      <div className="grid cols-2">
        <Field label="Show on Website">
          <Switch
            checked={values.showOnWebsite}
            onChange={(on) => set("showOnWebsite", on)}
            tone="accent"
            onLabel="Shown"
            offLabel="Hidden"
          />
        </Field>
        <Field label="Show on Mobile App">
          <Switch
            checked={values.showOnApp}
            onChange={(on) => set("showOnApp", on)}
            tone="info"
            onLabel="Shown"
            offLabel="Hidden"
          />
        </Field>
      </div>
    </Modal>
  );
}

// Searches the existing catalog and keeps an ordered list of picks — the
// section stores references to these products, never copies of them.
function ProductPicker({ value, onChange }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const picked = new Set(value.map((p) => p.id));

  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setResults([]);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(
      () =>
        api
          .get("/catalog/products", { search: term, limit: 8 })
          .then(({ items }) => setResults(items))
          .catch(() => setResults([]))
          .finally(() => setSearching(false)),
      250
    );
    return () => clearTimeout(timer);
  }, [search]);

  const moveBy = (index, step) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + step, 0, item);
    onChange(next);
  };

  return (
    <div className="picker">
      {value.length ? (
        <ol className="picker-list">
          {value.map((p, index) => (
            <li key={p.id}>
              <span className="picker-num">{index + 1}</span>
              <span className="picker-name">{p.name}</span>
              {p.status && p.status !== "active" ? <Pill tone="warn">{p.status}</Pill> : null}
              <span className="picker-actions">
                <button type="button" className="btn ghost sm" aria-label={`Move ${p.name} up`} disabled={index === 0} onClick={() => moveBy(index, -1)}>
                  ▲
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  aria-label={`Move ${p.name} down`}
                  disabled={index === value.length - 1}
                  onClick={() => moveBy(index, 1)}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <input type="search" placeholder="Search products to add…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {search.trim() ? (
        <ul className="picker-results">
          {searching && !results.length ? <li className="faint">Searching…</li> : null}
          {!searching && !results.length ? <li className="faint">No products match.</li> : null}
          {results.map((p) => (
            <li key={p.id}>
              <span className="picker-name">
                {p.name}
                <span className="row-sub"> · {p.category?.name}</span>
              </span>
              <button
                type="button"
                className="btn sm"
                disabled={picked.has(p.id) || value.length >= 50}
                onClick={() => onChange([...value, { id: p.id, name: p.name, status: p.status }])}
              >
                {picked.has(p.id) ? "Added" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function flatten(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ id: node.id, rawName: node.name, depth });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}
