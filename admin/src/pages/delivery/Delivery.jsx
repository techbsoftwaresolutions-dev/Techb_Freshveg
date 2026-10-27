import Select from "../../components/Select";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import {
  Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Stat, Table, Tabs, rupees, when,
} from "../../components/ui";
import DateFilter from "../../components/DateFilter";

export default function Delivery() {
  // The tab lives in the URL, so coming back from a zone or slot page lands
  // on that tab rather than the report.
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "report";
  const setTab = (next) => setParams(next === "report" ? {} : { tab: next }, { replace: true });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Delivery</h1>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: "report", label: "Delivery report" },
          { key: "partners", label: "Partners" },
          { key: "zones", label: "Zones" },
          { key: "slots", label: "Slots" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "report" && <Report />}
      {tab === "partners" && <Partners />}
      {tab === "zones" && <Zones />}
      {tab === "slots" && <Slots />}
    </div>
  );
}

function Report() {
  const [data, setData] = useState({ items: [], meta: null, summary: {} });
  const [range, setRange] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState({ status: "", pincode: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get("/delivery/report", { ...filters, ...range, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters, range]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <Stat label="Runs" value={data.summary?.total ?? 0} />
        <Stat label="Delivered" value={data.summary?.delivered ?? 0} tone="ok" />
        <Stat
          label="Average time"
          value={data.summary?.averageMinutes != null ? `${data.summary.averageMinutes} min` : "—"}
          foot="Assigned to delivered"
        />
        <Stat
          label="On time"
          value={data.summary?.onTimePct != null ? `${data.summary.onTimePct}%` : "—"}
          foot="Against the promise at checkout"
          tone={data.summary?.onTimePct != null && data.summary.onTimePct < 80 ? "danger" : "ok"}
        />
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Pincode"
          value={filters.pincode}
          onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
          style={{ width: 130 }}
        />
        <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All runs</option>
          <option value="DELIVERED">Delivered</option>
          <option value="OUT_FOR_DELIVERY,ARRIVED,PICKED_UP">In progress</option>
          <option value="CANCELLED,REJECTED">Cancelled</option>
        </Select>
        <span className="spacer" />
        <DateFilter value={range} onChange={setRange} />
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Delivery report"
              columns={[
                {
                  key: "code",
                  label: "Order",
                  render: (row) => (
                    <div className="stack">
                      <Link to={`/orders/${row.id}`} className="mono">{row.code}</Link>
                      <span className="row-sub">{row.customer}</span>
                    </div>
                  ),
                },
                { key: "partner", label: "Partner", render: (row) => <span className="muted">{row.partner || "—"}</span> },
                { key: "area", label: "Area", render: (row) => <span className="muted">{row.area || "—"}</span> },
                {
                  key: "assignedAt",
                  label: "Assigned",
                  render: (row) => <span className="muted">{row.assignedAt ? when(row.assignedAt) : "—"}</span>,
                },
                {
                  key: "pickup",
                  label: "At store",
                  align: "right",
                  render: (row) => (row.pickupMinutes != null ? `${row.pickupMinutes}m` : "—"),
                },
                {
                  key: "transit",
                  label: "On the road",
                  align: "right",
                  render: (row) => (row.transitMinutes != null ? `${row.transitMinutes}m` : "—"),
                },
                {
                  key: "total",
                  label: "Total",
                  align: "right",
                  render: (row) =>
                    row.totalMinutes != null ? (
                      <strong style={{ color: row.onTime === false ? "var(--danger)" : undefined }}>
                        {row.totalMinutes}m
                      </strong>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <div className="stack">
                      <Pill tone={row.status === "DELIVERED" ? "ok" : "info"}>
                        {row.status.replace(/_/g, " ").toLowerCase()}
                      </Pill>
                      {row.onTime === false ? <span className="row-sub" style={{ color: "var(--danger)" }}>late</span> : null}
                    </div>
                  ),
                },
              ]}
              rows={data.items}
              empty={<Empty title="No runs in this window" />}
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>
    </>
  );
}

function Partners() {
  const [partners, setPartners] = useState([]);
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/delivery/report/partners", range)
      .then((data) => setPartners(data.partners))
      .catch(() => setPartners([]))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <>
      <div className="toolbar">
        <span className="spacer" />
        <DateFilter value={range} onChange={setRange} />
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <Table
            title="Delivery partners"
            columns={[
              {
                key: "partner",
                label: "Partner",
                render: (row) => (
                  <div className="stack">
                    <span className="row-title">{row.partner?.name || "—"}</span>
                    <span className="row-sub">{row.partner?.phone}</span>
                  </div>
                ),
              },
              { key: "assigned", label: "Assigned", align: "right" },
              { key: "delivered", label: "Delivered", align: "right", render: (row) => <strong>{row.delivered}</strong> },
              {
                key: "cancelled",
                label: "Cancelled",
                align: "right",
                render: (row) => (row.cancelled ? <span style={{ color: "var(--danger)" }}>{row.cancelled}</span> : "—"),
              },
              {
                key: "avg",
                label: "Average run",
                align: "right",
                render: (row) => (row.averageMinutes != null ? `${row.averageMinutes}m` : "—"),
              },
              {
                key: "rating",
                label: "Rating",
                render: (row) =>
                  row.averageRating != null ? (
                    <Pill tone={row.averageRating >= 4 ? "ok" : row.averageRating >= 3 ? "warn" : "danger"}>
                      {row.averageRating} / 5
                    </Pill>
                  ) : (
                    <span className="faint">not rated</span>
                  ),
              },
              { key: "value", label: "Value handled", align: "right", render: (row) => rupees(row.valueHandled) },
            ]}
            rows={partners}
            keyOf={(row) => row.partner?.id || Math.random()}
            empty={<Empty title="No delivery activity yet" />}
          />
        )}
      </Card>
    </>
  );
}

function Zones() {
  // Zones are written through the settings routes, so a store manager reads
  // them but is not offered buttons that would come back 403.
  const { can } = useAuth();
  const canManage = can("settings.manage");

  const [data, setData] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/delivery/zones", { limit: 50 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <span className="spacer" />
        {canManage ? (
          <button className="btn primary" onClick={() => navigate("/delivery/zones/new")}>+ New zone</button>
        ) : null}
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <Table
            title="Delivery zones"
            columns={[
              {
                key: "name",
                label: "Zone",
                render: (row) => (
                  <div className="inline">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: row.colour }} />
                    <span className="row-title">{row.name}</span>
                  </div>
                ),
              },
              { key: "store", label: "Store", render: (row) => <span className="muted">{row.store?.name}</span> },
              {
                key: "covers",
                label: "Covers",
                render: (row) => (
                  <span className="muted">
                    {row.pincodes?.length
                      ? `${row.pincodes.length} pincodes`
                      : row.radiusKm
                        ? `${row.radiusKm} km radius`
                        : row.polygon?.coordinates
                          ? "drawn area"
                          : "—"}
                  </span>
                ),
              },
              { key: "charge", label: "Delivery", align: "right", render: (row) => rupees(row.deliveryCharge) },
              { key: "free", label: "Free above", align: "right", render: (row) => rupees(row.freeDeliveryAbove) },
              {
                key: "extra",
                label: "Extra time",
                align: "right",
                render: (row) => (row.extraMinutes ? `+${row.extraMinutes}m` : "—"),
              },
              {
                key: "status",
                label: "Status",
                render: (row) => <Pill tone={row.status === "active" ? "ok" : "warn"}>{row.status}</Pill>,
              },
            ]}
            rows={data.items}
            onRowClick={canManage ? (row) => navigate(`/delivery/zones/${row.id}`) : undefined}
            empty={
              <Empty
                title="No zones yet"
                hint="Without a zone, the store's own delivery charge applies everywhere it serves."
              />
            }
          />
        )}
      </Card>
    </>
  );
}

// /delivery/zones/new and /delivery/zones/:id — the zone form as a page.
export function ZoneFormPage() {
  return (
    <FormRoute
      backTo="/delivery?tab=zones"
      backLabel="Delivery zones"
      load={async (id) => {
        if (!id) return {};
        const { items } = await api.get("/delivery/zones", { limit: 100 });
        return items.find((z) => z.id === id) || null;
      }}
      render={(zone, back) => <ZoneModal zone={zone} onClose={back} onSaved={back} />}
    />
  );
}

function ZoneModal({ zone, onClose, onSaved }) {
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({
    name: zone.name || "",
    store: zone.store?.id || zone.store || "",
    pincodes: zone.pincodes || [],
    deliveryCharge: (zone.deliveryCharge || 0) / 100,
    freeDeliveryAbove: (zone.freeDeliveryAbove || 0) / 100,
    minOrderValue: (zone.minOrderValue || 0) / 100,
    extraMinutes: zone.extraMinutes || 0,
    codEnabled: zone.codEnabled ?? true,
    status: zone.status || "active",
    priority: zone.priority || 0,
  });
  const [pincodeText, setPincodeText] = useState((zone.pincodes || []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/stores/public").then(({ stores: list }) => {
      setStores(list);
      if (!form.store && list.length) setForm((f) => ({ ...f, store: list[0].id }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setBusy(true);
    setError("");
    const payload = {
      ...form,
      deliveryCharge: Math.round(form.deliveryCharge * 100),
      freeDeliveryAbove: Math.round(form.freeDeliveryAbove * 100),
      minOrderValue: Math.round(form.minOrderValue * 100),
    };
    try {
      if (zone.id) await api.patch(`/delivery/zones/${zone.id}`, payload);
      else await api.post("/delivery/zones", payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={zone.id ? zone.name : "New delivery zone"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !form.name || !form.store} onClick={save}>
            {busy ? "Saving…" : "Save zone"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-2">
        <Field label="Zone name">
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Hosur town centre" />
        </Field>
        <Field label="Store">
          <Select value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })}>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </Select>
        </Field>
      </div>

      {/* The box keeps what was typed and the list is worked out from it —
          filtering the text itself dropped a pincode at its first digit. */}
      <Field
        label="Pincodes"
        help={(() => {
          const bad = pincodeText.split(/[\s,]+/).filter((p) => p && !/^\d{6}$/.test(p));
          return bad.length
            ? `Not 6-digit pincodes, will be ignored: ${bad.join(", ")}`
            : "Separate with commas or new lines. A drawn polygon would take precedence over this.";
        })()}
      >
        <textarea
          value={pincodeText}
          rows={3}
          onChange={(e) => {
            const text = e.target.value;
            setPincodeText(text);
            setForm((f) => ({
              ...f,
              pincodes: [...new Set(text.split(/[\s,]+/).filter((p) => /^\d{6}$/.test(p)))],
            }));
          }}
        />
      </Field>

      <div className="grid cols-3">
        <Field label="Delivery charge (₹)">
          <input type="number" value={form.deliveryCharge} onChange={(e) => setForm({ ...form, deliveryCharge: Number(e.target.value) })} />
        </Field>
        <Field label="Free above (₹)">
          <input type="number" value={form.freeDeliveryAbove} onChange={(e) => setForm({ ...form, freeDeliveryAbove: Number(e.target.value) })} />
        </Field>
        <Field label="Minimum order (₹)">
          <input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="grid cols-3">
        <Field label="Extra minutes">
          <input type="number" value={form.extraMinutes} onChange={(e) => setForm({ ...form, extraMinutes: Number(e.target.value) })} />
        </Field>
        <Field label="Priority">
          <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </Select>
        </Field>
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={form.codEnabled} onChange={(e) => setForm({ ...form, codEnabled: e.target.checked })} />
        Cash on delivery allowed in this zone
      </label>
    </Modal>
  );
}

function Slots() {
  const { can } = useAuth();
  const canManage = can("settings.manage");

  const [slots, setSlots] = useState([]);
  const [stores, setStores] = useState([]);
  const [store, setStore] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/stores/public").then(({ stores: list }) => {
      setStores(list);
      if (list.length) setStore(list[0].id);
    });
  }, []);

  const load = useCallback(() => {
    if (!store) return;
    setLoading(true);
    api
      .get("/delivery/slot-templates", { store })
      .then((data) => setSlots(data.slots))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [store]);

  useEffect(() => {
    load();
  }, [load]);

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <Select value={store} onChange={(e) => setStore(e.target.value)}>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <span className="spacer" />
        {canManage ? (
          <button className="btn primary" onClick={() => navigate(`/delivery/slots/new?store=${store}`)}>+ New slot</button>
        ) : null}
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <Table
            title="Delivery slots"
            columns={[
              {
                key: "label",
                label: "Slot",
                render: (row) => (
                  <div className="stack">
                    <span className="row-title">{row.label}</span>
                    <span className="row-sub">{row.startTime} – {row.endTime}</span>
                  </div>
                ),
              },
              {
                key: "days",
                label: "Days",
                render: (row) => (
                  <span className="muted">
                    {row.daysOfWeek?.length ? row.daysOfWeek.map((d) => DAYS[d]).join(", ") : "Every day"}
                  </span>
                ),
              },
              { key: "capacity", label: "Capacity", align: "right" },
              {
                key: "cutoff",
                label: "Cut-off",
                align: "right",
                render: (row) => `${row.cutoffMinutes}m before`,
              },
              {
                key: "surcharge",
                label: "Surcharge",
                align: "right",
                render: (row) => (row.surcharge ? rupees(row.surcharge) : "—"),
              },
              {
                key: "status",
                label: "Status",
                render: (row) => <Pill tone={row.status === "active" ? "ok" : "warn"}>{row.status}</Pill>,
              },
            ]}
            rows={slots}
            onRowClick={canManage ? (row) => navigate(`/delivery/slots/${row.id}?store=${store}`) : undefined}
            empty={
              <Empty
                title="No delivery windows"
                hint="Without slots, customers get the store's standard prep time instead of a chosen window."
              />
            }
          />
        )}
      </Card>
    </>
  );
}

// /delivery/slots/new and /delivery/slots/:id — the slot form as a page. Slots
// are listed per store, so the store comes along in the query string.
export function SlotFormPage() {
  const [params] = useSearchParams();
  const store = params.get("store") || "";
  return (
    <FormRoute
      backTo="/delivery?tab=slots"
      backLabel="Delivery slots"
      load={async (id) => {
        if (!id) return { store };
        const { slots } = await api.get("/delivery/slot-templates", { store });
        return slots.find((s) => s.id === id) || null;
      }}
      render={(slot, back) => <SlotModal slot={slot} onClose={back} onSaved={back} />}
    />
  );
}

function SlotModal({ slot, onClose, onSaved }) {
  const [form, setForm] = useState({
    store: slot.store?.id || slot.store || "",
    label: slot.label || "",
    startTime: slot.startTime || "09:00",
    endTime: slot.endTime || "12:00",
    daysOfWeek: slot.daysOfWeek || [],
    capacity: slot.capacity ?? 20,
    cutoffMinutes: slot.cutoffMinutes ?? 60,
    surcharge: (slot.surcharge || 0) / 100,
    status: slot.status || "active",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const toggleDay = (day) =>
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day].sort(),
    }));

  async function save() {
    setBusy(true);
    setError("");
    const payload = { ...form, surcharge: Math.round(form.surcharge * 100) };
    try {
      if (slot.id) await api.patch(`/delivery/slot-templates/${slot.id}`, payload);
      else await api.post("/delivery/slot-templates", payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={slot.id ? slot.label : "New delivery slot"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !form.label} onClick={save}>
            {busy ? "Saving…" : "Save slot"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      <Field label="Name">
        <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Morning" />
      </Field>

      <div className="grid cols-2">
        <Field label="From">
          <input type="text" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} placeholder="08:00" />
        </Field>
        <Field label="To">
          <input type="text" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} placeholder="11:00" />
        </Field>
      </div>

      <Field label="Days">
        <div className="inline" style={{ gap: 4 }}>
          {DAYS.map((name, day) => (
            <button
              key={name}
              className={`btn sm${form.daysOfWeek.includes(day) ? " primary" : ""}`}
              onClick={() => toggleDay(day)}
            >
              {name}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid cols-3">
        <Field label="Capacity">
          <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
        </Field>
        <Field label="Cut-off (minutes)">
          <input type="number" value={form.cutoffMinutes} onChange={(e) => setForm({ ...form, cutoffMinutes: Number(e.target.value) })} />
        </Field>
        <Field label="Surcharge (₹)">
          <input type="number" value={form.surcharge} onChange={(e) => setForm({ ...form, surcharge: Number(e.target.value) })} />
        </Field>
      </div>
    </Modal>
  );
}
