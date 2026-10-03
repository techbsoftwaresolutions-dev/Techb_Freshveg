import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, rupees } from "../../components/ui";

// Commercial rules are per store — a city branch can carry a higher free
// delivery threshold than a small-town one without any code change.
export default function Stores() {
  const { can } = useAuth();
  const editable = can("settings.manage");

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

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

  if (loading) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Stores</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

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
                    {row.name} {row.isDefault && <Pill tone="accent">default</Pill>}
                  </span>
                  <span className="row-sub">
                    <span className="tag">{row.code}</span> · {row.type.replace(/_/g, " ")}
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
                  {row.servicePincodes?.length ? `${row.servicePincodes.length} pincodes` : "—"}
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
              render: (row) => rupees(row.settings?.freeDeliveryAbove),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <div className="inline" style={{ gap: 4 }}>
                  <Pill tone={row.status === "active" ? "ok" : "warn"}>{row.status}</Pill>
                  {!row.settings?.acceptingOrders && <Pill tone="danger">paused</Pill>}
                </div>
              ),
            },
          ]}
          rows={items}
          onRowClick={editable ? (row) => navigate(`/settings/stores/${row.id}`) : undefined}
          empty={<Empty title="No stores" hint="Seed the backend or create one via the API." />}
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
            save(() =>
              api.patch(`/stores/${draft.id}`, {
                name: draft.name,
                status: draft.status,
                servicePincodes: draft.servicePincodes,
                settings: draft.settings,
              })
            )
          }
        />
      )}
    />
  );
}

// Pincodes from free text: commas, spaces or new lines between them, duplicates
// dropped, anything that is not six digits set aside to be pointed out.
function parsePincodes(text) {
  const parts = text.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
  const valid = [...new Set(parts.filter((p) => /^\d{6}$/.test(p)))];
  const invalid = parts.filter((p) => !/^\d{6}$/.test(p));
  return { valid, invalid };
}

function StoreModal({ value, saving, onClose, onSave }) {
  const [form, setForm] = useState({ ...value, servicePincodes: value.servicePincodes || [] });
  const [pincodeText, setPincodeText] = useState((value.servicePincodes || []).join(", "));
  const badPincodes = parsePincodes(pincodeText).invalid;
  const setSetting = (key, next) => setForm((f) => ({ ...f, settings: { ...f.settings, [key]: next } }));
  const setUpi = (key, next) =>
    setForm((f) => ({ ...f, settings: { ...f.settings, upi: { ...f.settings?.upi, [key]: next } } }));
  const money = (key) => (e) => setSetting(key, Math.round(Number(e.target.value || 0) * 100));

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
          <button className="btn primary" disabled={saving} onClick={() => onSave(form)}>
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid cols-2">
        <Field label="Name">
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
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
            : `${form.servicePincodes.length} pincode${form.servicePincodes.length === 1 ? "" : "s"}. Separate with commas or new lines. A customer outside these cannot check out against this store.`
        }
      >
        <textarea
          value={pincodeText}
          rows={3}
          onChange={(e) => {
            const text = e.target.value;
            setPincodeText(text);
            setForm((f) => ({ ...f, servicePincodes: parsePincodes(text).valid }));
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
        <Field label="Free delivery above ₹">
          <input
            type="number"
            value={(form.settings?.freeDeliveryAbove || 0) / 100}
            onChange={money("freeDeliveryAbove")}
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
            onChange={(e) => setSetting("prepTimeMinutes", Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="inline">
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
      <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>
        Unticking “accepting orders” stops checkout at this store immediately — the kill switch for a
        power cut or a rush.
      </p>

      <div className="section-label">UPI payment</div>
      <p className="faint" style={{ fontSize: 12, marginTop: -8 }}>
        No payment gateway is wired up — this just shows the customer where to pay. Orders are created
        awaiting payment and you confirm them yourself once the money lands.
      </p>
      <label className="checkbox" style={{ marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={Boolean(form.settings?.upi?.enabled)}
          onChange={(e) => setUpi("enabled", e.target.checked)}
        />
        Show UPI as a payment option at checkout
      </label>
      <div className="grid cols-2">
        <Field label="UPI ID or mobile number" help="e.g. yourstore@okaxis or 98765 43210@ybl">
          <input
            type="text"
            value={form.settings?.upi?.vpa || ""}
            onChange={(e) => setUpi("vpa", e.target.value)}
            disabled={!form.settings?.upi?.enabled}
          />
        </Field>
        <Field label="Payee name shown to customer" help="Defaults to the store name if left blank">
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
