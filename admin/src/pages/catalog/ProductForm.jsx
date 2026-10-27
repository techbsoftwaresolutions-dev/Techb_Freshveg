import Select from "../../components/Select";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Field, Loading, Pill } from "../../components/ui";
import SchemaForm from "../../components/SchemaForm";
import SelectMenu from "../../components/SelectMenu";

// This screen is the point of the whole engine. Pick a category and the rest
// of the form rebuilds itself from that category's resolved schema — which
// fields exist, which of them are required, which split the product into
// variants, and what the defaults are. Nothing below names a category.

const emptyProduct = {
  name: "",
  category: "",
  brand: "",
  shortDescription: "",
  description: "",
  tags: [],
  status: "draft",
  isFeatured: false,
  offer: { kind: "", title: "", discountPct: "", details: "" },
  attributes: {},
  media: [],
};

// What "Duplicate product" carries over: everything the admin typed, none of
// what the system generated. Ids, slug, SKU and barcode are left out so the
// create API issues fresh ones; stock lives in its own collection and is never
// part of this payload, so the copy starts with none.
const VARIANT_SYSTEM_FIELDS = [
  "id", "_id", "product", "category", "categoryPath", "sku", "barcode", "axisKey",
  "totalStock", "inStock", "createdAt", "updatedAt", "discountPct", "savings", "unitPrice",
];

// What the offer dropdown sends: only the fields that belong to the chosen kind.
function offerPayload(offer = {}) {
  const kind = offer.kind || "";
  if (!kind) return { kind: "", title: "", details: "" };
  const pct = Number(offer.discountPct);
  return {
    kind,
    title: offer.title || "",
    details: kind === "combo" ? offer.details || "" : "",
    ...(kind === "discount" && offer.discountPct !== "" && Number.isFinite(pct) ? { discountPct: pct } : {}),
  };
}

function duplicateOf({ product, variants }) {
  const copy = {
    ...emptyProduct,
    name: product.name,
    category: product.category?.id || product.category,
    brand: product.brand?.id || product.brand || "",
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    tags: product.tags || [],
    isFeatured: Boolean(product.isFeatured),
    offer: { ...emptyProduct.offer, ...(product.offer || {}) },
    attributes: product.attributes || {},
    media: (product.media || []).map((m) => ({ ...m })),
  };
  const copiedVariants = variants.map((v, i) => {
    const rest = { ...v };
    VARIANT_SYSTEM_FIELDS.forEach((key) => delete rest[key]);
    return {
      ...rest,
      _key: `new-${Date.now()}-${i}`,
      axis: Object.fromEntries((v.axisValues || []).map((a) => [a.code, a.value])),
    };
  });
  return { copy, copiedVariants };
}

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const editable = can("catalog.manage");
  const isNew = id === "new";
  const [searchParams] = useSearchParams();
  const fromId = isNew ? searchParams.get("from") : null;
  const [basedOn, setBasedOn] = useState("");

  const [product, setProduct] = useState(emptyProduct);
  const [variants, setVariants] = useState([]);
  const [schema, setSchema] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/catalog/categories/tree", { status: "active" }),
      api.get("/catalog/brands", { limit: 100 }),
      isNew && !fromId ? Promise.resolve(null) : api.get(`/catalog/products/${fromId || id}`),
    ])
      .then(([tree, brandData, detail]) => {
        setCategories(flatten(tree.tree));
        setBrands(brandData.items);
        if (detail && fromId) {
          const { copy, copiedVariants } = duplicateOf(detail);
          setProduct(copy);
          setVariants(copiedVariants);
          setSchema(detail.schema);
          setBasedOn(detail.product.name);
        } else if (detail) {
          setProduct({
            ...emptyProduct,
            ...detail.product,
            category: detail.product.category?.id || detail.product.category,
            brand: detail.product.brand?.id || detail.product.brand || "",
          });
          setVariants(detail.variants);
          setSchema(detail.schema);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isNew, fromId]);

  // Changing the category swaps the entire field set. Values whose field no
  // longer exists are dropped rather than sent to a schema that would reject
  // them.
  async function pickCategory(categoryId) {
    setProduct((p) => ({ ...p, category: categoryId }));
    if (!categoryId) {
      setSchema(null);
      return;
    }
    try {
      const next = await api.get(`/catalog/categories/${categoryId}/schema`);
      setSchema(next);
      setProduct((p) => {
        const allowed = new Set(next.fields.map((f) => f.code));
        const kept = Object.fromEntries(
          Object.entries(p.attributes || {}).filter(([code]) => allowed.has(code))
        );
        return { ...p, attributes: kept };
      });
      // Seed one variant per axis combination the category implies, so a new
      // product is immediately sellable.
      if (!variants.length) {
        setVariants([blankVariant(next)]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const axes = schema?.variantAxes || [];

  async function save({ publish } = {}) {
    setSaving(true);
    setError("");
    setFieldErrors({});
    setNotice("");

    const payload = {
      name: product.name,
      category: product.category,
      brand: product.brand || null,
      shortDescription: product.shortDescription,
      description: product.description,
      tags: product.tags,
      isFeatured: product.isFeatured,
      offer: offerPayload(product.offer),
      status: publish ? "active" : product.status,
      attributes: product.attributes,
      media: (product.media || []).map((m, index) => ({
        url: m.url,
        alt: m.alt || product.name,
        type: m.type || "image",
        seq: index,
        focalX: m.focalX ?? 50,
        focalY: m.focalY ?? 50,
      })),
      variants: variants.map((v) => {
        const axisValues = axes
          .map((axis) => ({
            code: axis.code,
            value: v.axis?.[axis.code] ?? "",
            label: axis.options?.find((o) => o.value === v.axis?.[axis.code])?.label,
          }))
          .filter((a) => a.value !== "");
        return {
          ...v,
          mrp: v.mrp ?? 0,
          sellingPrice: v.sellingPrice ?? 0,
          costPrice: v.costPrice ?? 0,
          weightGrams: v.weightGrams ?? 0,
          axisValues,
          // A variant with no name of its own is unreadable everywhere it's
          // listed alone (Stock panel, Inventory, order lines) — fall back
          // to its axis labels ("250 g") and, failing that, the product's
          // own name, so this is never blank.
          name:
            (v.name || "").trim() ||
            axisValues.map((a) => a.label || a.value).filter(Boolean).join(" / ") ||
            product.name,
        };
      }),
    };

    try {
      const result = isNew
        ? await api.post("/catalog/products", payload)
        : await api.patch(`/catalog/products/${id}`, payload);

      setNotice("Saved.");
      if (isNew) navigate(`/catalog/products/${result.product.id}`, { replace: true });
      else {
        setProduct((p) => ({ ...p, ...result.product, category: product.category, brand: product.brand }));
        setVariants(result.variants);
      }
    } catch (err) {
      setError(err.message);
      // A 422 carries per-field messages; hand them to the schema form so they
      // render against the right inputs.
      if (err.details) setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  const categoryName = useMemo(
    () => categories.find((c) => c.id === product.category)?.rawName,
    [categories, product.category]
  );

  if (loading) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{isNew ? "New product" : product.name || "Product"}</h1>
          {basedOn && <span className="faint" style={{ fontSize: 12 }}>Based on: {basedOn}</span>}
        </div>
        <div className="inline">
          <button className="btn" onClick={() => navigate("/catalog/products")}>
            Back
          </button>
          {editable && !isNew && (
            <button className="btn ghost" onClick={() => navigate(`/catalog/products/new?from=${id}`)}>
              Duplicate product
            </button>
          )}
          {editable && (
            <>
              <button className="btn" disabled={saving || !product.category} onClick={() => save()}>
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button
                className="btn primary"
                disabled={saving || !product.category || !product.name}
                onClick={() => save({ publish: true })}
              >
                Save & publish
              </button>
            </>
          )}
        </div>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{notice}</Banner>

      <div className="grid split">
        <div style={{ display: "grid", gap: 14 }}>
          <Card title="Basics">
            <div className="grid cols-2">
              <Field label="Product name">
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => setProduct({ ...product, name: e.target.value })}
                  disabled={!editable}
                  placeholder="e.g. Tomato"
                />
              </Field>
              <Field label="Category">
                <SelectMenu
                  value={product.category}
                  onChange={pickCategory}
                  disabled={!editable}
                  placeholder="Select a category"
                  searchable
                  options={categories.map((c) => ({ value: c.id, label: c.rawName, depth: c.depth }))}
                />
              </Field>
            </div>

            <div className="grid cols-2">
              <Field label="Brand">
                <SelectMenu
                  value={product.brand || ""}
                  onChange={(brand) => setProduct({ ...product, brand })}
                  disabled={!editable}
                  emptyLabel="No brand"
                  options={brands.map((b) => ({ value: b.id, label: b.name }))}
                />
              </Field>
              <Field label="Tags">
                <input
                  type="text"
                  value={(product.tags || []).join(", ")}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    })
                  }
                  disabled={!editable}
                />
              </Field>
            </div>

            <Field label="Short description">
              <input
                type="text"
                value={product.shortDescription}
                onChange={(e) => setProduct({ ...product, shortDescription: e.target.value })}
                disabled={!editable}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={product.description}
                onChange={(e) => setProduct({ ...product, description: e.target.value })}
                disabled={!editable}
              />
            </Field>
            <OfferField
              offer={{ ...emptyProduct.offer, ...(product.offer || {}) }}
              editable={editable}
              onChange={(offer) => setProduct({ ...product, offer })}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={product.isFeatured}
                onChange={(e) => setProduct({ ...product, isFeatured: e.target.checked })}
                disabled={!editable}
              />
              Feature on the app home screen
            </label>
          </Card>

          <MediaUploader
            media={product.media || []}
            name={product.name}
            editable={editable}
            onChange={(media) => setProduct((p) => ({ ...p, media }))}
          />

          {schema && (
            <Card
              title={`Details for ${categoryName}`}
              actions={<span className="faint" style={{ fontSize: 12 }}>{schema.fields.length} fields</span>}
            >
              <SchemaForm
                groups={schema.groups}
                values={product.attributes || {}}
                errors={fieldErrors}
                onChange={(attributes) => setProduct({ ...product, attributes })}
              />
            </Card>
          )}

          {schema && (
            <VariantEditor
              axes={axes}
              variants={variants}
              schema={schema}
              editable={editable}
              onChange={setVariants}
            />
          )}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {schema && (
            <Card title="Inherited from the category">
              <div className="section-label">Capabilities</div>
              <div className="inline" style={{ gap: 5 }}>
                {Object.entries(schema.features)
                  .filter(([, on]) => on)
                  .map(([key]) => (
                    <Pill key={key} tone="accent">
                      {key}
                    </Pill>
                  ))}
              </div>

              <div className="section-label">Defaults</div>
              <table className="data">
                <tbody>
                  {Object.entries(schema.defaults)
                    .filter(([, value]) => value !== null && value !== undefined)
                    .map(([key, value]) => (
                      <tr key={key}>
                        <td className="muted">{key}</td>
                        <td className="num">{String(value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>

            </Card>
          )}

          {!isNew && (
            <Card title="Status">
              <Field label="Publication status">
                <SelectMenu
                  value={product.status}
                  onChange={(status) => setProduct({ ...product, status })}
                  disabled={!editable}
                  options={[
                    { value: "draft", label: "Draft", hint: "Not on the store" },
                    { value: "active", label: "Active", hint: "Live on the store" },
                    { value: "hidden", label: "Hidden", hint: "Direct link only" },
                    { value: "archived", label: "Archived", hint: "Retired" },
                  ]}
                />
              </Field>
              <div className="stack faint" style={{ fontSize: 12 }}>
                <span>Slug: {product.slug}</span>
                <span>Variants: {variants.length}</span>
              </div>
            </Card>
          )}

          {!isNew && variants.length > 0 && (
            <StockCard productId={id} variants={variants} editable={can("inventory.adjust")} />
          )}
        </div>
      </div>
    </div>
  );
}

// A brand-new product has a category, photos and a price the moment it's
// saved, but nothing here ever asks how many are on the shelf — that lives
// in Inventory, keyed off a stock record that does not exist until someone
// receives a first batch. Without this card there is no way to give a fresh
// variant its opening stock short of the Inventory tab, which only lists
// variants that already have a record — so a brand-new one never appears
// there either. This closes that gap right where the gap is felt.
function StockCard({ productId, variants, editable }) {
  const [stores, setStores] = useState([]);
  const [store, setStore] = useState("");
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receiving, setReceiving] = useState(null);
  const [qty, setQty] = useState({});

  useEffect(() => {
    api
      .get("/stores/public")
      .then(({ stores: list }) => {
        setStores(list);
        if (list.length) setStore(list[0].id);
        else setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!store) return;
    setLoading(true);
    api
      .get("/inventory", { store, product: productId, limit: 100 })
      .then(({ items }) => {
        const byVariant = {};
        for (const row of items) byVariant[row.variant?.id || row.variant] = row;
        setRows(byVariant);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [store, productId]);

  async function receive(variantId) {
    const quantity = Number(qty[variantId]);
    if (!quantity || quantity <= 0) return;
    setReceiving(variantId);
    setError("");
    try {
      const { inventory } = await api.post("/inventory/receive", {
        store,
        variant: variantId,
        quantity,
        reason: "Initial stock",
      });
      setRows((prev) => ({ ...prev, [variantId]: inventory }));
      setQty((prev) => ({ ...prev, [variantId]: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setReceiving(null);
    }
  }

  return (
    <Card
      title="Stock"
      actions={
        stores.length > 1 ? (
          <Select value={store} onChange={(e) => setStore(e.target.value)} style={{ fontSize: 12 }}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        ) : null
      }
    >
      <Banner tone="error">{error}</Banner>
      {loading ? (
        <Loading />
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {variants.map((variant) => {
            // Before a product is saved for the first time (or right after a
            // failed save), a freshly-added variant has no backend id yet —
            // fall back to its client-side _key so it still gets a row of
            // its own instead of colliding with any other unsaved variant.
            const rowKey = variant.id || variant._key;
            const row = variant.id ? rows[variant.id] : null;
            const available = row?.available ?? 0;
            return (
              <div key={rowKey} className="inline" style={{ justifyContent: "space-between", gap: 8 }}>
                <div className="stack">
                  <span className="row-title">{variant.name || variant.sku || "Unnamed variant"}</span>
                  <Pill tone={available > 0 ? "ok" : "danger"}>
                    {!variant.id ? "Not saved yet" : row ? `${available} in stock` : "Never stocked"}
                  </Pill>
                </div>
                {editable && variant.id ? (
                  <div className="inline" style={{ gap: 6 }}>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={qty[rowKey] || ""}
                      onChange={(e) => setQty((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                      style={{ width: 70 }}
                    />
                    <button
                      className="btn sm"
                      disabled={receiving === rowKey || !qty[rowKey]}
                      onClick={() => receive(variant.id)}
                    >
                      {receiving === rowKey ? "…" : row ? "Add stock" : "Receive"}
                    </button>
                  </div>
                ) : editable ? (
                  <span className="faint" style={{ fontSize: 12 }}>Save the product first</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

let variantKeySeq = 0;
function makeVariantKey() {
  variantKeySeq += 1;
  return `new-${Date.now()}-${variantKeySeq}`;
}

function blankVariant(schema) {
  return {
    _key: makeVariantKey(),
    axis: {},
    sellingPrice: null,
    mrp: null,
    costPrice: null,
    packSize: { value: 1, unit: schema?.defaults?.unit || "pcs" },
    stepQty: schema?.defaults?.stepQty ?? 1,
    minOrderQty: schema?.defaults?.minOrderQty ?? 1,
    status: "active",
    isDefault: true,
  };
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// The store shows a blank tile until a product has at least one photo — this
// is the only place that gap gets closed. Uploads go straight to the storage
// API and land in `media` as soon as each one finishes; nothing here is
// persisted until the product itself is saved.
const OFFER_KINDS = [
  { value: "", label: "No offer" },
  { value: "discount", label: "Discount" },
  { value: "special", label: "Special offer" },
  { value: "combo", label: "Combo offer" },
];

// An expandable "Offer" dropdown: pick a kind and the fields for it open below.
function OfferField({ offer, editable, onChange }) {
  const set = (patch) => onChange({ ...offer, ...patch });
  return (
    <div className="offer-field">
      <Field label="Offer">
        <Select value={offer.kind || ""} onChange={(e) => set({ kind: e.target.value })} disabled={!editable}>
          {OFFER_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </Select>
      </Field>

      {offer.kind ? (
        <div className="offer-panel">
          {offer.kind === "discount" ? (
            <Field label="Discount %">
              <input
                type="number"
                min="0"
                max="100"
                value={offer.discountPct ?? ""}
                onChange={(e) => set({ discountPct: e.target.value })}
                placeholder="e.g. 10"
                disabled={!editable}
              />
            </Field>
          ) : null}
          <Field label={offer.kind === "combo" ? "Combo name" : "Offer title"}>
            <input
              type="text"
              value={offer.title || ""}
              maxLength={60}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={
                offer.kind === "combo" ? "e.g. Breakfast combo" : offer.kind === "special" ? "e.g. Festival special" : "Optional, e.g. Weekend deal"
              }
              disabled={!editable}
            />
          </Field>
          {offer.kind === "combo" ? (
            <Field label="What's in the combo">
              <input
                type="text"
                value={offer.details || ""}
                maxLength={200}
                onChange={(e) => set({ details: e.target.value })}
                placeholder="e.g. Milk 1 L + Bread + Butter 100 g"
                disabled={!editable}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MediaUploader({ media, name, editable, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  // Index of the photo whose options popup is open, or null.
  const [picked, setPicked] = useState(null);
  const pickedItem = picked !== null ? media[picked] : null;

  useEffect(() => {
    if (picked === null) return undefined;
    const onKey = (e) => e.key === "Escape" && setPicked(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picked]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setError("");
    setUploading(true);
    const uploaded = [];
    try {
      for (const file of files) {
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          throw new Error(`${file.name}: only JPEG, PNG, WebP and GIF images are accepted`);
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`${file.name}: file is larger than 5 MB`);
        }
        const result = await api.upload(file, "products");
        uploaded.push({ url: result.url, alt: name || "", type: "image" });
      }
      onChange([...media, ...uploaded]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const remove = (index) => onChange(media.filter((_, i) => i !== index));

  const setFocal = (index, focalX, focalY) =>
    onChange(media.map((m, i) => (i === index ? { ...m, focalX, focalY } : m)));

  const FOCAL_POINTS = [
    [0, 0], [50, 0], [100, 0],
    [0, 50], [50, 50], [100, 50],
    [0, 100], [50, 100], [100, 100],
  ];

  // The first photo is what the storefront's card and gallery lead with, so
  // "make primary" is just moving an entry to the front of the array.
  const makePrimary = (index) => {
    if (index === 0) return;
    const next = [...media];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  };

  return (
    <Card
      title="Photos"
      actions={
        editable && (
          <label className="btn sm" style={{ cursor: uploading ? "not-allowed" : "pointer", marginBottom: 0 }}>
            {uploading ? "Uploading…" : "+ Add photos"}
            <input
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              multiple
              hidden
              disabled={uploading}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )
      }
    >
      <Banner tone="error">{error}</Banner>

      {pickedItem ? (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPicked(null)}>
          <div className="modal photo-options" role="dialog" aria-modal="true" aria-label="Photo options">
            <header className="modal-head">
              <h2>Photo {picked + 1}{picked === 0 ? " · Primary" : ""}</h2>
              <button type="button" className="btn ghost sm" onClick={() => setPicked(null)} aria-label="Close">
                ✕
              </button>
            </header>
            <div className="modal-body">
              <div className="media-thumb photo-options-thumb">
                <img
                  src={pickedItem.url}
                  alt={pickedItem.alt || ""}
                  style={{ objectPosition: `${pickedItem.focalX ?? 50}% ${pickedItem.focalY ?? 50}%` }}
                />
                {/* Where the storefront card crops this photo from — only
                    matters once it's cropped to a square. */}
                <div className="media-focal-grid">
                  {FOCAL_POINTS.map(([fx, fy]) => (
                    <button
                      key={`${fx}-${fy}`}
                      type="button"
                      className={(pickedItem.focalX ?? 50) === fx && (pickedItem.focalY ?? 50) === fy ? "active" : ""}
                      aria-label={`Crop focus: ${fy === 0 ? "top" : fy === 100 ? "bottom" : "middle"} ${fx === 0 ? "left" : fx === 100 ? "right" : "center"}`}
                      onClick={() => setFocal(picked, fx, fy)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <footer className="modal-foot">
              {picked !== 0 ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    makePrimary(picked);
                    setPicked(null);
                  }}
                >
                  Make primary
                </button>
              ) : null}
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  remove(picked);
                  setPicked(null);
                }}
              >
                Remove
              </button>
              <button type="button" className="btn primary" onClick={() => setPicked(null)}>
                Done
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {media.length ? (
        <div className="media-grid">
          {media.map((item, index) => (
            <div key={`${item.url}-${index}`} className="media-item">
              {/* Click a photo to open its options: make it the main photo,
                  remove it, or choose where its crop is centred. */}
              <button
                type="button"
                className={`media-thumb media-thumb-btn${editable ? "" : " readonly"}`}
                onClick={() => editable && setPicked(index)}
                aria-label={editable ? `Photo ${index + 1} options` : `Photo ${index + 1}`}
                disabled={!editable}
              >
                <img
                  src={item.url}
                  alt={item.alt || ""}
                  style={{ objectPosition: `${item.focalX ?? 50}% ${item.focalY ?? 50}%` }}
                />
                {index === 0 ? <span className="media-primary">Primary</span> : null}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

// Variants are a table, not a form: the axes are columns because the category
// decided what they are, so the editor has no fixed shape either.
function VariantEditor({ axes, variants, schema, editable, onChange }) {
  const set = (index, patch) =>
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  const setAxis = (index, code, value) =>
    onChange(
      variants.map((v, i) => (i === index ? { ...v, axis: { ...(v.axis || {}), [code]: value } } : v))
    );

  // Prices are entered in rupees but stored as integer paise.
  const money = (index, key) => (e) => {
    if (e.target.value === "") {
      // Leave it genuinely empty rather than coercing to 0 — that 0 would
      // immediately become this input's controlled `value` again, and the
      // field would look like it refuses to clear. save() below fills in 0
      // for anything still empty at submit time.
      set(index, { [key]: null });
      return;
    }
    const rupeeValue = Number(e.target.value);
    if (Number.isNaN(rupeeValue)) return;
    set(index, { [key]: Math.round(rupeeValue * 100) });
  };

  return (
    <Card
      title="Variants & pricing"
      actions={
        editable && (
          <button className="btn sm" onClick={() => onChange([...variants, blankVariant(schema)])}>
            + Add variant
          </button>
        )
      }
      tight
    >
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {axes.map((axis) => (
                <th key={axis.code}>{axis.label}</th>
              ))}
              <th>Name</th>
              <th className="num">MRP ₹</th>
              <th className="num">Selling ₹</th>
              <th className="num">Cost ₹</th>
              <th className="num">Pack</th>
              <th className="num" title="Shipping weight of one unit — used to total an order's weight">
                Weight (g)
              </th>
              <th>Default</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <tr key={variant.id || variant._key || index}>
                {axes.map((axis) => (
                  <td key={axis.code}>
                    {axis.options?.length ? (
                      <Select
                        value={
                          variant.axis?.[axis.code] ??
                          variant.axisValues?.find((a) => a.code === axis.code)?.value ??
                          ""
                        }
                        onChange={(e) => setAxis(index, axis.code, e.target.value)}
                        disabled={!editable}
                      >
                        <option value="">—</option>
                        {axis.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <input
                        type="text"
                        value={variant.axis?.[axis.code] ?? ""}
                        onChange={(e) => setAxis(index, axis.code, e.target.value)}
                        disabled={!editable}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <input
                    type="text"
                    value={variant.name ?? ""}
                    onChange={(e) => set(index, { name: e.target.value })}
                    placeholder="Auto (from pack size)"
                    disabled={!editable}
                    style={{ width: 130 }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    value={variant.mrp === null || variant.mrp === undefined ? "" : variant.mrp / 100}
                    onChange={money(index, "mrp")}
                    disabled={!editable}
                    style={{ width: 92 }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    value={variant.sellingPrice === null || variant.sellingPrice === undefined ? "" : variant.sellingPrice / 100}
                    onChange={money(index, "sellingPrice")}
                    disabled={!editable}
                    style={{ width: 92 }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    value={variant.costPrice === null || variant.costPrice === undefined ? "" : variant.costPrice / 100}
                    onChange={money(index, "costPrice")}
                    disabled={!editable}
                    style={{ width: 92 }}
                  />
                </td>
                <td className="num">
                  <div className="inline" style={{ flexWrap: "nowrap" }}>
                    <input
                      type="number"
                      value={variant.packSize?.value ?? 1}
                      onChange={(e) =>
                        set(index, { packSize: { ...variant.packSize, value: Number(e.target.value) } })
                      }
                      disabled={!editable}
                      style={{ width: 66 }}
                    />
                    <input
                      type="text"
                      value={variant.packSize?.unit ?? "pcs"}
                      onChange={(e) =>
                        set(index, { packSize: { ...variant.packSize, unit: e.target.value } })
                      }
                      disabled={!editable}
                      style={{ width: 62 }}
                    />
                  </div>
                </td>
                <td className="num">
                  <input
                    type="number"
                    min="0"
                    value={variant.weightGrams ?? ""}
                    onChange={(e) =>
                      set(index, { weightGrams: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    placeholder="0"
                    disabled={!editable}
                    style={{ width: 78 }}
                  />
                </td>
                <td>
                  <input
                    type="radio"
                    name="defaultVariant"
                    checked={Boolean(variant.isDefault)}
                    onChange={() =>
                      onChange(variants.map((v, i) => ({ ...v, isDefault: i === index })))
                    }
                    disabled={!editable}
                  />
                </td>
                <td className="right">
                  {editable && variants.length > 1 && (
                    <button
                      className="btn ghost sm danger"
                      onClick={() => onChange(variants.filter((_, i) => i !== index))}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function flatten(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ id: node.id, name: `${"— ".repeat(depth)}${node.name}`, rawName: node.name, depth });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}
