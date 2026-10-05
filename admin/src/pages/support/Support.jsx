import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import {
  Banner, Card, Divider, Empty, Field, Loading, Modal, Pagination, Pill, Table, Tabs, rupees, when,
} from "../../components/ui";

const PRIORITY_TONE = { urgent: "danger", high: "danger", normal: undefined, low: undefined };
const STATUS_TONE = {
  open: "warn",
  in_progress: "info",
  waiting_customer: "accent",
  resolved: "ok",
  closed: undefined,
};

export default function Support() {
  const { can, user } = useAuth();
  const canManage = can("customers.manage");

  const [tab, setTab] = useState("open");
  const [data, setData] = useState({ items: [], meta: null, counts: {} });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    const query = { page, limit: 20 };
    if (tab === "open") query.open = "true";
    else if (tab !== "all") query.status = tab;

    api
      .get("/support", query)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = data.counts || {};

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Support</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      <Tabs
        tabs={[
          { key: "open", label: "Needs attention" },
          { key: "waiting_customer", label: "Waiting on customer", count: counts.waiting_customer },
          { key: "resolved", label: "Resolved", count: counts.resolved },
          { key: "all", label: "All" },
        ]}
        active={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
        }}
      />

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Support tickets"
              columns={[
                {
                  key: "code",
                  label: "Ticket",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.subject}</span>
                      <span className="row-sub mono">{row.code} · {when(row.createdAt)}</span>
                    </div>
                  ),
                },
                {
                  key: "category",
                  label: "Issue",
                  render: (row) => (
                    <span className="muted">{row.category.replace(/_/g, " ")}</span>
                  ),
                },
                {
                  key: "customer",
                  label: "Customer",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.customerName}</span>
                      <span className="row-sub">{row.customerPhone}</span>
                    </div>
                  ),
                },
                {
                  key: "order",
                  label: "Order",
                  render: (row) =>
                    row.order ? (
                      <Link to={`/orders/${row.order}`} className="mono" onClick={(e) => e.stopPropagation()}>
                        {row.orderCode}
                      </Link>
                    ) : (
                      <span className="faint">—</span>
                    ),
                },
                {
                  key: "priority",
                  label: "Priority",
                  render: (row) => <Pill tone={PRIORITY_TONE[row.priority]}>{row.priority}</Pill>,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <div className="stack">
                      <Pill tone={STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Pill>
                      {row.resolution?.type && row.resolution.type !== "none" ? (
                        <span className="row-sub">
                          {row.resolution.type}
                          {row.resolution.amount ? ` · ${rupees(row.resolution.amount)}` : ""}
                        </span>
                      ) : null}
                    </div>
                  ),
                },
              ]}
              rows={data.items}
              onRowClick={(row) => navigate(`/support/${row.id}`)}
              empty={
                <Empty
                  title={tab === "open" ? "Nothing needs attention" : "No tickets here"}
                  hint="Customers raise these from the app or the website."
                />
              }
            />
            <Pagination meta={data.meta} onPage={setPage} />
          </>
        )}
      </Card>

    </div>
  );
}

// /support/:id — a ticket and its conversation as a page. Resolving it is
// still a small dialog on top.
export function TicketPage() {
  const { can, user } = useAuth();
  return (
    <FormRoute
      backTo="/support"
      backLabel="Support"
      load={async (id) => (id ? { id } : null)}
      render={({ id }, back) => (
        <TicketDrawer id={id} canManage={can("customers.manage")} me={user} onClose={back} onChanged={() => {}} />
      )}
    />
  );
}

function TicketDrawer({ id, canManage, me, onClose, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/support/${id}`)
      .then((data) => setTicket(data.ticket))
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    setBusy(true);
    setError("");
    try {
      await api.post(`/support/${id}/messages`, { body: reply, internal });
      setReply("");
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(payload) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/support/${id}/resolve`, payload);
      setResolving(false);
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ticket) {
    return (
      <Modal title="Ticket" onClose={onClose} wide>
        <Loading />
      </Modal>
    );
  }

  const closed = ["resolved", "closed"].includes(ticket.status);

  return (
    <Modal
      title={
        <div className="inline">
          <h2>{ticket.subject}</h2>
          <span className="tag">{ticket.code}</span>
          <Pill tone={STATUS_TONE[ticket.status]}>{ticket.status.replace(/_/g, " ")}</Pill>
        </div>
      }
      onClose={onClose}
      wide
      footer={
        canManage && !closed ? (
          <>
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn primary" onClick={() => setResolving(true)}>
              Resolve ticket
            </button>
          </>
        ) : (
          <button className="btn" onClick={onClose}>Close</button>
        )
      }
    >
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>CUSTOMER</span>
          <strong>{ticket.customerName}</strong>
          <span className="muted">{ticket.customerPhone}</span>
        </div>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>ORDER</span>
          {ticket.order ? (
            <Link to={`/orders/${ticket.order.id || ticket.order}`} className="mono">{ticket.orderCode}</Link>
          ) : (
            <span className="faint">Not about an order</span>
          )}
          {ticket.order?.pricing ? (
            <span className="muted">{rupees(ticket.order.pricing.total)}</span>
          ) : null}
        </div>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>ISSUE</span>
          <strong>{ticket.category.replace(/_/g, " ")}</strong>
          <Pill tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Pill>
        </div>
      </div>

      {ticket.resolution?.type && ticket.resolution.type !== "none" ? (
        <Banner tone="ok">
          Resolved as <strong>{ticket.resolution.type}</strong>
          {ticket.resolution.amount ? ` — ${rupees(ticket.resolution.amount)} refunded` : ""}
          {ticket.resolution.note ? `. ${ticket.resolution.note}` : ""}
        </Banner>
      ) : null}

      <div className="section-label">Conversation</div>
      <div style={{ display: "grid", gap: 10, maxHeight: 320, overflowY: "auto" }}>
        {ticket.messages.map((message) => (
          <div
            key={message.id || message.at}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: message.internal
                ? "var(--warn-soft)"
                : message.authorRole === "customer"
                  ? "var(--surface-2)"
                  : "var(--accent-soft)",
            }}
          >
            <div className="inline" style={{ justifyContent: "space-between", marginBottom: 4 }}>
              <strong style={{ fontSize: 12.5 }}>
                {message.authorName || "—"}
                <span className="faint" style={{ fontWeight: 400 }}> · {message.authorRole}</span>
              </strong>
              <span className="faint" style={{ fontSize: 11 }}>
                {when(message.at)}
                {message.internal ? " · internal note" : ""}
              </span>
            </div>
            <div style={{ fontSize: 13.5 }}>{message.body}</div>
          </div>
        ))}
      </div>

      {canManage ? (
        <>
          <Divider />
          <Field label="Reply">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={internal ? "A note for your team — the customer never sees this." : "Reply to the customer…"}
            />
          </Field>
          <div className="inline" style={{ justifyContent: "space-between" }}>
            <label className="checkbox">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Internal note (not sent to the customer)
            </label>
            <button className="btn primary sm" disabled={!reply.trim() || busy} onClick={send}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </>
      ) : null}

      {resolving ? (
        <ResolveModal
          ticket={ticket}
          busy={busy}
          onClose={() => setResolving(false)}
          onResolve={resolve}
        />
      ) : null}
    </Modal>
  );
}

function ResolveModal({ ticket, busy, onClose, onResolve }) {
  const [type, setType] = useState("explained");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");

  const maxRefund = ticket.order?.pricing?.total || 0;

  return (
    <Modal
      title="Resolve ticket"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={busy || (type === "refund" && (!amount || amount > maxRefund))}
            onClick={() => onResolve({ type, amount: Math.round(amount * 100), note })}
          >
            {busy ? "Resolving…" : "Resolve"}
          </button>
        </>
      }
    >
      <Field label="How was this resolved?">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="explained">Explained — no action needed</option>
          <option value="refund">Refunded</option>
          <option value="replacement">Replacement sent</option>
          <option value="goodwill">Goodwill gesture</option>
        </select>
      </Field>

      {type === "refund" ? (
        <Field
          label="Refund amount (₹)"
          help={
            maxRefund
              ? `Up to ${rupees(maxRefund)} — goes straight to the customer's wallet.`
              : "This ticket has no order attached, so there is nothing to refund."
          }
        >
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            max={maxRefund / 100}
          />
        </Field>
      ) : null}

      <Field label="Note for the customer">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
