import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  Banner, Card, DateRange, Empty, Loading, Pagination, Pill, Stat, Table, Tabs, rupees, when,
} from "../../components/ui";

const STATUS_TONE = {
  captured: "ok",
  failed: "danger",
  refunded: "warn",
  partially_refunded: "warn",
  pending: "info",
  created: undefined,
};

export default function Payments() {
  const { can } = useAuth();
  const [tab, setTab] = useState("transactions");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Payments</h1>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: "transactions", label: "Transactions" },
          { key: "refunds", label: "Refunds" },
          { key: "cod", label: "Cash to collect" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "transactions" && <Transactions />}
      {tab === "refunds" && <Refunds />}
      {tab === "cod" && <CashOnDelivery canManage={can("orders.manage")} />}
    </div>
  );
}

function Transactions() {
  const [data, setData] = useState({ items: [], meta: null, totals: null });
  const [range, setRange] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState({ status: "", method: "", search: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(
      () =>
        api
          .get("/payments", { ...filters, ...range, limit: 20 })
          .then(setData)
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false)),
      filters.search ? 250 : 0
    );
    return () => clearTimeout(timer);
  }, [filters, range]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  return (
    <>
      <Banner tone="error">{error}</Banner>

      {data.totals ? (
        <div className="grid cols-3" style={{ marginBottom: 14 }}>
          <Stat label="Captured" value={rupees(data.totals.captured)} foot={`${data.totals.count} attempts`} />
          <Stat label="Refunded" value={rupees(data.totals.refunded)} tone={data.totals.refunded ? "warn" : undefined} />
          <Stat label="Net" value={rupees(data.totals.captured - data.totals.refunded)} tone="ok" />
        </div>
      ) : null}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by order code…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 200 }}
        />
        <select value={filters.method} onChange={(e) => set("method", e.target.value)}>
          <option value="">All methods</option>
          <option value="cod">Cash on delivery</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="netbanking">Net banking</option>
        </select>
        <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="captured">Captured</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <span className="spacer" />
        <DateRange value={range} onChange={setRange} />
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Transactions"
              columns={[
                {
                  key: "order",
                  label: "Order",
                  render: (row) => (
                    <div className="stack">
                      <Link to={`/orders/${row.order}`} className="mono">{row.orderCode}</Link>
                      <span className="row-sub">{when(row.createdAt)}</span>
                    </div>
                  ),
                },
                {
                  key: "method",
                  label: "Method",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.method.toUpperCase()}</span>
                      {row.provider !== "none" ? <span className="row-sub">{row.provider}</span> : null}
                    </div>
                  ),
                },
                { key: "amount", label: "Amount", align: "right", render: (row) => rupees(row.amount) },
                {
                  key: "captured",
                  label: "Captured",
                  align: "right",
                  render: (row) => (row.amountCaptured ? rupees(row.amountCaptured) : "—"),
                },
                {
                  key: "refunded",
                  label: "Refunded",
                  align: "right",
                  render: (row) =>
                    row.amountRefunded ? (
                      <span style={{ color: "var(--warn)" }}>{rupees(row.amountRefunded)}</span>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <div className="stack">
                      <Pill tone={STATUS_TONE[row.status]}>{row.status.replace(/_/g, " ")}</Pill>
                      {row.failureReason ? <span className="row-sub">{row.failureReason}</span> : null}
                    </div>
                  ),
                },
                {
                  key: "ref",
                  label: "Gateway ref",
                  render: (row) =>
                    row.providerPaymentId ? (
                      <span className="tag">{row.providerPaymentId}</span>
                    ) : (
                      <span className="faint">—</span>
                    ),
                },
              ]}
              rows={data.items}
              empty={<Empty title="No payments in this window" />}
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>
    </>
  );
}

function Refunds() {
  const [data, setData] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/payments/refunds", { page, limit: 20 })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <Loading />;

  return (
    <Card tight>
      <Table
        title="Refunds"
        columns={[
          {
            key: "order",
            label: "Order",
            render: (row) => (
              <div className="stack">
                <Link to={`/orders/${row.order}`} className="mono">{row.orderCode}</Link>
                <span className="row-sub">{when(row.createdAt)}</span>
              </div>
            ),
          },
          { key: "amount", label: "Amount", align: "right", render: (row) => <strong>{rupees(row.amount)}</strong> },
          {
            key: "destination",
            label: "Where it went",
            render: (row) => (
              <Pill tone={row.destination === "wallet" ? "accent" : undefined}>
                {row.destination === "wallet" ? "Customer wallet" : row.destination === "source" ? "Back to source" : "Cash"}
              </Pill>
            ),
          },
          { key: "reason", label: "Reason", render: (row) => <span className="muted">{row.reason || "—"}</span> },
          { key: "requestedByName", label: "By", render: (row) => <span className="muted">{row.requestedByName || "system"}</span> },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <Pill tone={row.status === "completed" ? "ok" : row.status === "failed" ? "danger" : "info"}>
                {row.status}
              </Pill>
            ),
          },
        ]}
        rows={data.items}
        empty={<Empty title="No refunds yet" hint="Refunds raised from an order or a support ticket show up here." />}
      />
      <Pagination meta={data.meta} onPage={setPage} />
    </Card>
  );
}

// The reconciliation screen: who is holding the shop's cash, and confirming it
// came back. Without this, COD is a black hole.
function CashOnDelivery({ canManage }) {
  const [data, setData] = useState({ partners: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/payments/cod/outstanding")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function settle(entry) {
    setBusy(entry.partner?.id || "unassigned");
    setError("");
    try {
      const result = await api.post("/payments/cod/settle", { paymentIds: entry.paymentIds });
      setNotice(`Recorded ${rupees(entry.amount)} handed in by ${entry.partner?.name || "the store"}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{notice}</Banner>

      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <Stat
          label="Cash outstanding"
          value={rupees(data.total)}
          foot="Collected but not yet handed in"
          tone={data.total ? "warn" : "ok"}
        />
        <Stat label="Riders holding cash" value={data.partners.length} />
      </div>

      <Card tight>
        <Table
          title="Cash to collect"
          columns={[
            {
              key: "partner",
              label: "Delivery partner",
              render: (row) => (
                <div className="stack">
                  <span className="row-title">{row.partner?.name || "Unassigned"}</span>
                  <span className="row-sub">{row.partner?.phone}</span>
                </div>
              ),
            },
            { key: "orders", label: "Orders", align: "right" },
            {
              key: "amount",
              label: "Cash held",
              align: "right",
              render: (row) => <strong style={{ color: "var(--warn)" }}>{rupees(row.amount)}</strong>,
            },
            {
              key: "actions",
              label: "",
              align: "right",
              render: (row) =>
                canManage ? (
                  <button
                    className="btn sm primary"
                    disabled={busy === (row.partner?.id || "unassigned")}
                    onClick={() => settle(row)}
                  >
                    Mark handed in
                  </button>
                ) : null,
            },
          ]}
          rows={data.partners}
          keyOf={(row) => row.partner?.id || "unassigned"}
          empty={
            <Empty
              title="All cash accounted for"
              hint="Nothing collected is still outstanding."
            />
          }
        />
      </Card>
    </>
  );
}
