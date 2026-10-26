import Select from "../../components/Select";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import {
  Banner, Card, Empty, Loading, Modal, Pagination, Pill, Table, when,
} from "../../components/ui";
import DateFilter from "../../components/DateFilter";

const ACTION_TONE = {
  create: "ok",
  update: "info",
  delete: "danger",
  refund: "warn",
  adjust: "warn",
  moderate: "info",
  resolve: "ok",
  settle: "ok",
  broadcast: "accent",
  approve: "ok",
};

export default function AuditLog() {
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: "", entity: "", action: "", page: 1 });
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(
      () =>
        api
          .get("/audit", { ...filters, ...range, limit: 25 })
          .then(setData)
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false)),
      filters.search ? 250 : 0
    );
    return () => clearTimeout(timer);
  }, [filters, range]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by what changed, who, or which record…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 280 }}
        />
        <Select value={filters.entity} onChange={(e) => set("entity", e.target.value)}>
          <option value="">Everything</option>
          <option value="Product">Products</option>
          <option value="Category">Categories</option>
          <option value="Order">Orders</option>
          <option value="Customer">Customers</option>
          <option value="Offer">Offers</option>
          <option value="Settings">Settings</option>
          <option value="Review">Reviews</option>
          <option value="SupportTicket">Support</option>
          <option value="MaintenanceAsset">Maintenance</option>
        </Select>
        <Select value={filters.action} onChange={(e) => set("action", e.target.value)}>
          <option value="">Any action</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
          <option value="refund">Refunded</option>
          <option value="adjust">Adjusted</option>
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
              title="Audit log"
              columns={[
                { key: "when", label: "When", render: (row) => <span className="muted">{when(row.createdAt)}</span> },
                {
                  key: "actor",
                  label: "Who",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.actorName || "system"}</span>
                      <span className="row-sub">{row.actorRole?.replace(/_/g, " ")}</span>
                    </div>
                  ),
                },
                {
                  key: "action",
                  label: "Action",
                  render: (row) => <Pill tone={ACTION_TONE[row.action]}>{row.action}</Pill>,
                },
                {
                  key: "entity",
                  label: "Record",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.entity}</span>
                      {row.entityLabel ? <span className="row-sub">{row.entityLabel}</span> : null}
                    </div>
                  ),
                },
                {
                  key: "summary",
                  label: "What changed",
                  render: (row) => (
                    <span className="muted" style={{ fontSize: 12.5 }}>{row.summary}</span>
                  ),
                },
                {
                  key: "ip",
                  label: "From",
                  render: (row) => <span className="faint" style={{ fontSize: 11.5 }}>{row.ip || "—"}</span>,
                },
              ]}
              rows={data.items}
              onRowClick={(row) => setDetail(row)}
              empty={
                <Empty
                  title="Nothing recorded in this window"
                  hint="Admin writes are logged as they happen."
                />
              }
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>

      {detail ? <EntryModal entry={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}

function EntryModal({ entry, onClose }) {
  const changes = Object.entries(entry.changes || {});

  return (
    <Modal
      title={
        <div className="inline">
          <h2>{entry.entity}{entry.entityLabel ? ` — ${entry.entityLabel}` : ""}</h2>
          <Pill tone={ACTION_TONE[entry.action]}>{entry.action}</Pill>
        </div>
      }
      onClose={onClose}
      wide
      footer={<button className="btn" onClick={onClose}>Close</button>}
    >
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>WHO</span>
          <strong>{entry.actorName || "system"}</strong>
          <span className="muted">{entry.actorRole?.replace(/_/g, " ")}</span>
        </div>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>WHEN</span>
          <strong>{when(entry.createdAt)}</strong>
        </div>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>FROM</span>
          <strong className="mono">{entry.ip || "—"}</strong>
          <span className="row-sub">{entry.method} {entry.path}</span>
        </div>
      </div>

      <div className="section-label">Summary</div>
      <p style={{ marginTop: 0 }}>{entry.summary}</p>

      {changes.length ? (
        <>
          <div className="section-label">Field changes</div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {changes.map(([field, change]) => (
                  <tr key={field}>
                    <td className="mono" style={{ fontSize: 12.5 }}>{field}</td>
                    <td style={{ color: "var(--danger)" }}>{format(change.from)}</td>
                    <td style={{ color: "var(--ok)" }}>{format(change.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="faint" style={{ fontSize: 13 }}>
          No field-level diff — this was a {entry.action}, not an edit.
        </p>
      )}
    </Modal>
  );
}

function format(value) {
  if (value === null || value === undefined) return <span className="faint">—</span>;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return <span className="mono" style={{ fontSize: 11.5 }}>{JSON.stringify(value)}</span>;
  return String(value);
}
