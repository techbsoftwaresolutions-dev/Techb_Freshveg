import DatePicker from "../components/DatePicker";
import Select from "../components/Select";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import FormRoute from "../components/FormRoute";
import { useAuth } from "../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, rupees } from "../components/ui";
import { Affix, FormSection as OfferSection, Segmented, SwitchRow } from "../components/FormKit";

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

// The date-time picker works in "YYYY-MM-DDTHH:mm" in local time, not
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
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = () =>
    api
      .get("/marketing/offers", { limit: 20, page, ...(status ? { status } : {}), ...(kind ? { kind } : {}) })
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
  }, [page, status, kind]);

  async function toggle(offer) {
    setBusyId(offer.id);
    setError("");
    try {
      await api.patch(`/marketing/offers/${offer.id}`, { status: offer.status === "active" ? "paused" : "active" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  if (loading && !items.length && !status && !kind) return <div className="page"><Loading /></div>;

  return (
    <div className="page products-page offers-page">
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

      <div className="toolbar products-filters">
        <div className="chip-row offer-tabs" role="tablist" aria-label="Status">
          {[["", "All"], ["active", "Active"], ["draft", "Draft"], ["paused", "Paused"]].map(([value, label]) => (
            <button key={label} type="button" role="tab" aria-selected={status === value} className={`cat-chip${status === value ? " on" : ""}`} onClick={() => { setStatus(value); setPage(1); }}>
              {label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div className="chip-row offer-tabs" role="tablist" aria-label="Kind">
          {[["", "Any type"], ["offer", "Auto offers"], ["coupon", "Coupons"]].map(([value, label]) => (
            <button key={label} type="button" role="tab" aria-selected={kind === value} className={`cat-chip small${kind === value ? " on" : ""}`} onClick={() => { setKind(value); setPage(1); }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card tight>
        <Table
          title="Offers"
          columns={[
            {
              key: "title",
              label: "Offer",
              render: (row) => (
                <div className="offer-cell">
                  <span className={`offer-icon ${row.type}`}>{OFFER_TYPES.find((t) => t.value === row.type)?.glyph || "%"}</span>
                  <div className="stack">
                    <span className="row-title">
                      {row.title}
                      {row.badge ? <span className="offer-mini-badge">{row.badge}</span> : null}
                    </span>
                    <span className="row-sub">{row.description}</span>
                  </div>
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
              render: (row) => <span className="reward-pill">{describeReward(row)}</span>,
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
              render: (row) => {
                const used = row.limits?.usedCount || 0;
                const cap = row.limits?.totalUses || 0;
                return (
                  <span className="used-cell">
                    <strong>{used}</strong>
                    {cap ? <span className="faint"> / {cap}</span> : null}
                    {cap ? (
                      <span className="level-bar" aria-hidden="true" style={{ width: 70, marginTop: 4 }}>
                        <span className="level-fill" style={{ width: `${Math.min(100, Math.round((used / cap) * 100))}%` }} />
                      </span>
                    ) : null}
                  </span>
                );
              },
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
            ...(editable
              ? [
                  {
                    key: "actions",
                    label: "",
                    align: "right",
                    sortable: false,
                    exportable: false,
                    render: (row) =>
                      row.status === "draft" ? null : (
                        <button
                          type="button"
                          className="btn sm"
                          disabled={busyId === row.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(row);
                          }}
                        >
                          {busyId === row.id ? "…" : row.status === "active" ? "Pause" : "Activate"}
                        </button>
                      ),
                  },
                ]
              : []),
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
    <Field label="Image">
      <div className="offer-image-row">
        {value ? (
          <div className="media-thumb" style={{ width: 96, height: 96 }}>
            <img src={value} alt="" />
          </div>
        ) : (
          <span className="offer-image-empty" aria-hidden="true">No photo</span>
        )}
        <div className="inline" style={{ gap: 10, alignItems: "center" }}>
          <label className="btn sm" style={{ cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "Uploading…" : value ? "Change photo" : "Upload photo"}
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

const OFFER_TYPES = [
  { value: "percentage", glyph: "%", label: "Percentage off" },
  { value: "fixed", glyph: "₹", label: "Fixed amount" },
  { value: "free_delivery", glyph: "→", label: "Free delivery" },
  { value: "bogo", glyph: "2+1", label: "Buy X get Y" },
  { value: "cashback", glyph: "↺", label: "Wallet cashback" },
];

function OfferModal({ value, categories, saving, onClose, onSave }) {
  const [form, setForm] = useState(value);

  const set = (key, next) => setForm((f) => ({ ...f, [key]: next }));
  const setCondition = (key, next) => setForm((f) => ({ ...f, conditions: { ...f.conditions, [key]: next } }));
  const setReward = (key, next) => setForm((f) => ({ ...f, reward: { ...f.reward, [key]: next } }));
  const setSchedule = (key, next) => setForm((f) => ({ ...f, schedule: { ...f.schedule, [key]: next } }));

  const selectedCategories = (form.conditions.categories || []).map((c) => c.id || c);
  const toggleCategory = (id) =>
    setCondition(
      "categories",
      selectedCategories.includes(id) ? selectedCategories.filter((x) => x !== id) : [...selectedCategories, id]
    );

  const rupeeValue = (paise) => (paise ? paise / 100 : "");
  const toPaise = (text) => Math.round(Number(text || 0) * 100);
  const rewardText = describeReward({ type: form.type, reward: form.reward });
  const conditionText = describeConditions({
    conditions: {
      ...form.conditions,
      categories: selectedCategories.map((id) => ({ name: categories.find((c) => c.id === id)?.rawName })),
    },
  });

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
                ...(({ isLive, id: _id, createdAt, updatedAt, ...rest }) => rest)(form),
                ...(form.id ? { id: form.id } : {}),
                conditions: { ...form.conditions, categories: selectedCategories },
                schedule: { ...form.schedule, endsAt: fromLocalInputValue(form.schedule?.endsAt) },
              })
            }
          >
            {saving ? "Saving…" : "Save offer"}
          </button>
        </>
      }
    >
      <div className="offer-layout">
        <div className="offer-main">
          <OfferSection step="1" title="The basics">
            <div className="grid cols-2">
              <Field label="Title">
                <input type="text" autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Weekend Grocery Sale" />
              </Field>
              <Field label="Badge">
                <input type="text" value={form.badge} onChange={(e) => set("badge", e.target.value)} placeholder="e.g. NEW" />
              </Field>
            </div>
            <Field label="Description">
              <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="One line about the offer" />
            </Field>
            <OfferImageField value={form.image || ""} onChange={(url) => set("image", url)} />
          </OfferSection>

          <OfferSection step="2" title="How it applies">
            <Segmented
              value={form.requiresCode ? "coupon" : "auto"}
              onChange={(v) => set("requiresCode", v === "coupon")}
              options={[
                { value: "auto", label: "Automatically" },
                { value: "coupon", label: "Customer enters a code" },
              ]}
            />
            {form.requiresCode ? (
              <Field label="Coupon code">
                <input
                  type="text"
                  className="mono coupon-input"
                  value={form.code}
                  placeholder="e.g. WELCOME50"
                  onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                />
              </Field>
            ) : null}
          </OfferSection>

          <OfferSection step="3" title="Reward">
            <div className="type-grid" role="radiogroup" aria-label="Reward type">
              {OFFER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t.value}
                  className={`type-tile${form.type === t.value ? " on" : ""}`}
                  onClick={() => set("type", t.value)}
                >
                  <span className="type-glyph">{t.glyph}</span>
                  <strong>{t.label}</strong>
                </button>
              ))}
            </div>

            {form.type === "percentage" && (
              <div className="grid cols-2">
                <Field label="Discount">
                  <Affix suffix="%">
                    <input type="number" min="0" max="100" value={form.reward.discountPct || ""} onChange={(e) => setReward("discountPct", Number(e.target.value))} />
                  </Affix>
                </Field>
                <Field label="Maximum discount">
                  <Affix prefix="₹">
                    <input type="number" min="0" value={rupeeValue(form.reward.maxDiscount)} onChange={(e) => setReward("maxDiscount", toPaise(e.target.value))} />
                  </Affix>
                </Field>
              </div>
            )}

            {form.type === "fixed" && (
              <Field label="Discount amount">
                <Affix prefix="₹">
                  <input type="number" min="0" value={rupeeValue(form.reward.discountAmount)} onChange={(e) => setReward("discountAmount", toPaise(e.target.value))} />
                </Affix>
              </Field>
            )}

            {form.type === "bogo" && (
              <div className="grid cols-2">
                <Field label="Buy quantity">
                  <input type="number" min="1" value={form.reward.buyQuantity || 1} onChange={(e) => setReward("buyQuantity", Number(e.target.value))} />
                </Field>
                <Field label="Get free">
                  <input type="number" min="1" value={form.reward.getQuantity || 1} onChange={(e) => setReward("getQuantity", Number(e.target.value))} />
                </Field>
              </div>
            )}

            {form.type === "cashback" && (
              <div className="grid cols-2">
                <Field label="Cashback">
                  <Affix suffix="%">
                    <input type="number" min="0" value={form.reward.cashbackPct || ""} onChange={(e) => setReward("cashbackPct", Number(e.target.value))} />
                  </Affix>
                </Field>
                <Field label="Maximum cashback">
                  <Affix prefix="₹">
                    <input type="number" min="0" value={rupeeValue(form.reward.cashbackMax)} onChange={(e) => setReward("cashbackMax", toPaise(e.target.value))} />
                  </Affix>
                </Field>
              </div>
            )}
          </OfferSection>

          <OfferSection step="4" title="Conditions">
            <Field label="Minimum cart value">
              <Affix prefix="₹">
                <input type="number" min="0" value={rupeeValue(form.conditions.minCartValue)} onChange={(e) => setCondition("minCartValue", toPaise(e.target.value))} placeholder="0" />
              </Affix>
            </Field>
            <Field label="Limit to categories">
              <div className="pick-list">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selectedCategories.includes(c.id)}
                    className={`pick-chip${selectedCategories.includes(c.id) ? " on" : ""}${c.depth ? " sub" : ""}`}
                    onClick={() => toggleCategory(c.id)}
                  >
                    {selectedCategories.includes(c.id) ? "✓ " : ""}
                    {c.rawName}
                  </button>
                ))}
              </div>
            </Field>
            <SwitchRow
              checked={Boolean(form.conditions.firstOrderOnly)}
              onChange={(v) => setCondition("firstOrderOnly", v)}
              title="First order only"
            />
          </OfferSection>

          <OfferSection step="5" title="Publication">
            <Field label="Status">
              <Segmented
                value={form.status}
                onChange={(v) => set("status", v)}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                ]}
              />
            </Field>
            <div className="grid cols-2">
              <Field label="Flash sale ends at">
                <DatePicker withTime value={toLocalInputValue(form.schedule?.endsAt)} onChange={(next) => setSchedule("endsAt", next)} />
              </Field>
              <Field label="Priority">
                <input type="number" value={form.priority} onChange={(e) => set("priority", Number(e.target.value))} />
              </Field>
            </div>
            <SwitchRow
              checked={Boolean(form.combinable)}
              onChange={(v) => set("combinable", v)}
              title="Can combine with other offers"
            />
          </OfferSection>
        </div>

        <aside className="offer-preview" aria-label="Preview">
          <span className="newcat-preview-label">Preview</span>
          <div className="offer-card-preview">
            {form.image ? <div className="offer-card-img" style={{ backgroundImage: `url(${form.image})` }} /> : null}
            <div className="offer-card-body">
              {form.badge ? <span className="offer-card-badge">{form.badge}</span> : null}
              <strong>{form.title.trim() || "Offer title"}</strong>
              <span className="offer-card-desc">{form.description.trim() || "A short line about the offer."}</span>
              <span className="offer-card-reward">{rewardText}</span>
              {form.requiresCode ? <span className="offer-card-code">Use code <b className="mono">{form.code || "CODE"}</b></span> : <span className="offer-card-code">Applied automatically</span>}
            </div>
          </div>
          <ul className="offer-facts">
            <li><span>Applies when</span><b>{conditionText}</b></li>
            <li><span>Status</span><b>{form.status}</b></li>
            <li><span>Stacking</span><b>{form.combinable ? "Combines with others" : "Stands alone"}</b></li>
          </ul>
        </aside>
      </div>
    </Modal>
  );
}

function flatten(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ id: node.id, name: `${"— ".repeat(depth)}${node.name}`, rawName: node.name, depth });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}
