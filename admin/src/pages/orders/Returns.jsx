import Select from "../../components/Select";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { toast } from "../../components/Toaster";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import {
  Banner, Card, Divider, Empty, Field, Loading, Modal, Pagination, Pill, Stat, Table, Tabs, rupees, when,
} from "../../components/ui";

// The return workflow is four states of the order machine, not a separate
// object — so this screen is a filtered order queue with the right buttons on
// each row rather than a parallel inbox.
const STAGES = [
  { key: "RETURN_REQUESTED", label: "Awaiting decision", tone: "warn" },
  { key: "RETURN_APPROVED", label: "To collect", tone: "info" },
  { key: "RETURN_PICKED", label: "Collected — refund due", tone: "accent" },
  { key: "REFUNDED", label: "Refunded", tone: "ok" },
];

const STAGE_BY_KEY = Object.fromEntries(STAGES.map((stage) => [stage.key, stage]));

export default function Returns() {
  const { can } = useAuth();
  const canManage = can("orders.manage");

  const [status, setStatus] = useState("RETURN_REQUESTED");
  const [data, setData] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({});
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/returns", { status, page, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, page]);

  const loadCounts = useCallback(() => {
    Promise.all(
      STAGES.map((stage) =>
        api
          .get("/returns", { status: stage.key, limit: 1 })
          .then((res) => [stage.key, res.meta?.total ?? 0])
          .catch(() => [stage.key, 0])
      )
    ).then((pairs) => setCounts(Object.fromEntries(pairs)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  function refresh() {
    load();
    loadCounts();
  }

  return (
    <div className="page products-page orders-page">
      <div className="page-head">
        <div>
          <h1>Returns</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        {STAGES.map((stage) => (
          <Stat
            key={stage.key}
            label={stage.label}
            value={counts[stage.key] ?? "—"}
            tone={counts[stage.key] ? stage.tone : undefined}
          />
        ))}
      </div>

      <Tabs
        tabs={STAGES.map((stage) => ({
          key: stage.key,
          label: stage.label,
          count: counts[stage.key],
        }))}
        active={status}
        onChange={(key) => { setStatus(key); setPage(1); }}
      />

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Returns"
              columns={[
                {
                  key: "code",
                  label: "Order",
                  render: (row) => (
                    <div className="stack">
                      <Link to={`/orders/${row.id}`} className="mono">{row.code}</Link>
                      <span className="row-sub">{when(row.updatedAt)}</span>
                    </div>
                  ),
                },
                {
                  key: "customer",
                  label: "Customer",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.customerSnapshot?.name || "—"}</span>
                      <span className="row-sub">{row.customerSnapshot?.phone}</span>
                    </div>
                  ),
                },
                {
                  key: "items",
                  label: "Coming back",
                  render: (row) => {
                    const returned = (row.items || []).filter((i) => i.itemStatus === "returned");
                    return (
                      <div className="stack">
                        <span>{returned.length} of {row.items?.length} lines</span>
                        <span className="row-sub">
                          {returned.slice(0, 2).map((i) => i.name).join(", ")}
                          {returned.length > 2 ? ` +${returned.length - 2} more` : ""}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  key: "value",
                  label: "Refund due",
                  align: "right",
                  render: (row) => <strong>{rupees(returnValue(row))}</strong>,
                },
                {
                  key: "paidBy",
                  label: "Paid by",
                  render: (row) => (
                    <span className="muted">{(row.payment?.method || "—").toUpperCase()}</span>
                  ),
                },
                {
                  key: "status",
                  label: "Stage",
                  render: (row) => (
                    <Pill tone={STAGE_BY_KEY[row.status]?.tone}>
                      {STAGE_BY_KEY[row.status]?.label || row.status}
                    </Pill>
                  ),
                },
                {
                  key: "act",
                  label: "",
                  align: "right",
                  render: (row) =>
                    canManage && nextAction(row.status) ? (
                      <button
                        className="btn sm primary"
                        onClick={(e) => { e.stopPropagation(); navigate(`/returns/${row.id}`); }}
                      >
                        {nextAction(row.status).label}
                      </button>
                    ) : null,
                },
              ]}
              rows={data.items}
              onRowClick={(row) => navigate(`/returns/${row.id}`)}
              empty={
                <Empty
                  title={`Nothing ${STAGE_BY_KEY[status]?.label.toLowerCase()}`}
                  hint="Returns arrive here the moment a customer requests one from the app."
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

// /returns/:id — one return (review, collect, refund) as a page. The order is
// read fresh, so the page shows its current return stage.
export function ReturnPage() {
  const { can } = useAuth();
  return (
    <FormRoute
      backTo="/returns"
      backLabel="Returns"
      load={async (id) => (id ? (await api.get(`/orders/${id}`)).order || null : null)}
      render={(order, back) => (
        <ReturnModal order={order} canManage={can("orders.manage")} onClose={back} />
      )}
    />
  );
}

function returnValue(order) {
  return (order.items || [])
    .filter((item) => item.itemStatus === "returned")
    .reduce((sum, item) => sum + (item.payable || 0), 0);
}

function nextAction(status) {
  if (status === "RETURN_REQUESTED") return { key: "approve", label: "Review" };
  if (status === "RETURN_APPROVED") return { key: "collected", label: "Mark collected" };
  if (status === "RETURN_PICKED") return { key: "refund", label: "Refund" };
  return null;
}

// What the admin is told after each step (the page stays put and updates).
const DONE_MESSAGE = {
  approve: "Return approved",
  decline: "Return rejected",
  collected: "Return marked as collected",
  refund: "Refund issued",
};

function ReturnModal({ order: initial, canManage, onClose }) {
  // The order as it stands now: replaced by the server's copy after each step.
  const [order, setOrder] = useState(initial);
  const step = nextAction(order.status);
  const returned = (order.items || []).filter((item) => item.itemStatus === "returned");

  const [note, setNote] = useState("");
  const [damaged, setDamaged] = useState([]);
  const [restock, setRestock] = useState(true);
  const [amount, setAmount] = useState(returnValue(order) / 100);
  const [destination, setDestination] = useState(
    order.payment?.method === "cod" ? "wallet" : "source"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Declining asks for a reason first — the customer is shown it.
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      const body = action === "decline" ? { reason: declineReason.trim() } : { note, reason: note };
      if (action === "collected") {
        body.restock = restock;
        body.damaged = damaged;
      }
      if (action === "refund") {
        body.amount = Math.round(amount * 100);
        body.destination = destination;
      }
      const res = await api.post(`/returns/orders/${order.id}/${action}`, body);
      if (res?.order) setOrder(res.order);
      setNote("");
      setDeclining(false);
      setDeclineReason("");
      toast.success(DONE_MESSAGE[action] || "Done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={
        <div className="inline">
          <h2>Return on {order.code}</h2>
          <Pill tone={STAGE_BY_KEY[order.status]?.tone}>
            {STAGE_BY_KEY[order.status]?.label || order.status}
          </Pill>
        </div>
      }
      onClose={onClose}
      wide
      footer={
        <>
          {declining ? (
            <>
              <button className="btn" disabled={busy} onClick={() => setDeclining(false)}>Back</button>
              <button className="btn danger" disabled={busy || !declineReason.trim()} onClick={() => run("decline")}>
                {busy ? "Declining…" : "Decline return"}
              </button>
            </>
          ) : null}
          {!declining ? <button className="btn" onClick={onClose}>Close</button> : null}
          {!declining && canManage && order.status === "RETURN_REQUESTED" ? (
            <button className="btn danger" disabled={busy} onClick={() => { setError(""); setDeclining(true); }}>
              Decline
            </button>
          ) : null}
          {!declining && canManage && step ? (
            <button className="btn primary" disabled={busy} onClick={() => run(step.key)}>
              {busy ? "Working…" : step.key === "approve" ? "Approve return" : step.label}
            </button>
          ) : null}
        </>
      }
    >
      <Banner tone="error">{error}</Banner>
      {order.returnRequest?.attempts ? (
        <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
          Request {order.returnRequest.attempts} of 5 on this order
          {order.returnRequest.declineReason ? ` · last declined: "${order.returnRequest.declineReason}"` : ""}
        </p>
      ) : null}
      {declining ? (
        <div className="decline-box">
          <div className="section-label">Why are you declining? The customer will see this.</div>
          <div className="decline-chips">
            {[
              "Photo doesn't show any damage",
              "Photo is unclear — please send a clearer one",
              "Item matches what was ordered",
              "Item was used or consumed",
            ].map((r) => (
              <button key={r} type="button" className={declineReason === r ? "on" : ""} onClick={() => setDeclineReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            maxLength={300}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Write the reason for the customer"
            autoFocus
          />
        </div>
      ) : null}

      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>CUSTOMER</span>
          <strong>{order.customerSnapshot?.name || "—"}</strong>
          <span className="muted">{order.customerSnapshot?.phone}</span>
        </div>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>DELIVERED</span>
          <strong>{order.delivery?.deliveredAt ? when(order.delivery.deliveredAt) : "—"}</strong>
        </div>
        <div className="stack">
          <span className="faint" style={{ fontSize: 11 }}>PAID BY</span>
          <strong>{(order.payment?.method || "—").toUpperCase()}</strong>
          <span className="muted">{rupees(order.pricing?.total)} total</span>
        </div>
      </div>

      <div className="section-label">Lines coming back</div>
      <Table
        title="Return items"
        columns={[
          {
            key: "name",
            label: "Item",
            render: (row) => (
              <div className="stack">
                <span className="row-title">{row.name}</span>
                <span className="row-sub">{row.variantName}</span>
              </div>
            ),
          },
          { key: "quantity", label: "Qty", align: "right" },
          { key: "payable", label: "Paid", align: "right", render: (row) => rupees(row.payable) },
          ...(order.status === "RETURN_APPROVED"
            ? [
                {
                  key: "damaged",
                  label: "Resaleable?",
                  align: "right",
                  render: (row) => (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={damaged.includes(row.id)}
                        onChange={(e) =>
                          setDamaged(
                            e.target.checked
                              ? [...damaged, row.id]
                              : damaged.filter((id) => id !== row.id)
                          )
                        }
                      />
                      <span>{damaged.includes(row.id) ? "Damaged" : "Back on shelf"}</span>
                    </label>
                  ),
                },
              ]
            : []),
        ]}
        rows={returned}
        empty={<Empty title="No lines marked as returned" />}
      />

      {order.internalNote ? (
        <>
          <Divider style={{ margin: "14px 0" }} />
          <div className="section-label">Why</div>
          <p className="muted" style={{ marginTop: 0, whiteSpace: "pre-line", fontSize: 13.5 }}>
            {order.internalNote}
          </p>
        </>
      ) : null}

      {order.returnRequest?.history?.length ? (
        <>
          <div className="section-label" style={{ marginTop: 10 }}>
            Customer requests ({order.returnRequest.history.length})
          </div>
          <div className="return-requests">
            {order.returnRequest.history.map((r, i) => (
              <div key={i} className="return-request">
                <div className="return-request-head">
                  <strong>#{i + 1} · {(r.items || []).join(", ") || "Items"}</strong>
                  <span className="muted">{r.at ? new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""}</span>
                </div>
                {r.reason ? <p className="muted" style={{ margin: "4px 0 6px", fontSize: 13 }}>{r.reason}</p> : null}
                {r.photos?.length ? (
                  <div className="return-photos">
                    {r.photos.map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer" title="Open full size">
                        <img src={src} alt="Return photo from the customer" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : order.returnRequest?.photos?.length ? (
        <>
          <div className="section-label" style={{ marginTop: 10 }}>Customer photos</div>
          <div className="return-photos">
            {order.returnRequest.photos.map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer" title="Open full size">
                <img src={src} alt="Return photo from the customer" />
              </a>
            ))}
          </div>
        </>
      ) : null}

      {canManage && step ? (
        <>
          <Divider style={{ margin: "14px 0" }} />

          {step.key === "collected" ? (
            <Field
              label="Put the goods back into stock"
              help="Anything you flag as damaged above is written off instead, so the loss stays visible."
            >
              <label className="checkbox">
                <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
                <span>{restock ? "Restock what is resaleable" : "Do not restock"}</span>
              </label>
            </Field>
          ) : null}

          {step.key === "refund" ? (
            <div className="grid cols-2">
              <Field label="Refund amount (₹)">
                <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </Field>
              <Field
                label="Refund to"
                help={
                  order.payment?.method === "cod"
                    ? "A cash order has no card to send money back to — wallet or a manual transfer."
                    : "Back to the card or UPI it came from, or into the wallet for an instant refund."
                }
              >
                <Select value={destination} onChange={(e) => setDestination(e.target.value)}>
                  {order.payment?.method !== "cod" ? <option value="source">Original payment method</option> : null}
                  <option value="wallet">Store wallet</option>
                  <option value="cash">Cash handed back</option>
                </Select>
              </Field>
            </div>
          ) : null}

          <Field label={step.key === "approve" ? "Note (the customer sees the decision, not this)" : "Note"}>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                step.key === "approve"
                  ? "Wrong item sent — approved"
                  : step.key === "collected"
                  ? "Collected by Ravi on the evening run"
                  : "Refund for returned items"
              }
            />
          </Field>
        </>
      ) : null}
    </Modal>
  );
}
