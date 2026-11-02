import Select from "../../components/Select";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import SelectMenu from "../../components/SelectMenu";
import { useAuth } from "../../context/AuthContext";
import { Affix, FormSection, SwitchRow } from "../../components/FormKit";
import { Avatar } from "../orders/Orders";
import {
  Banner,
  Card,
  Empty,
  Field,
  Loading,
  Modal,
  Pagination,
  Pill,
  Table,
  rupees,
  useConfirm,
} from "../../components/ui";

// Commercial rules are per store — a city branch can carry a higher free
// delivery threshold than a small-town one without any code change.
export default function Stores() {
  const [confirm, confirmDialog] = useConfirm();
  const { can } = useAuth();
  const editable = can("settings.manage");

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState("");
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();
  // A save returns here as ?saved=<store name>, which is the confirmation.
  const [params] = useSearchParams();
  const saved = params.get("saved");

  useEffect(() => {
    setLoading(true);
    api
      .get("/stores", { limit: 20, page })
      .then((data) => {
        setItems(data.items);
        setMeta(data.meta);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  // The API refuses when deleting would lose history or widen a rule (orders
  // on record, the default store, staff or offers tied to it alone) and says
  // why; that reason is shown as it comes.
  async function removeStore(store) {
    if (
      !(await confirm({
        title: "Delete store?",
        message: `Delete "${store.name}"? Its stock, delivery zones and slots go with it. This can't be undone.`,
        confirmLabel: "Yes, delete",
      }))
    )
      return;
    setDeleting(store.id);
    setError("");
    setDeleted("");
    try {
      await api.delete(`/stores/${store.id}`);
      setItems((list) => list.filter((s) => s.id !== store.id));
      setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
      setDeleted(store.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  if (loading)
    return (
      <div className="page">
        <Loading />
      </div>
    );

  return (
    <div className="page products-page stores-page">
      {confirmDialog}
      <div className="page-head">
        <div>
          <h1>Stores</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">
        {deleted ? `${deleted} deleted.` : saved ? `${saved} saved.` : ""}
      </Banner>

      <Card tight>
        <Table
          title="Stores"
          columns={[
            {
              key: "name",
              label: "Store",
              render: (row) => (
                <span className="person-cell">
                  <Avatar name={row.name} size={42} />
                  <span className="stack">
                    <span className="row-title">
                      {row.name}{" "}
                      {row.isDefault && <Pill tone="accent">default</Pill>}
                    </span>
                    <span className="row-sub">
                      <span className="tag">{row.code}</span> ·{" "}
                      {row.type.replace(/_/g, " ")}
                    </span>
                  </span>
                </span>
              ),
            },
            {
              key: "address",
              label: "Location",
              render: (row) => (
                <span className="muted">
                  {row.address?.city} {row.address?.pincode}
                </span>
              ),
            },
            {
              key: "pincodes",
              label: "Delivers to",
              render: (row) => (
                row.servicePincodes?.length ? (
                  <span className="reward-pill">{row.servicePincodes.length} pincodes</span>
                ) : (
                  <span className="faint">—</span>
                )
              ),
            },
            {
              key: "minOrder",
              label: "Min order",
              align: "right",
              render: (row) => rupees(row.settings?.minOrderValue),
            },
            {
              key: "freeDelivery",
              label: "Free above",
              align: "right",
              render: (row) =>
                row.settings?.freeDeliveryEnabled === false ||
                !row.settings?.freeDeliveryAbove
                  ? "Off"
                  : rupees(row.settings.freeDeliveryAbove),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <div className="inline" style={{ gap: 4 }}>
                  <Pill tone={row.status === "active" ? "ok" : "warn"}>
                    {row.status}
                  </Pill>
                  {!row.settings?.acceptingOrders && (
                    <Pill tone="danger">paused</Pill>
                  )}
                </div>
              ),
            },
            ...(editable
              ? [
                  {
                    key: "actions",
                    label: "",
                    align: "right",
                    render: (row) => (
                      <span className="inline" style={{ gap: 2, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <button
                        type="button"
                        className="icon-edit"
                        title={`Edit ${row.name}`}
                        aria-label={`Edit ${row.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/settings/stores/${row.id}`);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" /></svg>
                      </button>
                      <button
                        type="button"
                        className="icon-delete"
                        aria-label={`Delete ${row.name}`}
                        disabled={row.isDefault || deleting === row.id}
                        title={
                          row.isDefault
                            ? "The default store can't be deleted"
                            : undefined
                        }
                        onClick={(event) => {
                          event.stopPropagation(); // the row itself opens the store
                          removeStore(row);
                        }}
                      >
                        {deleting === row.id ? "…" : (
                          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
                        )}
                      </button>
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
          rows={items}
          onRowClick={
            editable
              ? (row) => navigate(`/settings/stores/${row.id}`)
              : undefined
          }
          empty={
            <Empty
              title="No stores"
              hint="Seed the backend or create one via the API."
            />
          }
        />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </div>
  );
}

// /settings/stores/:id — the store's settings as a page.
export function StoreFormPage() {
  return (
    <FormRoute
      backTo="/settings/stores"
      backLabel="Stores"
      load={async (id) => {
        if (!id) return null; // stores are created by the setup, not here
        const { items } = await api.get("/stores", { limit: 50 });
        const store = items.find((s) => s.id === id);
        return store ? structuredClone(store) : null;
      }}
      render={(store, back, { save, saving }) => (
        <StoreModal
          value={store}
          saving={saving}
          onClose={back}
          onSave={(draft) =>
            save(async () => {
              await api.patch(`/stores/${draft.id}`, {
                name: draft.name,
                status: draft.status,
                servicePincodes: draft.servicePincodes,
                settings: draft.settings,
              });
              return `/settings/stores?saved=${encodeURIComponent(draft.name)}`;
            })
          }
        />
      )}
    />
  );
}

// Pincodes from free text: commas, spaces or new lines between them, duplicates
// dropped, anything that is not six digits set aside to be pointed out.
function parsePincodes(text) {
  const parts = text
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const valid = [...new Set(parts.filter((p) => /^\d{6}$/.test(p)))];
  const invalid = parts.filter((p) => !/^\d{6}$/.test(p));
  return { valid, invalid };
}

const DEFAULT_DELIVERY_TIMES = [
  { value: "15m", label: "15 min", minutes: 15 },
  { value: "30m", label: "30 min", minutes: 30 },
  { value: "1h", label: "1 hour", minutes: 60 },
  { value: "next_day", label: "Next day", minutes: 1440 },
];

// The standard choices plus the ones this store added, shortest first.
function deliveryOptions(settings = {}) {
  const custom = (settings.deliveryTimeOptions || []).map((o) => ({
    value: o.key,
    label: o.label,
    minutes: o.minutes,
    at: o.at,
    plain: o.plain,
    custom: true,
  }));
  const rank = (o) => (o.plain ? 100000 : o.minutes);
  return [...DEFAULT_DELIVERY_TIMES, ...custom].sort((x, y) => rank(x) - rank(y));
}

// Stores saved before this choice existed only have a number of minutes.
function deliveryTimeOf(settings = {}) {
  const options = deliveryOptions(settings);
  if (options.some((o) => o.value === settings.deliveryTime)) return settings.deliveryTime;
  const minutes = Number(settings.prepTimeMinutes) || 30;
  return (options.find((o) => !o.custom && o.minutes >= minutes) || options[options.length - 1]).value;
}

const UNIT_MINUTES = { min: 1, hour: 60, day: 1440 };

// "19:00" -> "7:00 pm"
const clock12 = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
// Every half hour of the day, plus the saved time when it falls between.
const timeChoices = (current) => {
  const list = [];
  for (let i = 0; i < 48; i += 1) list.push(`${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  if (current && !list.includes(current)) list.push(current);
  return list.sort().map((v) => ({ value: v, label: clock12(v) }));
};

function StoreModal({ value, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    ...value,
    servicePincodes: value.servicePincodes || [],
  });
  const [pinOpen, setPinOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [areaInput, setAreaInput] = useState("");
  const badPincodes = parsePincodes(pinInput).invalid;
  // An area is a named place inside a pincode ("NGGO Colony" in 635109);
  // several areas can share one pincode.
  const areaEntries = form.pincodeAreas || [];
  const areasOf = (code) => areaEntries.filter((r) => r.pincode === code).map((r) => r.area);
  function addPincodes() {
    const { valid, invalid } = parsePincodes(pinInput);
    if (!valid.length) return;
    const area = areaInput.trim().slice(0, 40);
    setForm((f) => {
      const have = f.pincodeAreas || [];
      const added = area
        ? valid
            .filter((code) => !have.some((r) => r.pincode === code && r.area.toLowerCase() === area.toLowerCase()))
            .map((code) => ({ pincode: code, area }))
        : [];
      return {
        ...f,
        servicePincodes: [...new Set([...(f.servicePincodes || []), ...valid])],
        pincodeAreas: [...have, ...added],
      };
    });
    // Anything that was not a 6-digit pincode stays in the box to be fixed.
    setPinInput(invalid.join(", "));
    setAreaInput("");
  }
  const removePincode = (code) =>
    setForm((f) => ({
      ...f,
      servicePincodes: f.servicePincodes.filter((c) => c !== code),
      pincodeAreas: (f.pincodeAreas || []).filter((r) => r.pincode !== code),
    }));
  const removeArea = (entry) =>
    setForm((f) => ({
      ...f,
      pincodeAreas: (f.pincodeAreas || []).filter((r) => !(r.pincode === entry.pincode && r.area === entry.area)),
    }));
  const setSetting = (key, next) =>
    setForm((f) => ({ ...f, settings: { ...f.settings, [key]: next } }));
  // Typed inside the Delivery time dropdown: "2 hours" / "45 min" become a
  // length of time, anything else ("Next morning", "Evening") is kept as the
  // name the customer sees.
  function addDeliveryTime(text) {
    const typed = String(text || "").trim().replace(/\s+/g, " ").slice(0, 24);
    if (!typed) return;
    const m = typed.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i);
    let option;
    if (m) {
      const n = Number(m[1]);
      const u = m[2].toLowerCase()[0];
      const minutes = Math.round(n * (u === "m" ? 1 : u === "h" ? 60 : 1440));
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 14400) return;
      const unit = u === "m" ? "min" : u === "h" ? (n === 1 ? "hour" : "hours") : n === 1 ? "day" : "days";
      option = { key: `c${minutes}`, label: `${n} ${unit}`, minutes };
    } else {
      const slug = typed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) return;
      option = { key: `t${slug}`, label: typed[0].toUpperCase() + typed.slice(1), plain: true, minutes: 0 };
    }
    setForm((f) => {
      const have = deliveryOptions(f.settings).find((o) => o.value === option.key || (!option.plain && !o.at && !o.plain && o.minutes === option.minutes));
      if (have) return { ...f, settings: { ...f.settings, deliveryTime: have.value, prepTimeMinutes: have.minutes || f.settings?.prepTimeMinutes } };
      return {
        ...f,
        settings: {
          ...f.settings,
          deliveryTimeOptions: [...(f.settings?.deliveryTimeOptions || []), option],
          deliveryTime: option.key,
          prepTimeMinutes: option.plain ? 1440 : option.minutes,
        },
      };
    });
  }
  function removeDeliveryTime(key) {
    setForm((f) => {
      const left = (f.settings?.deliveryTimeOptions || []).filter((o) => o.key !== key);
      const picked = f.settings?.deliveryTime === key;
      return {
        ...f,
        settings: {
          ...f.settings,
          deliveryTimeOptions: left,
          ...(picked ? { deliveryTime: "30m", prepTimeMinutes: 30 } : {}),
        },
      };
    });
  }
  const setUpi = (key, next) =>
    setForm((f) => ({
      ...f,
      settings: { ...f.settings, upi: { ...f.settings?.upi, [key]: next } },
    }));
  const money = (key) => (e) =>
    setSetting(key, Math.round(Number(e.target.value || 0) * 100));

  // Free delivery. A store saved before the switch existed with no amount
  // means "no free delivery", so it opens switched off rather than invalid.
  const storedAmount = form.settings?.freeDeliveryAbove || 0;
  const freeOn =
    form.settings?.freeDeliveryEnabled === true ||
    (form.settings?.freeDeliveryEnabled !== false && storedAmount > 0);
  const [freeText, setFreeText] = useState(
    storedAmount ? String(storedAmount / 100) : "",
  );
  const freeAmount = Number(freeText);
  // Rupees with at most paise: ₹399.50 is fine, ₹399.555 is not.
  const freeError = !freeOn
    ? ""
    : freeText.trim() === "" || !Number.isFinite(freeAmount)
      ? "Enter the minimum order value."
      : freeAmount <= 0
        ? "Must be more than ₹0."
        : Math.round(freeAmount * 100) !== Number((freeAmount * 100).toFixed(4))
          ? "Use at most two decimal places."
          : "";
  const submit = () =>
    onSave({
      ...form,
      settings: {
        ...form.settings,
        freeDeliveryEnabled: freeOn,
        // Kept while switched off so turning it back on needs no retyping.
        freeDeliveryAbove:
          freeError || freeText.trim() === ""
            ? storedAmount
            : Math.round(freeAmount * 100),
      },
    });

  return (
    <Modal
      title={form.name}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={saving || Boolean(freeError)}
            onClick={submit}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="offer-layout">
        <div className="offer-main">
          <FormSection step="1" title="Store details">
            <div className="grid cols-2">
              <Field label="Name">
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Status">
                <SelectMenu
                  value={form.status}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                    { value: "closed", label: "Closed" },
                  ]}
                />
              </Field>
            </div>

            <Field label="Delivery pincodes">
              <div className={`pin-dd${pinOpen ? " open" : ""}`}>
                <button type="button" className="pin-dd-trigger" aria-expanded={pinOpen} onClick={() => setPinOpen((o) => !o)}>
                  <span className="pin-dd-value">
                    {form.servicePincodes.length
                      ? form.servicePincodes.map((c) => (areasOf(c).length ? `${c} (${areasOf(c).join(", ")})` : c)).join(", ")
                      : "No pincodes yet"}
                  </span>
                  <svg className="pin-dd-chevron" viewBox="0 0 10 10" width="12" height="12" fill="none" aria-hidden="true">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {pinOpen ? (
                  <div className="pin-dd-panel">
                    <div className="pin-dd-add">
                      <input
                        className="pin-area-input"
                        type="text"
                        maxLength={40}
                        value={areaInput}
                        placeholder="Area name, e.g. NGGO Colony"
                        onChange={(e) => setAreaInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPincodes();
                          }
                        }}
                        aria-label="Area name"
                      />
                      <input
                        className="pin-code-input"
                        type="text"
                        inputMode="numeric"
                        value={pinInput}
                        placeholder="Pincode"
                        onChange={(e) => setPinInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPincodes();
                          }
                        }}
                        aria-label="Pincode"
                      />
                      <button type="button" className="btn sm primary" disabled={!parsePincodes(pinInput).valid.length} onClick={addPincodes}>
                        Add
                      </button>
                    </div>
                    {badPincodes.length ? (
                      <span className="error">Not 6-digit pincodes: {badPincodes.join(", ")}</span>
                    ) : null}
                    {form.servicePincodes.length ? (
                      <div className="pin-areas">
                        {areaEntries
                          .filter((r) => form.servicePincodes.includes(r.pincode))
                          .map((entry) => (
                            <div key={`${entry.pincode}:${entry.area}`} className="pin-area-row">
                              <strong className="pin-area-name">{entry.area}</strong>
                              <span className="pick-chip on static pin-chip">{entry.pincode}</span>
                              <button type="button" className="pin-area-remove" aria-label={`Remove ${entry.area}`} onClick={() => removeArea(entry)}>
                                ×
                              </button>
                            </div>
                          ))}
                        {form.servicePincodes
                          .filter((code) => !areasOf(code).length)
                          .map((code) => (
                            <div key={code} className="pin-area-row">
                              <span className="pin-area-name muted">Whole pincode</span>
                              <span className="pick-chip on static pin-chip">{code}</span>
                              <button type="button" className="pin-area-remove" aria-label={`Remove ${code}`} onClick={() => removePincode(code)}>
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Field>
          </FormSection>

          <FormSection step="2" title="Charges & limits">
            <div className="grid cols-3">
              <Field label="Minimum order">
                <Affix prefix="₹">
                  <input type="number" min="0" value={(form.settings?.minOrderValue || 0) / 100} onChange={money("minOrderValue")} />
                </Affix>
              </Field>
              <Field label="Delivery charge">
                <Affix prefix="₹">
                  <input type="number" min="0" value={(form.settings?.deliveryCharge || 0) / 100} onChange={money("deliveryCharge")} />
                </Affix>
              </Field>
              <Field label="Packaging charge">
                <Affix prefix="₹">
                  <input type="number" min="0" value={(form.settings?.packagingCharge || 0) / 100} onChange={money("packagingCharge")} />
                </Affix>
              </Field>
              <Field label="Max COD value">
                <Affix prefix="₹">
                  <input type="number" min="0" value={(form.settings?.maxCodValue || 0) / 100} onChange={money("maxCodValue")} />
                </Affix>
              </Field>
              <Field label="Delivery time">
                <SelectMenu
                  value={deliveryTimeOf(form.settings)}
                  onChange={(next) => {
                    const option = deliveryOptions(form.settings).find((o) => o.value === next);
                    setForm((f) => ({
                      ...f,
                      settings: { ...f.settings, deliveryTime: next, prepTimeMinutes: option?.plain ? 1440 : option?.minutes || f.settings?.prepTimeMinutes },
                    }));
                  }}
                  options={deliveryOptions(form.settings).map((o) => ({ value: o.value, label: o.label, removable: o.custom }))}
                  onAdd={addDeliveryTime}
                  addPlaceholder="Add new… e.g. Next morning"
                  onRemove={removeDeliveryTime}
                />
              </Field>
              <Field label="Order cut-off">
                <SelectMenu
                  value={form.settings?.orderCutoff || "19:00"}
                  onChange={(next) => setSetting("orderCutoff", next)}
                  options={timeChoices(form.settings?.orderCutoff || "19:00")}
                  searchable={false}
                />
              </Field>
              <Field label="Next-morning delivery">
                <SelectMenu
                  value={form.settings?.morningDelivery || "07:00"}
                  onChange={(next) => setSetting("morningDelivery", next)}
                  options={timeChoices(form.settings?.morningDelivery || "07:00")}
                  searchable={false}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection step="3" title="Free delivery">
            <SwitchRow
              checked={freeOn}
              onChange={(next) => setSetting("freeDeliveryEnabled", next)}
              title={freeOn ? "Free delivery is on" : "Free delivery is off"}
            />
            <Field label="Minimum order value" error={freeError}>
              <Affix prefix="₹">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  disabled={!freeOn}
                  aria-invalid={Boolean(freeError)}
                />
              </Affix>
            </Field>
          </FormSection>

          <FormSection step="4" title="Orders & payments">
            <SwitchRow
              checked={Boolean(form.settings?.acceptingOrders)}
              onChange={(v) => setSetting("acceptingOrders", v)}
              title="Accepting orders"
            />
            <SwitchRow
              checked={Boolean(form.settings?.codEnabled)}
              onChange={(v) => setSetting("codEnabled", v)}
              title="Cash on delivery allowed"
            />
            <SwitchRow
              checked={Boolean(form.settings?.upi?.enabled)}
              onChange={(v) => setUpi("enabled", v)}
              title="Show UPI as a payment option at checkout"
            />
            <div className="grid cols-2">
              <Field label="UPI ID or mobile number">
                <input
                  type="text"
                  value={form.settings?.upi?.vpa || ""}
                  onChange={(e) => setUpi("vpa", e.target.value)}
                  disabled={!form.settings?.upi?.enabled}
                />
              </Field>
              <Field label="Payee name shown to customer">
                <input
                  type="text"
                  value={form.settings?.upi?.payeeName || ""}
                  onChange={(e) => setUpi("payeeName", e.target.value)}
                  disabled={!form.settings?.upi?.enabled}
                />
              </Field>
            </div>
          </FormSection>
        </div>

        <aside className="offer-preview" aria-label="Summary">
          <span className="newcat-preview-label">Summary</span>
          <div className="newcat-tile">
            <Avatar name={form.name} size={72} />
            <strong>{form.name || "Store name"}</strong>
            <span className="newcat-where">{form.status}</span>
            {form.code ? <span className="tag">{form.code}</span> : null}
          </div>
          <ul className="offer-facts">
            <li><span>Delivers to</span><b>{form.servicePincodes.length} pincodes</b></li>
            <li><span>Minimum order</span><b>{rupees(form.settings?.minOrderValue || 0)}</b></li>
            <li><span>Delivery charge</span><b>{rupees(form.settings?.deliveryCharge || 0)}</b></li>
            <li><span>Delivery time</span><b>{deliveryOptions(form.settings).find((o) => o.value === deliveryTimeOf(form.settings))?.label}</b></li>
            <li><span>After-hours orders</span><b>After {clock12(form.settings?.orderCutoff || "19:00")} → {clock12(form.settings?.morningDelivery || "07:00")}</b></li>
            <li><span>Free delivery</span><b>{freeOn && freeAmount > 0 ? `Above ₹${freeAmount}` : "Off"}</b></li>
            <li><span>Cash on delivery</span><b>{form.settings?.codEnabled ? "Allowed" : "Off"}</b></li>
            <li><span>UPI</span><b>{form.settings?.upi?.enabled ? "On" : "Off"}</b></li>
            <li><span>Orders</span><b>{form.settings?.acceptingOrders ? "Accepting" : "Paused"}</b></li>
          </ul>
        </aside>
      </div>
    </Modal>
  );
}
