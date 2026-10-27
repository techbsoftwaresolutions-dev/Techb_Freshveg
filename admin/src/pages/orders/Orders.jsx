import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, confirmDialog, toast } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Loading, Pagination, Pill, Table, rupees, when } from "../../components/ui";
import { Select } from "../../components/SelectMenu";

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

// The two stages at which an order can be handed to (or taken from) a
// delivery person; the API enforces the same rule (order.service.js).
const ASSIGNABLE = ["READY_FOR_PICKUP", "ASSIGNED_TO_DELIVERY"];

// The Delivery column: who has the order, and — while it can still change
// hands — a picker with Save and Remove. Each row keeps its own selection
// and busy state; the row changes only when the API confirms.
function DeliveryCell({ order, partners, canAssign, statuses, onSaved }) {
  const current = order.delivery?.partner ? String(order.delivery.partner) : "";
  const name = order.delivery?.partnerName || "";
  const [selected, setSelected] = useState(current);
  const [busy, setBusy] = useState(""); // "save" | "remove" | ""
  const inFlight = useRef(false);

  useEffect(() => setSelected(current), [current]);

  if (!canAssign || !ASSIGNABLE.includes(order.status)) {
    const group = statuses[order.status]?.group;
    return (
      <div className="stack">
        {name ? <span className="muted">{name}</span> : <span className="faint">—</span>}
        {group === "processing" && !name ? <span className="row-sub">Assign once ready</span> : null}
      </div>
    );
  }

  // Riders limited to other stores are left out; an empty list means "all".
  const options = partners.list.filter((p) => !p.stores?.length || p.stores.includes(String(order.store)));
  const currentListed = !current || options.some((p) => p.id === current);

  async function run(kind, request) {
    if (inFlight.current) return; // a double click sends one request
    inFlight.current = true;
    setBusy(kind);
    try {
      const data = await request();
      onSaved(data.order);
    } catch {
      setSelected(current); // the API client has already shown why
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }

  const save = () => {
    if (!selected) {
      toast("error", "Choose a delivery person first");
      return;
    }
    run("save", () => api.post(`/orders/${order.id}/assign`, { partner: selected }));
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: "Remove delivery person?",
      message: `Remove ${name} from ${order.code}? It goes back to Ready for pickup and leaves their app.`,
      confirmText: "Remove",
      danger: true,
    });
    if (!ok) return;
    run("remove", () => api.delete(`/orders/${order.id}/assign`));
  };

  const placeholder = partners.loading
    ? "Loading…"
    : partners.error
      ? "Couldn't load delivery people"
      : options.length
        ? "Select delivery person"
        : "No active delivery people";

  return (
    <div className="assign-cell" onClick={(e) => e.stopPropagation()}>
      {name ? (
        <span className="row-title">
          {name}
          {currentListed ? null : <span className="assign-warn"> · inactive, reassign</span>}
        </span>
      ) : null}
      <div className="assign-controls">
        <Select
          value={currentListed ? selected : selected === current ? "" : selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={Boolean(busy) || partners.loading || !options.length}
          aria-label={`Delivery person for ${order.code}`}
        >
          <option value="">{placeholder}</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.phone ? ` · ${p.phone}` : ""}
              {p.openNow ? ` · ${p.openNow} open` : ""}
            </option>
          ))}
        </Select>
        <button
          type="button"
          className="btn sm primary"
          onClick={save}
          disabled={Boolean(busy) || !selected || selected === current}
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        {current ? (
          <button
            type="button"
            className="btn sm danger"
            onClick={remove}
            disabled={Boolean(busy)}
            title={`Remove ${name} from this order`}
            aria-label={`Remove ${name} from ${order.code}`}
          >
            {busy === "remove" ? "Removing…" : "Remove"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ items: [], meta: null });
  const [statuses, setStatuses] = useState({});
  // A dashboard card (e.g. "Pending Orders") links here with ?status=..., so
  // that lands on the matching bucket instead of always opening on "All".
  const [filters, setFilters] = useState({ status: searchParams.get("status") || "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { can } = useAuth();
  const canAssign = can("orders.assign");
  // Active delivery people, read once for the whole table and again after
  // each change (their open-order counts move).
  const [partners, setPartners] = useState({ list: [], loading: canAssign, error: "" });

  const loadPartners = useCallback(() => {
    if (!canAssign) return;
    api
      .get("/orders/delivery/partners")
      .then((data) => setPartners({ list: data.partners, loading: false, error: "" }))
      .catch((err) => setPartners((p) => ({ ...p, loading: false, error: err.message })));
  }, [canAssign]);

  useEffect(loadPartners, [loadPartners]);

  // A saved assignment swaps in the order the API returned, so the row shows
  // what was actually stored.
  const replaceOrder = (order) => {
    setData((d) => ({ ...d, items: d.items.map((o) => (o.id === order.id ? order : o)) }));
    loadPartners();
  };

  useEffect(() => {
    api
      .get("/orders/statuses")
      .then(({ statuses: list }) =>
        setStatuses(Object.fromEntries(list.map((s) => [s.key, s])))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get("/orders", { ...filters, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

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
                  sortable: false,
                  render: (row) => (
                    <DeliveryCell
                      order={row}
                      partners={partners}
                      canAssign={canAssign}
                      statuses={statuses}
                      onSaved={replaceOrder}
                    />
                  ),
                },
              ]}
              rows={data.items}
              onRowClick={(row) => navigate(`/orders/${row.id}`)}
              empty={<Empty title="No orders" hint="Orders placed from the app or website land here." />}
            />
            <Pagination meta={data.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </Card>
    </div>
  );
}
