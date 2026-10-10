import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, toast } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import SelectMenu from "../../components/SelectMenu";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pill } from "../../components/ui";
import { IconChevronDown, IconSearch } from "../../components/Icons";
import SeoCard from "../../components/SeoCard";

// What the website writes when a category's SEO fields are left blank (kept
// in step with website/app/c/[slug]/page.jsx).
const autoCategoryTitle = (name) => `Buy ${name || "this category"} Online in Bangalore — Direct from Farmers`;
const autoCategoryDescription = (name) =>
  `Buy fresh ${(name || "produce").toLowerCase()} online in Bangalore, direct from local farmers. Farm-fresh quality, fair prices, same-day home delivery and free delivery on qualifying orders.`;
const seoOf = (detail) => ({
  title: detail.seo?.title || "",
  description: detail.seo?.description || "",
  keywords: detail.seo?.keywords || [],
});


// A save's confirmation, as a toast (components/Toaster.jsx).
const notifySaved = (message) => message && toast("success", message);
// The category editor is where the engine is configured. Three tabs, matching
// the three things a category owns: its own details, the capability switches
// that change how the engine treats its products, and the fields its products
// get. Everything here is inherited by descendants unless they override it.

function TreeNode({ node, selectedId, onSelect, depth = 0 }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children?.length > 0;

  return (
    <div className="tree-node">
      <div
        className={`tree-row${selectedId === node.id ? " selected" : ""}`}
        onClick={() => onSelect(node)}
      >
        <span
          className="twisty"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setOpen(!open);
          }}
        >
          {hasChildren ? (open ? "▾" : "▸") : ""}
        </span>
        <span>{node.name}</span>
        {node.status !== "active" && <Pill tone="warn">{node.status}</Pill>}
        <span className="count">{node.productCount || 0}</span>
      </div>
      {open && hasChildren && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Phone view of the same tree: one scrolling list, rows that expand in place,
// and a bottom sheet for the less common actions so a row never carries a row
// of buttons (or a Delete next to Edit).
function MobileCategoryList({ tree, editable, saving, onOpen, onAddChild, onDelete }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(() => new Set());
  const [menu, setMenu] = useState(null);

  const term = query.trim().toLowerCase();
  // A search keeps every match plus the ancestors that lead to it, expanded.
  const visible = useMemo(() => {
    if (!term) return tree;
    const prune = (nodes) =>
      nodes.flatMap((n) => {
        const kids = prune(n.children || []);
        return n.name.toLowerCase().includes(term) || kids.length ? [{ ...n, children: kids }] : [];
      });
    return prune(tree);
  }, [tree, term]);

  const toggle = (id) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = (nodes, depth = 0) =>
    nodes.map((node) => {
      const kids = node.children || [];
      const expanded = term ? true : open.has(node.id);
      return (
        <div key={node.id}>
          <div className={`cat-m-row${depth ? " child" : ""}`} style={{ paddingLeft: 6 + depth * 18 }}>
            {kids.length ? (
              <button
                type="button"
                className="cat-m-twisty"
                aria-expanded={expanded}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
                onClick={() => toggle(node.id)}
              >
                <IconChevronDown width="16" height="16" style={{ transform: expanded ? "none" : "rotate(-90deg)" }} />
              </button>
            ) : (
              <span className="cat-m-twisty" aria-hidden="true" />
            )}
            <button type="button" className="cat-m-main" onClick={() => onOpen(node)}>
              <span className="cat-m-name">{node.name}</span>
              <span className="cat-m-meta">
                {kids.length ? `${kids.length} sub · ` : ""}
                {node.productCount || 0} {node.productCount === 1 ? "product" : "products"}
                {node.status !== "active" ? <Pill tone="warn">{node.status}</Pill> : null}
              </span>
            </button>
            <button type="button" className="cat-m-more" aria-label={`Actions for ${node.name}`} onClick={() => setMenu(node)}>
              ⋮
            </button>
          </div>
          {expanded && kids.length ? rows(kids, depth + 1) : null}
        </div>
      );
    });

  const pick = (action) => () => {
    const node = menu;
    setMenu(null);
    action(node);
  };

  return (
    <div className="cat-m">
      <label className="cat-m-search">
        <IconSearch width="18" height="18" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories"
          aria-label="Search categories"
        />
      </label>

      {visible.length ? (
        <div className="cat-m-list">{rows(visible)}</div>
      ) : (
        <Empty title={term ? "No matches" : "No categories yet"} hint={term ? "Try a different name." : undefined} />
      )}

      {menu ? (
        <>
          <div className="cat-m-backdrop" onClick={() => setMenu(null)} aria-hidden="true" />
          <div className="cat-m-sheet" role="menu" aria-label={`Actions for ${menu.name}`}>
            <div className="cat-m-sheet-title">{menu.name}</div>
            <button type="button" role="menuitem" onClick={pick(onOpen)}>
              {editable ? "Edit" : "View"}
            </button>
            {editable ? (
              <>
                <button type="button" role="menuitem" onClick={pick(onAddChild)}>
                  Add subcategory
                </button>
                <button type="button" role="menuitem" className="danger" disabled={saving} onClick={pick(onDelete)}>
                  Delete…
                </button>
              </>
            ) : null}
            <button type="button" className="cancel" onClick={() => setMenu(null)}>
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function Categories() {
  const { can } = useAuth();
  const editable = can("catalog.manage");

  const [tree, setTree] = useState([]);
  const [features, setFeatures] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [schema, setSchema] = useState(null);
  const [tab, setTab] = useState("details");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [blockingProducts, setBlockingProducts] = useState([]);
  const navigate = useNavigate();
  // Phone only: false shows the list, true shows the editor for selectedId.
  // Desktop ignores it and always shows both side by side.
  const [mobileEditing, setMobileEditing] = useState(() => Boolean(new URLSearchParams(window.location.search).get("select")));
  // ?select=<id> opens that category — how the new-category page lands you on
  // what you just created.
  const [params] = useSearchParams();
  const preselect = params.get("select");

  const loadTree = useCallback(async () => {
    const { tree: data } = await api.get("/catalog/categories/tree", { status: "all" });
    setTree(data);
    return data;
  }, []);

  useEffect(() => {
    Promise.all([
      loadTree(),
      api.get("/catalog/categories/features"),
      api.get("/catalog/attributes", { limit: 100, status: "active" }),
    ])
      .then(([data, f, a]) => {
        setFeatures(f.features);
        setAttributes(a.items);
        const first = data[0];
        if (preselect) {
          setSelectedId(preselect);
          if (params.get("created")) notifySaved("Category created. Bind fields to it under the Fields tab.");
        } else if (first) setSelectedId(first.id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadTree]);

  // Loading the detail and the resolved schema together is what lets the
  // "Fields" tab show own bindings and inherited ones side by side.
  useEffect(() => {
    if (!selectedId) return;
    setError("");
    setBlockingProducts([]);
    Promise.all([
      api.get(`/catalog/categories/${selectedId}`),
      api.get(`/catalog/categories/${selectedId}/schema`),
    ])
      .then(([d, s]) => {
        setDetail(d.category);
        setSchema(s);
      })
      .catch((err) => setError(err.message));
  }, [selectedId]);

  async function save(changes) {
    setSaving(true);
    setError("");
    notifySaved("");
    try {
      const { category } = await api.patch(`/catalog/categories/${selectedId}`, changes);
      setDetail(category);
      const s = await api.get(`/catalog/categories/${selectedId}/schema`);
      setSchema(s);
      await loadTree();
      notifySaved("Saved. Every product form in this category updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function bindAttribute(attributeId, options = {}) {
    setSaving(true);
    try {
      const { category, schema: next } = await api.post(`/catalog/categories/${selectedId}/attributes`, {
        attribute: attributeId,
        ...options,
      });
      setDetail(category);
      setSchema(next);
      notifySaved("Field added — it is live on the product form now.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function unbindAttribute(attributeId) {
    setSaving(true);
    try {
      const { category } = await api.delete(`/catalog/categories/${selectedId}/attributes/${attributeId}`);
      setDetail(category);
      setSchema(await api.get(`/catalog/categories/${selectedId}/schema`));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Mirrors the backend's own safety check (it refuses a category that still
  // has subcategories or products) so the confirm prompt already reflects
  // what's about to happen rather than a delete that immediately 409s.
  async function removeCategory(target) {
    if (!window.confirm(`Delete "${target.name}"? This can't be undone.`)) return;
    setSaving(true);
    setError("");
    setBlockingProducts([]);
    notifySaved("");
    try {
      await api.delete(`/catalog/categories/${target.id}`);
      const data = await loadTree();
      const flatten = (nodes) => nodes.flatMap((n) => [n, ...flatten(n.children || [])]);
      const remaining = flatten(data);
      const next = remaining.find((n) => n.id === target.parent) || remaining[0];
      setSelectedId(next ? next.id : null);
      if (!next) {
        setDetail(null);
        setSchema(null);
      }
      notifySaved(`"${target.name}" deleted.`);
    } catch (err) {
      setError(err.message);
      // The backend names a few of the actual blocking products when that's
      // why the delete failed, so the admin can jump straight to them
      // instead of hunting for something the tree makes look empty.
      setBlockingProducts(err.details?.products || []);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page"><Loading /></div>;

  const ownBindingIds = new Set((detail?.attributeBindings || []).map((b) => b.attribute?.id || b.attribute));

  return (
    <div className={`page cats-page${mobileEditing ? " m-editing" : ""}`}>
      <div className="page-head cats-head">
        <div>
          <h1>Categories</h1>
        </div>
        {editable && (
          <button className="btn primary" onClick={() => navigate("/catalog/categories/new")}>
            + New category
          </button>
        )}
      </div>

      <button type="button" className="cat-m-back" onClick={() => setMobileEditing(false)}>
        ← All categories
      </button>

      <MobileCategoryList
        tree={tree}
        editable={editable}
        saving={saving}
        onOpen={(node) => {
          setSelectedId(node.id);
          setTab("details");
          setMobileEditing(true);
          window.scrollTo(0, 0);
        }}
        onAddChild={(node) => navigate(`/catalog/categories/new?parent=${node.id}`)}
        onDelete={removeCategory}
      />

      <Banner tone="error">{error}</Banner>
      {blockingProducts.length > 0 && (
        <div className="banner error" style={{ marginTop: -6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
            {blockingProducts.map((p) => (
              <Link key={p.id} to={`/catalog/products/${p.id}`} style={{ textDecoration: "underline" }}>
                {p.name}
                {p.status !== "active" ? ` (${p.status})` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid split cats-desktop">
        <div style={{ display: "grid", gap: 14 }}>
          {detail && schema ? (
            <>
              <Card
                title={
                  <div className="inline">
                    <h2>{detail.name}</h2>
                    <span className="tag">{detail.path}</span>
                  </div>
                }
                actions={
                  editable && (
                    <div className="inline" style={{ gap: 8 }}>
                      <button className="btn sm" onClick={() => navigate(`/catalog/categories/new?parent=${detail.id}`)}>
                        + Subcategory
                      </button>
                      <button className="btn sm danger" disabled={saving} onClick={() => removeCategory(detail)}>
                        Delete
                      </button>
                    </div>
                  )
                }
              >
                <div className="inline" style={{ marginBottom: 14, gap: 4 }}>
                  {["details", "features", "fields", "defaults"].map((key) => (
                    <button
                      key={key}
                      className={`btn sm${tab === key ? " primary" : " ghost"}`}
                      onClick={() => setTab(key)}
                    >
                      {key[0].toUpperCase() + key.slice(1)}
                      {key === "fields" && ` (${schema.fields.length})`}
                    </button>
                  ))}
                </div>

                {tab === "details" && (
                  <DetailsTab detail={detail} tree={tree} onSave={save} saving={saving} editable={editable} />
                )}
                {tab === "features" && (
                  <FeaturesTab
                    detail={detail}
                    features={features}
                    resolved={schema.features}
                    onSave={save}
                    saving={saving}
                    editable={editable}
                  />
                )}
                {tab === "fields" && (
                  <FieldsTab
                    schema={schema}
                    attributes={attributes}
                    ownBindingIds={ownBindingIds}
                    onBind={bindAttribute}
                    onUnbind={unbindAttribute}
                    saving={saving}
                    editable={editable}
                  />
                )}
                {tab === "defaults" && (
                  <DefaultsTab
                    detail={detail}
                    resolved={schema.defaults}
                    onSave={save}
                    saving={saving}
                    editable={editable}
                  />
                )}
              </Card>
            </>
          ) : (
            <Card>
              <Empty title="Select a category" hint="Pick one from the tree to configure it." />
            </Card>
          )}
        </div>

        <Card title="Tree" tight className="cats-tree-card">
          <div className="tree" style={{ padding: 10 }}>
            {tree.length ? (
              tree.map((node) => (
                <TreeNode key={node.id} node={node} selectedId={selectedId} onSelect={(n) => setSelectedId(n.id)} />
              ))
            ) : (
              <Empty title="No categories yet" />
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}

// /catalog/categories/new (?parent=<id> for a subcategory) — creating a
// category as a page. Saving lands on the new category in the tree.
export function CategoryFormPage() {
  const [params] = useSearchParams();
  const parent = params.get("parent") || "";
  return (
    <FormRoute
      backTo="/catalog/categories"
      backLabel="Categories"
      load={async () => {
        const { tree } = await api.get("/catalog/categories/tree", { status: "all" });
        return { tree };
      }}
      render={({ tree }, back, { save, saving }) => (
        <NewCategoryModal
          parentId={parent}
          tree={tree}
          saving={saving}
          onClose={back}
          onCreate={(payload) =>
            save(async () => {
              const { category } = await api.post("/catalog/categories", payload);
              return `/catalog/categories?select=${category.id}&created=1`;
            })
          }
        />
      )}
    />
  );
}

function DetailsTab({ detail, tree, onSave, saving, editable }) {
  const [form, setForm] = useState({
    name: detail.name,
    parent: detail.parent || "",
    icon: detail.icon || "",
    image: detail.image || "",
    color: detail.color || "",
    description: detail.description || "",
    status: detail.status,
    showInNav: detail.showInNav,
    isFeatured: detail.isFeatured,
    seq: detail.seq ?? 0,
    seo: seoOf(detail),
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setForm({
      name: detail.name,
      parent: detail.parent || "",
      icon: detail.icon || "",
      image: detail.image || "",
      color: detail.color || "",
      description: detail.description || "",
      status: detail.status,
      showInNav: detail.showInNav,
      isFeatured: detail.isFeatured,
      seq: detail.seq ?? 0,
      seo: seoOf(detail),
    });
  }, [detail]);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const result = await api.upload(file, "categories");
      setForm((f) => ({ ...f, image: result.url }));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const parentOptions = (() => {
    if (!tree) return [];
    const excluded = new Set();
    const collect = (node) => {
      excluded.add(node.id);
      for (const child of node.children || []) collect(child);
    };
    const findSelf = (nodes) => {
      for (const node of nodes) {
        if (node.id === detail.id) return node;
        const found = findSelf(node.children || []);
        if (found) return found;
      }
      return null;
    };
    const self = findSelf(tree);
    if (self) collect(self);
    return flatten(tree).filter((option) => !excluded.has(option.id));
  })();

  return (
    <>
      <div className="grid cols-2">
        <Field label="Name">
          <input type="text" value={form.name} onChange={set("name")} disabled={!editable} />
        </Field>
        <Field label="Parent category" >
          <select value={form.parent} onChange={set("parent")} disabled={!editable}>
            <option value="">— Top level —</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid cols-2">
        <Field label="Icon" >
          <input type="text" value={form.icon} onChange={set("icon")} disabled={!editable} maxLength={4} />
        </Field>
      </div>
      <Field label="Tile photo" >
        <div className="inline" style={{ gap: 10, alignItems: "center" }}>
          {form.image ? (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "1px solid var(--border)",
                backgroundImage: `url(${form.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                flexShrink: 0,
              }}
            />
          ) : null}
          {editable ? (
            <label
              className="btn sm"
              style={{ cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
          ) : null}
        </div>
        {uploadError ? (
          <span className="field-error" style={{ color: "var(--danger)", fontSize: 12 }}>
            {uploadError}
          </span>
        ) : null}
      </Field>
      <Field label="Description">
        <textarea value={form.description} onChange={set("description")} disabled={!editable} />
      </Field>
      <div className="grid cols-3">
        <Field label="Status">
          <select value={form.status} onChange={set("status")} disabled={!editable}>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <Field label="Tile colour">
          <input type="text" value={form.color} onChange={set("color")} placeholder="#DCFCE7" disabled={!editable} />
        </Field>
        <Field label="Sort order">
          <input type="number" value={form.seq} onChange={set("seq")} disabled={!editable} />
        </Field>
      </div>
      <div className="inline" style={{ marginBottom: 14 }}>
        <label className="checkbox">
          <input type="checkbox" checked={form.showInNav} onChange={set("showInNav")} disabled={!editable} />
          Show in navigation
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.isFeatured} onChange={set("isFeatured")} disabled={!editable} />
          Featured
        </label>
      </div>
      <SeoCard
        bare
        value={form.seo}
        onChange={(seo) => setForm((f) => ({ ...f, seo }))}
        editable={editable}
        autoTitle={autoCategoryTitle(form.name)}
        autoDescription={autoCategoryDescription(form.name)}
        path={detail.slug ? `/c/${detail.slug}` : ""}
      />
      {editable && (
        <button
          className="btn primary"
          disabled={saving}
          onClick={() => onSave({ ...form, parent: form.parent || null })}
        >
          {saving ? "Saving…" : "Save details"}
        </button>
      )}
    </>
  );
}

function FeaturesTab({ detail, features, resolved, onSave, saving, editable }) {
  // Tri-state: true / false / "inherit". Storing null means "say nothing and
  // take my parent's answer", which is what keeps a child from having to
  // restate the whole set to change one switch.
  const own = detail.features || {};
  const [draft, setDraft] = useState(own);

  useEffect(() => setDraft(detail.features || {}), [detail]);

  const valueFor = (key) => (draft[key] === undefined || draft[key] === null ? "inherit" : String(draft[key]));

  const change = (key, value) => {
    setDraft((d) => {
      const next = { ...d };
      if (value === "inherit") delete next[key];
      else next[key] = value === "true";
      return next;
    });
  };

  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Capability</th>
              <th style={{ width: 210 }}>This category</th>
              <th style={{ width: 110 }}>Effective</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr key={feature.key}>
                <td>
                  <div className="stack">
                    <span className="row-title">{feature.label}</span>
                    {feature.help && <span className="row-sub">{feature.help}</span>}
                  </div>
                </td>
                <td>
                  <select
                    value={valueFor(feature.key)}
                    onChange={(e) => change(feature.key, e.target.value)}
                    disabled={!editable}
                  >
                    <option value="inherit">Inherit</option>
                    <option value="true">On</option>
                    <option value="false">Off</option>
                  </select>
                </td>
                <td>
                  <Pill tone={resolved[feature.key] ? "ok" : undefined}>
                    {resolved[feature.key] ? "On" : "Off"}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <button
          className="btn primary"
          style={{ marginTop: 14 }}
          disabled={saving}
          onClick={() => onSave({ features: draft })}
        >
          {saving ? "Saving…" : "Save capabilities"}
        </button>
      )}
    </>
  );
}

function FieldsTab({ schema, attributes, ownBindingIds, onBind, onUnbind, saving, editable }) {
  const [adding, setAdding] = useState("");
  const unbound = attributes.filter((a) => !schema.fields.some((f) => f.code === a.code));

  return (
    <>

      {editable && (
        <div className="toolbar">
          <select value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">— Add a field —</option>
            {unbound.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.inputType})
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!adding || saving}
            onClick={() => {
              onBind(adding);
              setAdding("");
            }}
          >
            Add field
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Group</th>
              <th>Flags</th>
              <th>Source</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schema.fields.map((field) => (
              <tr key={field.code}>
                <td>
                  <div className="stack">
                    <span className="row-title">
                      {field.label}
                      {field.required && <span style={{ color: "var(--danger)" }}> *</span>}
                    </span>
                    <span className="tag">{field.code}</span>
                  </div>
                </td>
                <td className="muted">{field.inputType}</td>
                <td className="muted">{field.group}</td>
                <td>
                  <div className="inline" style={{ gap: 4 }}>
                    {field.isVariantAxis && <Pill tone="accent">variant axis</Pill>}
                    {field.filterable && <Pill tone="info">filter</Pill>}
                  </div>
                </td>
                <td>
                  {field.inheritedFrom ? (
                    <span className="faint" style={{ fontSize: 12 }}>
                      from {field.inheritedFrom}
                    </span>
                  ) : (
                    <Pill tone="ok">own</Pill>
                  )}
                </td>
                <td className="right">
                  {editable && !field.inheritedFrom && ownBindingIds.has(field.attributeId) && (
                    <button
                      className="btn ghost sm danger"
                      disabled={saving}
                      onClick={() => onUnbind(field.attributeId)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!schema.fields.length && <Empty title="No fields bound yet" hint="Add one above." />}
    </>
  );
}

const DEFAULT_FIELDS = [
  { key: "unit", label: "Unit", type: "text", placeholder: "kg, pcs, pack" },
  { key: "taxRatePct", label: "Tax rate %", type: "number" },
  { key: "hsnCode", label: "HSN code", type: "text" },
  { key: "shelfLifeDays", label: "Shelf life (days)", type: "number" },
  { key: "returnWindowDays", label: "Return window (days)", type: "number" },
  { key: "lowStockThreshold", label: "Low stock threshold", type: "number" },
  { key: "minOrderQty", label: "Min order qty", type: "number" },
  { key: "maxOrderQty", label: "Max order qty", type: "number" },
  { key: "stepQty", label: "Quantity step", type: "number" },
];

function DefaultsTab({ detail, resolved, onSave, saving, editable }) {
  const [draft, setDraft] = useState(detail.defaults || {});
  useEffect(() => setDraft(detail.defaults || {}), [detail]);

  const set = (key, raw, type) => {
    setDraft((d) => {
      const next = { ...d };
      // Empty means "inherit", so it is stored as null rather than as 0 or "".
      // A 0 that was actually typed is a real answer and must beat the parent.
      if (raw === "") next[key] = null;
      else next[key] = type === "number" ? Number(raw) : raw;
      return next;
    });
  };

  return (
    <>
      <div className="grid cols-3">
        {DEFAULT_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            help={
              draft[field.key] === null || draft[field.key] === undefined
                ? `Inheriting: ${resolved[field.key] ?? "—"}`
                : undefined
            }
          >
            <input
              type={field.type}
              placeholder={field.placeholder || "Inherit"}
              value={draft[field.key] ?? ""}
              onChange={(e) => set(field.key, e.target.value, field.type)}
              disabled={!editable}
            />
          </Field>
        ))}
      </div>
      {editable && (
        <button className="btn primary" disabled={saving} onClick={() => onSave({ defaults: draft })}>
          {saving ? "Saving…" : "Save defaults"}
        </button>
      )}
    </>
  );
}

function flatten(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ id: node.id, name: `${"— ".repeat(depth)}${node.name}`, rawName: node.name, depth });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}

function NewCategoryModal({ parentId, tree, saving, onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", icon: "", parent: parentId || "", status: "active" });
  const options = flatten(tree);

  return (
    <Modal
      title="New category"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!form.name.trim() || saving}
            onClick={() => onCreate({ ...form, parent: form.parent || null })}
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </>
      }
    >
      <Field label="Name">
        <input
          type="text"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Electricals"
        />
      </Field>
      <div className="grid cols-2">
        <Field label="Parent" help="Leave empty to create a top-level department.">
          <SelectMenu
            value={form.parent}
            onChange={(parent) => setForm({ ...form, parent })}
            emptyLabel="Top level (a new department)"
            searchable
            options={options.map((option) => ({ value: option.id, label: option.rawName, depth: option.depth }))}
          />
        </Field>
        <Field label="Icon">
          <input
            type="text"
            maxLength={4}
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            placeholder=""
          />
        </Field>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        It inherits its parent's capabilities, defaults and fields. Add anything specific to it
        afterwards — no deploy needed.
      </p>
    </Modal>
  );
}
