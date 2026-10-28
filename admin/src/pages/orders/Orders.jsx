import Select from "../../components/Select";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import DateFilter from "../../components/DateFilter";
import { Banner, Card, Empty, Loading, Modal, Pagination, Pill, Table, rupees, when } from "../../components/ui";

// The filter chips are built from the status table the API returns, so a new
// stage added to the engine shows up here without a frontend change.
const GROUP_TONE = {
  placed: "info",
  processing: "warn",
  delivery: "accent",
  closed: "ok",
  returns: "danger",
};

export function statusTone(status, statuses) {
  if (["CANCELLED", "REJECTED"].includes(status)) return "danger";
  if (status === "DELIVERED") return "ok";
  return GROUP_TONE[statuses?.[status]?.group] || undefined;
}

// Orders that are finished can no longer be handed to a rider.
const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

export default function Orders() {
  const navigate = useNavigate();
  const { can, user } = useAuth();
  // Deleting an order is for admins only (the API enforces it too).
  const canDelete = ["admin", "super_admin"].includes(user?.role);
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const canAssign = can("orders.assign");
  const [partners, setPartners] = useState([]);
  const [assigningId, setAssigningId] = useState(null);
  // Which row's Delivery cell is being edited, and the rider picked so far.
  const [editing, setEditing] = useState({ id: null, partner: "" });
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ items: [], meta: null });
  const [statuses, setStatuses] = useState({});
  // A dashboard card (e.g. "Pending Orders") links here with ?status=..., so
  // that lands on the matching bucket instead of always opening on "All".
  const [filters, setFilters] = useState({ status: searchParams.get("status") || "", page: 1 });
  // The calendar button next to the status chips: { from, to } as yyyy-mm-dd.
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/orders/statuses")
      .then(({ statuses: list }) =>
        setStatuses(Object.fromEntries(list.map((s) => [s.key, s])))
      )
      .catch(() => {});
  }, []);

  // Active delivery boys for the dropdown in the Delivery column.
  useEffect(() => {
    if (!canAssign) return;
    api
      .get("/orders/delivery/partners")
      .then(({ partners: list }) => setPartners(list))
      .catch(() => {});
  }, [canAssign]);

  function load() {
    return api
      .get("/orders", { ...filters, ...range, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message));
  }

  async function removeOrder(order) {
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/orders/${order.id}`);
      setConfirming(null);
      setNotice(`Order ${order.code} was deleted.`);
      await load();
    } catch (err) {
      setError(err.message);
      setConfirming(null);
    } finally {
      setDeleting(false);
    }
  }

  async function assign(order, partnerId) {
    if (!partnerId) return;
    setAssigningId(order.id);
    setError("");
    try {
      await api.post(`/orders/${order.id}/assign`, { partner: partnerId });
      setEditing({ id: null, partner: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigningId(null);
    }
  }

  useEffect(() => {
    setLoading(true);
    api
      .get("/orders", { ...filters, ...range, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters, range]);

  // A handful of useful buckets rather than all 19 statuses as chips. The
  // "Pending" value must match PENDING_ORDER_STATUSES in Dashboard.jsx
  // exactly (same statuses, same order) so that card's link highlights the
  // right chip here instead of landing with nothing selected.
  const buckets = [
    { label: "All", value: "" },
    {
      label: "Pending",
      value:
        "ORDER_PLACED,PAYMENT_PENDING,ORDER_CONFIRMED,ORDER_ACCEPTED,PICKING,PACKING,READY_FOR_PICKUP,ASSIGNED_TO_DELIVERY,PICKED_UP,OUT_FOR_DELIVERY,ARRIVED",
    },
    { label: "New", value: "ORDER_PLACED,PAYMENT_PENDING,ORDER_CONFIRMED" },
    { label: "Preparing", value: "ORDER_ACCEPTED,PICKING,PACKING" },
    { label: "Ready", value: "READY_FOR_PICKUP" },
    { label: "Out for delivery", value: "ASSIGNED_TO_DELIVERY,PICKED_UP,OUT_FOR_DELIVERY,ARRIVED" },
    { label: "Delivered", value: "DELIVERED" },
    { label: "Cancelled", value: "CANCELLED,REJECTED" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Orders</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{notice}</Banner>

      <div className="toolbar">
        {buckets.map((bucket) => (
          <button
            key={bucket.label}
            className={`btn sm${filters.status === bucket.value ? " primary" : ""}`}
            onClick={() => setFilters({ status: bucket.value, page: 1 })}
          >
            {bucket.label}
          </button>
        ))}
        <span className="spacer" />
        <DateFilter
          value={range}
          onChange={(next) => {
            setRange(next);
            setFilters((f) => ({ ...f, page: 1 }));
          }}
        />
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Orders"
              columns={[
                {
                  key: "code",
                  label: "Order",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title mono">{row.code}</span>
                      <span className="row-sub">{when(row.placedAt)}</span>
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
                  label: "Items",
                  align: "right",
                  render: (row) => row.items?.length || 0,
                },
                {
                  key: "total",
                  label: "Total",
                  align: "right",
                  render: (row) => <strong>{rupees(row.pricing?.total)}</strong>,
                },
                {
                  key: "payment",
                  label: "Payment",
                  render: (row) => (
                    <div className="stack">
                      <span className="nowrap">{row.payment?.method?.toUpperCase()}</span>
                      <Pill tone={row.payment?.status === "paid" ? "ok" : "warn"}>
                        {row.payment?.status}
                      </Pill>
                    </div>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <Pill tone={statusTone(row.status, statuses)}>
                      {statuses[row.status]?.label || row.status}
                    </Pill>
                  ),
                },
                {
                  key: "partner",
                  label: "Delivery",
                  render: (row) => {
                    const assigned = row.delivery?.partner ? String(row.delivery.partner) : "";
                    // Riders for this order's store (a rider with no store set works for all).
                    const choices = partners.filter(
                      (p) => !p.stores?.length || p.stores.includes(String(row.store))
                    );
                    if (!canAssign || CLOSED.includes(row.status)) {
                      return row.delivery?.partnerName ? (
                        <span className="muted">{row.delivery.partnerName}</span>
                      ) : (
                        <span className="faint">—</span>
                      );
                    }
                    if (editing.id !== row.id) {
                      return (
                        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                          {row.delivery?.partnerName ? (
                            <span className="muted">{row.delivery.partnerName}</span>
                          ) : (
                            <span className="faint">—</span>
                          )}
                          <button
                            className="btn sm"
                            onClick={() => setEditing({ id: row.id, partner: assigned })}
                          >
                            {assigned ? "Edit" : "Assign"}
                          </button>
                        </div>
                      );
                    }
                    const busy = assigningId === row.id;
                    return (
                      <div className="row-actions" onClick={(e) => e.stopPropagation()} style={{ flexWrap: "nowrap" }}>
                        <Select
                          value={editing.partner}
                          disabled={busy}
                          onChange={(e) => setEditing({ id: row.id, partner: e.target.value })}
                          aria-label="Delivery boy"
                          style={{ minWidth: 140 }}
                        >
                          <option value="">Select delivery boy</option>
                          {row.delivery?.partnerName && !choices.some((p) => p.id === assigned) ? (
                            <option value={assigned}>{row.delivery.partnerName}</option>
                          ) : null}
                          {choices.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                        <button
                          className="btn sm primary"
                          disabled={!editing.partner || editing.partner === assigned || busy}
                          onClick={() => assign(row, editing.partner)}
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>
                        <button
                          className="btn sm"
                          disabled={busy}
                          onClick={() => setEditing({ id: null, partner: "" })}
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  },
                },
                ...(canDelete
                  ? [
                      {
                        key: "actions",
                        label: "Actions",
                        align: "right",
                        exportable: false,
                        sortable: false,
                        render: (row) => (
                          <button
                            className="btn sm danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirming(row);
                            }}
                          >
                            Delete
                          </button>
                        ),
                      },
                    ]
                  : []),
              ]}
              rows={data.items.map((row) => ({ ...row, partner: row.delivery?.partnerName || "" }))}
              onRowClick={(row) => navigate(`/orders/${row.id}`)}
              empty={<Empty title="No orders" hint="Orders placed from the app or website land here." />}
            />
            <Pagination meta={data.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </Card>

      {confirming && (
        <Modal
          title="Delete order?"
          onClose={() => !deleting && setConfirming(null)}
          footer={
            <>
              <button className="btn" disabled={deleting} onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button className="btn danger" disabled={deleting} onClick={() => removeOrder(confirming)}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            <strong className="mono">{confirming.code}</strong> will be permanently removed.
          </p>
          {!["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"].includes(confirming.status) ? (
            <p className="faint" style={{ fontSize: 13, marginBottom: 0 }}>
              This order is still open, so it will be cancelled first: its stock is returned and any
              payment is refunded, and the customer is notified of the cancellation.
            </p>
          ) : (
            <p className="faint" style={{ fontSize: 13, marginBottom: 0 }}>
              This cannot be undone.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
