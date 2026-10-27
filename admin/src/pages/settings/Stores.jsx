import Select from "../../components/Select";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import {
  Banner,
  Card,
  Empty,
  Field,
  Loading,
  Modal,
  Pagination,
  Pill,
  Switch,
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
    <div className="page">
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
                <div className="stack">
                  <span className="row-title">
                    {row.name}{" "}
                    {row.isDefault && <Pill tone="accent">default</Pill>}
                  </span>
                  <span className="row-sub">
                    <span className="tag">{row.code}</span> ·{" "}
                    {row.type.replace(/_/g, " ")}
                  </span>
                </div>
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
                <span className="muted">
                  {row.servicePincodes?.length
                    ? `${row.servicePincodes.length} pincodes`
                    : "—"}
                </span>
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
                      <button
                        type="button"
                        className="btn sm danger"
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
                        {deleting === row.id ? "Deleting…" : "Delete"}
                      </button>
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

function StoreModal({ value, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    ...value,
    servicePincodes: value.servicePincodes || [],
  });
  const [pincodeText, setPincodeText] = useState(
    (value.servicePincodes || []).join(", "),
  );
  const badPincodes = parsePincodes(pincodeText).invalid;
  const setSetting = (key, next) =>
    setForm((f) => ({ ...f, settings: { ...f.settings, [key]: next } }));
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
      <div className="grid cols-2">
        <Field label="Name">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </Select>
        </Field>
      </div>

      {/* The box keeps exactly what was typed; the list is worked out from it.
          Filtering the text itself on every keystroke deleted a pincode the
          moment its first digit went in, so a new one could never be typed. */}
      <Field
        label="Delivery pincodes"
        help={
          badPincodes.length
            ? `Not 6-digit pincodes, will be ignored: ${badPincodes.join(", ")}`
            : undefined
        }
      >
        <textarea
          value={pincodeText}
          rows={3}
          onChange={(e) => {
            const text = e.target.value;
            setPincodeText(text);
            setForm((f) => ({
              ...f,
              servicePincodes: parsePincodes(text).valid,
            }));
          }}
        />
      </Field>

      <div className="section-label">Commercial rules</div>
      <div className="grid cols-3">
        <Field label="Minimum order ₹">
          <input
            type="number"
            value={(form.settings?.minOrderValue || 0) / 100}
            onChange={money("minOrderValue")}
          />
        </Field>
        <Field label="Delivery charge ₹">
          <input
            type="number"
            value={(form.settings?.deliveryCharge || 0) / 100}
            onChange={money("deliveryCharge")}
          />
        </Field>
        <Field label="Packaging charge ₹">
          <input
            type="number"
            value={(form.settings?.packagingCharge || 0) / 100}
            onChange={money("packagingCharge")}
          />
        </Field>
        <Field label="Max COD value ₹">
          <input
            type="number"
            value={(form.settings?.maxCodValue || 0) / 100}
            onChange={money("maxCodValue")}
          />
        </Field>
        <Field label="Prep time (minutes)">
          <input
            type="number"
            value={form.settings?.prepTimeMinutes || 0}
            onChange={(e) =>
              setSetting("prepTimeMinutes", Number(e.target.value))
            }
          />
        </Field>
      </div>

      <Card
        title="Free delivery"
        actions={
          <Switch
            checked={freeOn}
            onChange={(next) => setSetting("freeDeliveryEnabled", next)}
            onLabel="On"
            offLabel="Off"
          />
        }
        className="free-delivery-card"
      >
        <Field label="Minimum order value" error={freeError}>
          <div className="inline" style={{ gap: 6 }}>
            <span className="muted">₹</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              disabled={!freeOn}
              aria-invalid={Boolean(freeError)}
              style={{ maxWidth: 160 }}
            />
          </div>
        </Field>
        {!freeOn ? (
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>
            Free delivery is currently disabled. Customers will not see the
            free-delivery progress card.
          </p>
        ) : null}
      </Card>

      <div className="inline" style={{ marginTop: 14 }}>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.settings?.codEnabled)}
            onChange={(e) => setSetting("codEnabled", e.target.checked)}
          />
          Cash on delivery allowed
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.settings?.acceptingOrders)}
            onChange={(e) => setSetting("acceptingOrders", e.target.checked)}
          />
          Accepting orders
        </label>
      </div>

      <div className="section-label">UPI payment</div>
      <label className="checkbox" style={{ marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={Boolean(form.settings?.upi?.enabled)}
          onChange={(e) => setUpi("enabled", e.target.checked)}
        />
        Show UPI as a payment option at checkout
      </label>
      <div className="grid cols-2">
        <Field label="UPI ID or mobile number" help="">
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
    </Modal>
  );
}
