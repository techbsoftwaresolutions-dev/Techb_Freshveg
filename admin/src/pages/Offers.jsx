import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import FormRoute from "../components/FormRoute";
import DateTimePicker from "../components/DateTimePicker";
import { useAuth } from "../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, rupees } from "../components/ui";

// One screen covers both auto-applied offers and coupons, because the engine
// treats them as one thing — the only difference is whether a code is needed.

const blank = {
  title: "",
  description: "",
  badge: "",
  image: "",
  requiresCode: false,
  code: "",
  type: "percentage",
  conditions: { minCartValue: 0, categories: [], firstOrderOnly: false },
  reward: { discountPct: 0, maxDiscount: 0, discountAmount: 0 },
  schedule: { endsAt: "" },
  status: "draft",
  combinable: false,
  priority: 0,
};

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time, not
// the ISO string the API stores — these two just convert between them.
function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function Offers() {
  const { can } = useAuth();
  const editable = can("marketing.manage");

  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () =>
    api
      .get("/marketing/offers", { limit: 20, page })
      .then((data) => {
        setItems(data.items);
        setMeta(data.meta);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  if (loading) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Offers & Coupons</h1>
        </div>
        {editable && (
          <button className="btn primary" onClick={() => navigate("/marketing/offers/new")}>
            + New offer
          </button>
        )}
      </div>

      <Banner tone="error">{error}</Banner>

      <Card tight>
        <Table
          title="Offers"
          columns={[
            {
              key: "title",
              label: "Offer",
              render: (row) => (
                <div className="stack">
                  <span className="row-title">{row.title}</span>
                  <span className="row-sub">{row.description}</span>
                </div>
              ),
            },
            {
              key: "code",
              label: "Code",
              render: (row) =>
                row.requiresCode ? <span className="tag">{row.code}</span> : <span className="faint">auto</span>,
            },
            {
              key: "type",
              label: "Reward",
              render: (row) => <span className="muted">{describeReward(row)}</span>,
            },
            {
              key: "conditions",
              label: "Applies when",
              render: (row) => <span className="muted">{describeConditions(row)}</span>,
            },
            {
              key: "used",
              label: "Used",
              align: "right",
              render: (row) => (
                <span className="muted">
                  {row.limits?.usedCount || 0}
                  {row.limits?.totalUses ? ` / ${row.limits.totalUses}` : ""}
                </span>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) =>
                row.status !== "active" ? (
                  <Pill tone={row.status === "draft" ? "warn" : undefined}>{row.status}</Pill>
                ) : row.isLive ? (
                  <Pill tone="ok">Running</Pill>
                ) : (
                  // Active but outside its schedule — a weekend coupon on a
                  // Tuesday. Worth showing distinctly, or it looks broken.
                  <Pill tone="info">Scheduled</Pill>
                ),
            },
          ]}
          rows={items}
          onRowClick={editable ? (row) => navigate(`/marketing/offers/${row.id}`) : undefined}
          empty={<Empty title="No offers yet" hint="Create one to start discounting." />}
        />
        <Pagination meta={meta} onPage={setPage} />
      </Card>

    </div>
  );
}

// /marketing/offers/new and /marketing/offers/:id — the offer form as a page.
export function OfferFormPage() {
  return (
    <FormRoute
      backTo="/marketing/offers"
      backLabel="Offers & Coupons"
      load={async (id) => {
        const [list, { tree }] = await Promise.all([
          id ? api.get("/marketing/offers", { limit: 100 }) : Promise.resolve({ items: [] }),
          api.get("/catalog/categories/tree", { status: "active" }),
        ]);
        const offer = id ? list.items.find((o) => o.id === id) : blank;
        return offer ? { value: structuredClone({ ...blank, ...offer }), categories: flatten(tree) } : null;
      }}
      render={({ value, categories }, back, { save, saving }) => (
        <OfferModal
          value={value}
          categories={categories}
          saving={saving}
          onClose={back}
          onSave={(draft) =>
            save(() =>
              draft.id ? api.patch(`/marketing/offers/${draft.id}`, draft) : api.post("/marketing/offers", draft)
            )
          }
        />
      )}
    />
  );
}

// The photo on the offer's card on the storefront homepage. Optional — without
// one the card is text on its tint.
function OfferImageField({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  return (
    <Field label="Image" help="Shown on the right of the offer card on the website homepage. A cut-out photo on a light background works best.">
      {value ? (
        <div className="media-thumb" style={{ width: 96, marginBottom: 10 }}>
          <img src={value} alt="" />
        </div>
      ) : null}
      <div className="inline" style={{ gap: 10, alignItems: "center" }}>
        <label className="btn sm" style={{ cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "none" }}
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploading(true);
              setUploadError("");
              try {
                const result = await api.upload(file, "offers");
                onChange(result.url);
              } catch (err) {
                setUploadError(err.message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        {value ? (
          <button type="button" className="btn sm" onClick={() => onChange("")}>
            Remove
          </button>
        ) : null}
      </div>
      {uploadError ? <span className="field-error" style={{ color: "var(--danger)", fontSize: 12 }}>{uploadError}</span> : null}
    </Field>
  );
}

function describeReward(offer) {
  const r = offer.reward || {};
  switch (offer.type) {
    case "percentage":
      return `${r.discountPct}% off${r.maxDiscount ? ` (max ${rupees(r.maxDiscount)})` : ""}`;
    case "fixed":
      return `${rupees(r.discountAmount)} off`;
    case "free_delivery":
      return "Free delivery";
    case "bogo":
      return `Buy ${r.buyQuantity} get ${r.getQuantity}`;
    case "cashback":
      return `${r.cashbackPct}% cashback`;
    default:
      return offer.type;
  }
}

function describeConditions(offer) {
  const c = offer.conditions || {};
  const parts = [];
  if (c.minCartValue) parts.push(`cart ≥ ${rupees(c.minCartValue)}`);
  if (c.minQuantity) parts.push(`${c.minQuantity}+ items`);
  if (c.categories?.length) parts.push(c.categories.map((x) => x.name || "category").join(", "));
  if (c.firstOrderOnly) parts.push("first order");
  return parts.join(" · ") || "any cart";
}

function OfferModal({ value, categories, saving, onClose, onSave }) {
  const [form, setForm] = useState(value);

  const set = (key, next) => setForm((f) => ({ ...f, [key]: next }));
  const setCondition = (key, next) => setForm((f) => ({ ...f, conditions: { ...f.conditions, [key]: next } }));
  const setReward = (key, next) => setForm((f) => ({ ...f, reward: { ...f.reward, [key]: next } }));
  const setSchedule = (key, next) => setForm((f) => ({ ...f, schedule: { ...f.schedule, [key]: next } }));

  const selectedCategories = (form.conditions.categories || []).map((c) => c.id || c);

  return (
    <Modal
      title={form.id ? form.title : "New offer"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={saving || !form.title.trim() || (form.requiresCode && !form.code.trim())}
            onClick={() =>
              onSave({
                ...form,
                conditions: { ...form.conditions, categories: selectedCategories },
                schedule: { ...form.schedule, endsAt: fromLocalInputValue(form.schedule?.endsAt) },
              })
            }
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid cols-2">
        <Field label="Title">
          <input type="text" autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Badge" help="Short text on the product card, e.g. “20% OFF”.">
          <input type="text" value={form.badge} onChange={(e) => set("badge", e.target.value)} />
        </Field>
      </div>

      <Field label="Description">
        <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)} />
      </Field>

      <OfferImageField value={form.image || ""} onChange={(url) => set("image", url)} />

      <div className="grid cols-2">
        <Field label="How it applies">
          <select
            value={form.requiresCode ? "coupon" : "auto"}
            onChange={(e) => set("requiresCode", e.target.value === "coupon")}
          >
            <option value="auto">Automatically</option>
            <option value="coupon">Customer enters a code</option>
          </select>
        </Field>
        {form.requiresCode && (
          <Field label="Coupon code">
            <input
              type="text"
              className="mono"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
            />
          </Field>
        )}
      </div>

      <div className="section-label">Reward</div>
      <div className="grid cols-3">
        <Field label="Type">
          <select value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="percentage">Percentage off</option>
            <option value="fixed">Fixed amount off</option>
            <option value="free_delivery">Free delivery</option>
            <option value="bogo">Buy X get Y</option>
            <option value="cashback">Wallet cashback</option>
          </select>
        </Field>

        {form.type === "percentage" && (
          <>
            <Field label="Discount %">
              <input
                type="number"
                value={form.reward.discountPct || 0}
                onChange={(e) => setReward("discountPct", Number(e.target.value))}
              />
            </Field>
            <Field label="Max discount ₹" help="Caps the percentage.">
              <input
                type="number"
                value={(form.reward.maxDiscount || 0) / 100}
                onChange={(e) => setReward("maxDiscount", Math.round(Number(e.target.value) * 100))}
              />
            </Field>
          </>
        )}

        {form.type === "fixed" && (
          <Field label="Discount ₹">
            <input
              type="number"
              value={(form.reward.discountAmount || 0) / 100}
              onChange={(e) => setReward("discountAmount", Math.round(Number(e.target.value) * 100))}
            />
          </Field>
        )}

        {form.type === "bogo" && (
          <>
            <Field label="Buy quantity">
              <input
                type="number"
                value={form.reward.buyQuantity || 1}
                onChange={(e) => setReward("buyQuantity", Number(e.target.value))}
              />
            </Field>
            <Field label="Get free">
              <input
                type="number"
                value={form.reward.getQuantity || 1}
                onChange={(e) => setReward("getQuantity", Number(e.target.value))}
              />
            </Field>
          </>
        )}

        {form.type === "cashback" && (
          <>
            <Field label="Cashback %">
              <input
                type="number"
                value={form.reward.cashbackPct || 0}
                onChange={(e) => setReward("cashbackPct", Number(e.target.value))}
              />
            </Field>
            <Field label="Max cashback ₹">
              <input
                type="number"
                value={(form.reward.cashbackMax || 0) / 100}
                onChange={(e) => setReward("cashbackMax", Math.round(Number(e.target.value) * 100))}
              />
            </Field>
          </>
        )}
      </div>

      <div className="section-label">Conditions</div>
      <div className="grid cols-2">
        <Field label="Minimum cart value ₹" help="Measured against the eligible items only.">
          <input
            type="number"
            value={(form.conditions.minCartValue || 0) / 100}
            onChange={(e) => setCondition("minCartValue", Math.round(Number(e.target.value) * 100))}
          />
        </Field>
        <Field label="Limit to categories" help="Includes everything beneath the ones you pick.">
          <select
            multiple
            size={4}
            value={selectedCategories}
            onChange={(e) =>
              setCondition("categories", [...e.target.selectedOptions].map((o) => o.value))
            }
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="checkbox" style={{ marginBottom: 14 }}>
        <input
          type="checkbox"
          checked={Boolean(form.conditions.firstOrderOnly)}
          onChange={(e) => setCondition("firstOrderOnly", e.target.checked)}
        />
        First order only
      </label>

      <div className="section-label">Publication</div>
      <Field
        label="Flash sale ends at"
        help="Optional. Set this to run the offer as a countdown 'Flash Deal' on the homepage — leave it blank for a regular offer with no countdown."
        style={{ marginBottom: 14 }}
      >
        <DateTimePicker
          value={toLocalInputValue(form.schedule?.endsAt)}
          onChange={(next) => setSchedule("endsAt", next)}
          placeholder="No end time — regular offer"
        />
      </Field>
      <div className="grid cols-3">
        <Field label="Status">
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </Field>
        <Field label="Priority" help="Higher wins when two offers clash.">
          <input type="number" value={form.priority} onChange={(e) => set("priority", Number(e.target.value))} />
        </Field>
        <Field label="Stacking">
          <label className="checkbox" style={{ marginTop: 7 }}>
            <input
              type="checkbox"
              checked={Boolean(form.combinable)}
              onChange={(e) => set("combinable", e.target.checked)}
            />
            Can combine with others
          </label>
        </Field>
      </div>
    </Modal>
  );
}

function flatten(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ id: node.id, name: `${"— ".repeat(depth)}${node.name}` });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}
