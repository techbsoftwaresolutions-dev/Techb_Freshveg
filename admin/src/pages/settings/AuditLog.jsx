import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { Avatar } from "../orders/Orders";
import {
  Banner, Card, Empty, Loading, Modal, Pagination, Pill, Table, when,
} from "../../components/ui";
import DateFilter, { todayRange } from "../../components/DateFilter";

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

const ENTITIES = [
  ["", "Everything"],
  ["Product", "Products"],
  ["Category", "Categories"],
  ["Order", "Orders"],
  ["Customer", "Customers"],
  ["Offer", "Offers"],
  ["Settings", "Settings"],
  ["Review", "Reviews"],
  ["SupportTicket", "Support"],
  ["MaintenanceAsset", "Maintenance"],
];

const ACTIONS = [
  ["", "Any action"],
  ["create", "Created"],
  ["update", "Updated"],
  ["delete", "Deleted"],
  ["refund", "Refunded"],
  ["adjust", "Adjusted"],
];

const ENTITY_LABEL = Object.fromEntries(ENTITIES.filter(([k]) => k).map(([k, v]) => [k, v]));
const entityName = (entity) => ENTITY_LABEL[entity] || entity;
const roleName = (role) => (role || "").replace(/_/g, " ");

function EntityIcon({ entity }) {
  const common = { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
  switch (entity) {
    case "Order":
      return <svg {...common}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
    case "Product":
    case "Category":
      return <svg {...common}><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></svg>;
    case "Customer":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "Offer":
      return <svg {...common}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" /></svg>;
    case "Settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "Review":
      return <svg {...common}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>;
    case "SupportTicket":
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case "MaintenanceAsset":
      return <svg {...common}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" /></svg>;
    default:
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
  }
}

function dayTime(value) {
  if (!value) return { day: "—", time: "" };
  const d = new Date(value);
  return {
    day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function AuditLog() {
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: "", entity: "", action: "", page: 1 });
  const [range, setRange] = useState(todayRange);
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
    <div className="page products-page audit-page">
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="toolbar products-filters">
        <span className="search-field">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search"
            placeholder="Search by what changed, who, or which record…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </span>
        <span className="spacer" />
        <DateFilter value={range} onChange={setRange} />
      </div>

      <div className="toolbar products-filters audit-chips">
        <div className="chip-row" role="tablist" aria-label="Record type">
          {ENTITIES.map(([value, label]) => (
            <button key={label} type="button" role="tab" aria-selected={filters.entity === value} className={`cat-chip small${filters.entity === value ? " on" : ""}`} onClick={() => set("entity", value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar products-filters audit-chips">
        <div className="chip-row" role="tablist" aria-label="Action">
          {ACTIONS.map(([value, label]) => (
            <button key={label} type="button" role="tab" aria-selected={filters.action === value} className={`cat-chip small${filters.action === value ? " on" : ""}`} onClick={() => set("action", value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Audit log"
              columns={[
                {
                  key: "when",
                  label: "When",
                  render: (row) => {
                    const t = dayTime(row.createdAt);
                    return (
                      <span className="stack audit-when">
                        <span className="row-title">{t.day}</span>
                        <span className="row-sub">{t.time}</span>
                      </span>
                    );
                  },
                },
                {
                  key: "actor",
                  label: "Who",
                  render: (row) => (
                    <span className="person-cell">
                      <Avatar name={row.actorName || "system"} />
                      <span className="stack">
                        <span className="row-title">{row.actorName || "system"}</span>
                        <span className="row-sub">{roleName(row.actorRole)}</span>
                      </span>
                    </span>
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
                    <span className="audit-record">
                      <span className={`audit-icon ent-${String(row.entity).toLowerCase()}`}><EntityIcon entity={row.entity} /></span>
                      <span className="stack">
                        <span className="row-title">{entityName(row.entity)}</span>
                        {row.entityLabel ? (
                          row.entity === "Order" && row.entityId && row.action !== "delete" ? (
                            <Link className="row-sub audit-link" to={`/orders/${row.entityId}`} onClick={(e) => e.stopPropagation()}>{row.entityLabel}</Link>
                          ) : (
                            <span className="row-sub">{row.entityLabel}</span>
                          )
                        ) : null}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "summary",
                  label: "What changed",
                  render: (row) => {
                    const count = Object.keys(row.changes || {}).length;
                    return (
                      <span className="audit-summary">
                        <span className="audit-text">{row.summary}</span>
                        {count > 1 ? <span className="count-pill">{count} fields</span> : null}
                      </span>
                    );
                  },
                },
                {
                  key: "ip",
                  label: "From",
                  render: (row) => <span className="audit-ip">{row.ip || "—"}</span>,
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
          <h2>{entryTitle(entry)}</h2>
          <Pill tone={ACTION_TONE[entry.action]}>{entry.action}</Pill>
        </div>
      }
      onClose={onClose}
      wide
      footer={<button className="btn" onClick={onClose}>Close</button>}
    >
      <div className="audit-facts">
        <div className="audit-fact">
          <span className="audit-fact-label">Who</span>
          <span className="person-cell">
            <Avatar name={entry.actorName || "system"} />
            <span className="stack">
              <strong>{entry.actorName || "system"}</strong>
              <span className="row-sub">{roleName(entry.actorRole)}</span>
            </span>
          </span>
        </div>
        <div className="audit-fact">
          <span className="audit-fact-label">When</span>
          <strong>{when(entry.createdAt)}</strong>
        </div>
        <div className="audit-fact">
          <span className="audit-fact-label">From</span>
          <strong className="mono" style={{ overflowWrap: "anywhere" }}>{entry.ip || "—"}</strong>
        </div>
      </div>

      {entry.path ? (
        <div className="audit-request">
          <span className="audit-method">{entry.method}</span>
          <span className="mono">{entry.path}</span>
        </div>
      ) : null}

      <div className="section-label">Summary</div>
      <p className="audit-detail-summary">{entry.summary}</p>

      {changes.length ? (
        <>
          <div className="section-label">Field changes</div>
          <div className="audit-diff">
            {changes.map(([field, change]) => (
              <div className="audit-diff-row" key={field}>
                <span className="audit-diff-field">{field}</span>
                <span className="audit-diff-from">{format(change.from)}</span>
                <span className="audit-diff-arrow" aria-hidden="true">→</span>
                <span className="audit-diff-to">{format(change.to)}</span>
              </div>
            ))}
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

function entryTitle(entry) {
  return `${entityName(entry.entity)}${entry.entityLabel ? ` — ${entry.entityLabel}` : ""}`;
}

function format(value) {
  if (value === null || value === undefined) return <span className="faint">—</span>;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return <span className="mono" style={{ fontSize: 11.5 }}>{JSON.stringify(value)}</span>;
  return String(value);
}
