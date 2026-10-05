import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { Banner, Card, Empty, Loading, Pagination, Pill, Table, rupees, when } from "../../components/ui";

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
                  render: (row) =>
                    row.delivery?.partnerName ? (
                      <span className="muted">{row.delivery.partnerName}</span>
                    ) : (
                      <span className="faint">—</span>
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
