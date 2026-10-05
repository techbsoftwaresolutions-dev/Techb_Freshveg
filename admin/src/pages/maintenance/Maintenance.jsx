import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import {
  Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Stat, Table, Tabs, rupees, when,
} from "../../components/ui";

const ASSET_STATUS_TONE = {
  operational: "ok",
  needs_attention: "warn",
  under_repair: "danger",
  retired: undefined,
};

const JOB_STATUS_TONE = {
  open: "warn",
  assigned: "info",
  in_progress: "info",
  on_hold: "warn",
  completed: "ok",
  cancelled: undefined,
};

export default function Maintenance() {
  // In the URL, so coming back from an asset or job page lands on its tab.
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "schedule";
  const setTab = (next) => setParams(next === "schedule" ? {} : { tab: next }, { replace: true });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Maintenance</h1>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: "schedule", label: "Service schedule" },
          { key: "assets", label: "Assets" },
          { key: "jobs", label: "Jobs" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "schedule" && <Schedule />}
      {tab === "assets" && <Assets />}
      {tab === "jobs" && <Jobs />}
    </div>
  );
}

function Schedule() {
  const [data, setData] = useState({ overdue: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/maintenance/schedule", { days: 60 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const columns = [
    {
      key: "name",
      label: "Asset",
      render: (row) => (
        <div className="stack">
          <span className="row-title">{row.name}</span>
          <span className="row-sub">
            <span className="tag">{row.code}</span> · {row.type.replace(/_/g, " ")}
          </span>
        </div>
      ),
    },
    { key: "store", label: "Store", render: (row) => <span className="muted">{row.store?.name}</span> },
    { key: "location", label: "Where", render: (row) => <span className="muted">{row.location || "—"}</span> },
    {
      key: "due",
      label: "Service due",
      render: (row) => {
        const days = Math.ceil((new Date(row.nextServiceDue) - Date.now()) / 86400000);
        return (
          <Pill tone={days < 0 ? "danger" : days <= 7 ? "warn" : undefined}>
            {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Today" : `in ${days} days`}
          </Pill>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Pill tone={ASSET_STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Pill>,
    },
  ];

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <Stat label="Overdue" value={data.overdue.length} tone={data.overdue.length ? "danger" : "ok"} />
        <Stat label="Due in the next 60 days" value={data.upcoming.length} />
      </div>

      {data.overdue.length ? (
        <Card title="Overdue a service" tight className="" >
          <Table title="Overdue maintenance" columns={columns} rows={data.overdue} />
        </Card>
      ) : null}

      <Card title="Coming up" tight style={{ marginTop: 14 }}>
        <Table
          title="Upcoming maintenance"
          columns={columns}
          rows={data.upcoming}
          empty={<Empty title="Nothing due soon" hint="Every asset is inside its service interval." />}
        />
      </Card>
    </>
  );
}

function Assets() {
  const [data, setData] = useState({ items: [], meta: null, summary: {}, types: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/maintenance/assets", { page, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <span className="spacer" />
        <button className="btn primary" onClick={() => navigate("/maintenance/assets/new")}>+ Add asset</button>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Maintenance assets"
              columns={[
                {
                  key: "name",
                  label: "Asset",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.name}</span>
                      <span className="row-sub"><span className="tag">{row.code}</span> · {row.type.replace(/_/g, " ")}</span>
                    </div>
                  ),
                },
                { key: "store", label: "Store", render: (row) => <span className="muted">{row.store?.name}</span> },
                {
                  key: "serviced",
                  label: "Last serviced",
                  render: (row) => <span className="muted">{row.lastServicedOn ? when(row.lastServicedOn) : "Never"}</span>,
                },
                {
                  key: "cost",
                  label: "Lifetime cost",
                  align: "right",
                  render: (row) => rupees(row.lifetimeMaintenanceCost),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Pill tone={ASSET_STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Pill>,
                },
              ]}
              rows={data.items}
              onRowClick={(row) => navigate(`/maintenance/assets/${row.id}`)}
              empty={<Empty title="No assets recorded" hint="Add the freezers, scales and vehicles you want tracked." />}
            />
            <Pagination meta={data.meta} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

// /maintenance/assets/new — the add-asset form as a page. The asset types come
// with the list, so one row of it is read for them.
export function AssetFormPage() {
  return (
    <FormRoute
      backTo="/maintenance?tab=assets"
      backLabel="Assets"
      load={async () => {
        const data = await api.get("/maintenance/assets", { limit: 1 });
        return { types: data.types || [] };
      }}
      render={({ types }, back) => <AssetModal types={types} onClose={back} onSaved={back} />}
    />
  );
}

// /maintenance/assets/:id — an asset's record and service history as a page.
export function AssetDetailPage() {
  return (
    <FormRoute
      backTo="/maintenance?tab=assets"
      backLabel="Assets"
      load={async (id) => (id ? { id } : null)}
      render={({ id }, back) => <AssetDetail id={id} onClose={back} />}
    />
  );
}

// /maintenance/jobs/new — raising a job as a page.
export function JobFormPage() {
  return (
    <FormRoute
      backTo="/maintenance?tab=jobs"
      backLabel="Jobs"
      load={async () => ({})}
      render={(_data, back) => <JobModal onClose={back} onSaved={back} />}
    />
  );
}

function AssetModal({ types, onClose, onSaved }) {
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({ name: "", type: "refrigerator", store: "", location: "", serviceIntervalDays: 90 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/stores/public").then(({ stores: list }) => {
      setStores(list);
      if (list.length) setForm((f) => ({ ...f, store: list[0].id }));
    });
  }, []);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.post("/maintenance/assets", form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add an asset"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !form.name || !form.store} onClick={save}>
            {busy ? "Saving…" : "Add asset"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-2">
        <Field label="Name">
          <input type="text" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Display freezer" />
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {(types || []).map((type) => (
              <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid cols-2">
        <Field label="Store">
          <select value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })}>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </Field>
        <Field label="Where in the store">
          <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Back room" />
        </Field>
      </div>

      <Field label="Service every (days)" help="The schedule is driven off this and the last service date.">
        <input
          type="number"
          value={form.serviceIntervalDays}
          onChange={(e) => setForm({ ...form, serviceIntervalDays: Number(e.target.value) })}
        />
      </Field>
    </Modal>
  );
}

function AssetDetail({ id, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/maintenance/assets/${id}`).then(setData).catch(() => {});
  }, [id]);

  if (!data) {
    return <Modal title="Asset" onClose={onClose} wide><Loading /></Modal>;
  }

  const { asset, requests, totals } = data;

  return (
    <Modal
      title={
        <div className="inline">
          <h2>{asset.name}</h2>
          <span className="tag">{asset.code}</span>
          <Pill tone={ASSET_STATUS_TONE[asset.status]}>{asset.status.replace(/_/g, " ")}</Pill>
        </div>
      }
      onClose={onClose}
      wide
      footer={<button className="btn" onClick={onClose}>Close</button>}
    >
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Jobs" value={totals.jobs} />
        <Stat label="Cost of ownership" value={rupees(totals.cost)} />
        <Stat label="Downtime" value={`${Math.round(totals.downtimeMinutes / 60)}h`} />
        <Stat
          label="Next service"
          value={asset.nextServiceDue ? new Date(asset.nextServiceDue).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
        />
      </div>

      <div className="section-label">Service history</div>
      <Table
        title="Service history"
        columns={[
          { key: "code", label: "Job", render: (row) => <span className="mono">{row.code}</span> },
          { key: "title", label: "What happened", render: (row) => (
            <div className="stack">
              <span className="row-title">{row.title}</span>
              <span className="row-sub">{row.resolutionNote || row.type}</span>
            </div>
          ) },
          { key: "technician", label: "Technician", render: (row) => <span className="muted">{row.technician?.name || "—"}</span> },
          { key: "cost", label: "Cost", align: "right", render: (row) => rupees(row.totalCost) },
          { key: "status", label: "Status", render: (row) => <Pill tone={JOB_STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Pill> },
          { key: "when", label: "Completed", render: (row) => <span className="muted">{row.completedAt ? when(row.completedAt) : "—"}</span> },
        ]}
        rows={requests}
        empty={<Empty title="No jobs yet" hint="This asset has never needed work." />}
      />
    </Modal>
  );
}

function Jobs() {
  const [data, setData] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [openOnly, setOpenOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/maintenance/requests", { page, limit: 20, ...(openOnly ? { open: "true" } : {}) })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, openOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(job, status) {
    setBusy(job.id);
    try {
      await api.patch(`/maintenance/requests/${job.id}`, { status });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <label className="checkbox">
          <input type="checkbox" checked={openOnly} onChange={(e) => { setOpenOnly(e.target.checked); setPage(1); }} />
          Open jobs only
        </label>
        <span className="spacer" />
        <button className="btn primary" onClick={() => navigate("/maintenance/jobs/new")}>+ Raise a job</button>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Maintenance jobs"
              columns={[
                {
                  key: "title",
                  label: "Job",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.title}</span>
                      <span className="row-sub"><span className="tag">{row.code}</span> · {row.assetName}</span>
                    </div>
                  ),
                },
                { key: "type", label: "Type", render: (row) => <span className="muted">{row.type}</span> },
                {
                  key: "priority",
                  label: "Priority",
                  render: (row) => (
                    <Pill tone={row.priority === "critical" ? "danger" : row.priority === "high" ? "warn" : undefined}>
                      {row.priority}
                    </Pill>
                  ),
                },
                { key: "cost", label: "Cost", align: "right", render: (row) => rupees(row.totalCost) },
                { key: "status", label: "Status", render: (row) => <Pill tone={JOB_STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Pill> },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: (row) =>
                    ["completed", "cancelled"].includes(row.status) ? null : (
                      <div className="inline" style={{ justifyContent: "flex-end", gap: 6 }}>
                        {row.status === "open" ? (
                          <button className="btn sm" disabled={busy === row.id} onClick={() => advance(row, "in_progress")}>
                            Start
                          </button>
                        ) : null}
                        <button className="btn sm primary" disabled={busy === row.id} onClick={() => advance(row, "completed")}>
                          Complete
                        </button>
                      </div>
                    ),
                },
              ]}
              rows={data.items}
              empty={<Empty title="No open jobs" hint="Nothing is waiting to be fixed." />}
            />
            <Pagination meta={data.meta} onPage={setPage} />
          </>
        )}
      </Card>

    </>
  );
}

function JobModal({ onClose, onSaved }) {
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({
    asset: "", type: "breakdown", priority: "normal", title: "", description: "",
    labourCost: 0, partsUsed: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/maintenance/assets", { limit: 100 }).then((data) => {
      setAssets(data.items);
      if (data.items.length) setForm((f) => ({ ...f, asset: data.items[0].id }));
    });
  }, []);

  const partsTotal = form.partsUsed.reduce((sum, p) => sum + (p.unitCost || 0) * (p.quantity || 0), 0);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.post("/maintenance/requests", {
        ...form,
        labourCost: Math.round(form.labourCost * 100),
        partsUsed: form.partsUsed.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          unitCost: Math.round(p.unitCost * 100),
          total: Math.round(p.unitCost * 100 * p.quantity),
        })),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Raise a maintenance job"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !form.title || !form.asset} onClick={save}>
            {busy ? "Saving…" : "Raise job"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-2">
        <Field label="Asset">
          <select value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })}>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name} ({asset.code})</option>
            ))}
          </select>
        </Field>
        <Field label="What is it">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="breakdown">Breakdown</option>
            <option value="scheduled">Scheduled service</option>
            <option value="inspection">Inspection</option>
            <option value="installation">Installation</option>
          </select>
        </Field>
      </div>

      <div className="grid cols-2">
        <Field label="Title">
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Not holding temperature" />
        </Field>
        <Field label="Priority">
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
      </div>

      <Field label="Details">
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>

      <div className="section-label">Parts used</div>
      {form.partsUsed.map((part, index) => (
        <div key={index} className="inline" style={{ marginBottom: 8, flexWrap: "nowrap" }}>
          <input
            type="text"
            placeholder="Part"
            value={part.name}
            onChange={(e) => {
              const parts = [...form.partsUsed];
              parts[index] = { ...part, name: e.target.value };
              setForm({ ...form, partsUsed: parts });
            }}
          />
          <input
            type="number"
            placeholder="Qty"
            style={{ width: 80 }}
            value={part.quantity}
            onChange={(e) => {
              const parts = [...form.partsUsed];
              parts[index] = { ...part, quantity: Number(e.target.value) };
              setForm({ ...form, partsUsed: parts });
            }}
          />
          <input
            type="number"
            placeholder="₹ each"
            style={{ width: 110 }}
            value={part.unitCost}
            onChange={(e) => {
              const parts = [...form.partsUsed];
              parts[index] = { ...part, unitCost: Number(e.target.value) };
              setForm({ ...form, partsUsed: parts });
            }}
          />
          <button
            className="btn ghost sm danger"
            onClick={() => setForm({ ...form, partsUsed: form.partsUsed.filter((_, i) => i !== index) })}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="btn sm"
        onClick={() => setForm({ ...form, partsUsed: [...form.partsUsed, { name: "", quantity: 1, unitCost: 0 }] })}
      >
        + Add part
      </button>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Field label="Labour cost (₹)">
          <input type="number" value={form.labourCost} onChange={(e) => setForm({ ...form, labourCost: Number(e.target.value) })} />
        </Field>
        <Field label="Total" help="Parts plus labour — computed, not entered twice.">
          <input type="text" value={`₹${(partsTotal + Number(form.labourCost)).toFixed(2)}`} disabled />
        </Field>
      </div>
    </Modal>
  );
}
