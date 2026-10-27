import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../../api/client";
import {
  Banner, Card, DateRange, dateRange, Empty, Loading, Stat, Table, Tabs, rupees,
} from "../../components/ui";

const CHART_COLOURS = ["#2f6df6", "#0f9d58", "#b7791f", "#5a4cdb", "#d43b3b", "#0e7c5a"];

export default function Reports() {
  const [tab, setTab] = useState("sales");
  const [range, setRange] = useState(() => dateRange());

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
        </div>
        <DateRange value={range} onChange={setRange} />
      </div>

      <Tabs
        tabs={[
          { key: "sales", label: "Sales" },
          { key: "products", label: "Products" },
          { key: "categories", label: "Categories" },
          { key: "customers", label: "Customers" },
          { key: "payments", label: "Payments" },
          { key: "inventory", label: "Inventory" },
          { key: "profit", label: "Profit" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "sales" && <Sales range={range} />}
      {tab === "products" && <Products range={range} />}
      {tab === "categories" && <Categories range={range} />}
      {tab === "customers" && <CustomersReport range={range} />}
      {tab === "payments" && <Payments range={range} />}
      {tab === "inventory" && <InventoryReport />}
      {tab === "profit" && <Profit range={range} />}
    </div>
  );
}

function useReport(path, range, extra = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get(path, { ...range, ...extra })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, range.from, range.to]);

  return { data, loading, error };
}

function Sales({ range }) {
  const { data, loading, error } = useReport("/reports/sales", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const totals = data?.totals || {};
  const rows = (data?.rows || []).map((row) => ({
    period: row.period,
    orders: row.orders,
    net: Math.round(row.net / 100),
  }));

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <Stat label="Net sales" value={rupees(totals.net)} foot={`${totals.orders} orders`} />
        <Stat label="Average order" value={rupees(totals.averageOrderValue)} />
        <Stat label="Discounts given" value={rupees(totals.discounts)} tone="warn" />
        <Stat label="Tax collected" value={rupees(totals.tax)} foot="Included in the prices shown" />
      </div>

      <Card title="Sales by day">
        {rows.length ? (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => [name === "net" ? `₹${value}` : value, name === "net" ? "sales" : name]}
                />
                <Bar dataKey="net" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty title="No sales in this window" />
        )}
      </Card>
    </>
  );
}

function Products({ range }) {
  const { data, loading, error } = useReport("/reports/products", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <Card title="Best sellers" tight>
      <Table
        title="Best sellers"
        columns={[
          { key: "name", label: "Product", render: (row) => <span className="row-title">{row.name}</span> },
          { key: "units", label: "Units", align: "right" },
          { key: "orders", label: "Orders", align: "right" },
          { key: "revenue", label: "Revenue", align: "right", render: (row) => <strong>{rupees(row.revenue)}</strong> },
        ]}
        rows={data?.products || []}
        empty={<Empty title="Nothing sold in this window" />}
      />
    </Card>
  );
}

function Categories({ range }) {
  const { data, loading, error } = useReport("/reports/categories", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const categories = data?.categories || [];
  const pie = categories.slice(0, 6).map((c) => ({ name: c.name, value: Math.round(c.revenue / 100) }));

  return (
    <div className="grid split">
      <Card title="Revenue by department" tight>
        <Table
          title="Revenue by department"
          columns={[
            {
              key: "name",
              label: "Department",
              render: (row) => <span className="row-title">{row.name}</span>,
            },
            { key: "units", label: "Units", align: "right" },
            { key: "revenue", label: "Revenue", align: "right", render: (row) => <strong>{rupees(row.revenue)}</strong> },
          ]}
          rows={categories}
          empty={<Empty title="No category sales yet" />}
        />
      </Card>

      <Card title="Share">
        {pie.length ? (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {pie.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => `₹${value}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty title="No data" />
        )}
      </Card>
    </div>
  );
}

function CustomersReport({ range }) {
  const { data, loading, error } = useReport("/reports/customers", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const summary = data?.summary || {};

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <Stat label="Total customers" value={summary.totalCustomers ?? 0} />
        <Stat label="New in this window" value={summary.newCustomers ?? 0} tone="ok" />
        <Stat label="Ordered more than once" value={summary.repeatCustomers ?? 0} />
        <Stat label="Average spend" value={rupees(summary.averageSpend)} />
      </div>

      <Card title="Top customers" tight>
        <Table
          title="Top customers"
          columns={[
            {
              key: "name",
              label: "Customer",
              render: (row) => (
                <div className="stack">
                  <span className="row-title">{row.name || "—"}</span>
                  <span className="row-sub">{row.phone}</span>
                </div>
              ),
            },
            { key: "orders", label: "Orders", align: "right" },
            { key: "spend", label: "Spend", align: "right", render: (row) => <strong>{rupees(row.spend)}</strong> },
          ]}
          rows={data?.top || []}
          empty={<Empty title="No customer activity in this window" />}
        />
      </Card>
    </>
  );
}

function Payments({ range }) {
  const { data, loading, error } = useReport("/reports/payments", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <Card title="How people paid" tight>
      <Table
        title="Payment methods"
        columns={[
          { key: "method", label: "Method", render: (row) => <span className="row-title">{row.method.toUpperCase()}</span> },
          { key: "count", label: "Attempts", align: "right" },
          {
            key: "failed",
            label: "Failed",
            align: "right",
            render: (row) => (row.failed ? <span style={{ color: "var(--danger)" }}>{row.failed}</span> : "—"),
          },
          { key: "captured", label: "Captured", align: "right", render: (row) => <strong>{rupees(row.captured)}</strong> },
          {
            key: "refunded",
            label: "Refunded",
            align: "right",
            render: (row) => (row.refunded ? rupees(row.refunded) : "—"),
          },
        ]}
        rows={data?.methods || []}
        keyOf={(row) => row.method}
        empty={<Empty title="No payments in this window" />}
      />
    </Card>
  );
}

function InventoryReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reports/inventory").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  const summary = data?.summary || {};

  return (
    <div className="grid cols-4">
      <Stat label="Stock value" value={rupees(summary.stockValue)} foot="At cost, not retail" />
      <Stat label="Units on hand" value={summary.units ?? 0} />
      <Stat label="Low stock" value={summary.lowStock ?? 0} tone={summary.lowStock ? "warn" : undefined} />
      <Stat label="Out of stock" value={summary.outOfStock ?? 0} tone={summary.outOfStock ? "danger" : undefined} />
      <Stat label="Expiring within 3 days" value={summary.expiringSoon ?? 0} tone={summary.expiringSoon ? "warn" : undefined} />
    </div>
  );
}

function Profit({ range }) {
  const { data, loading, error } = useReport("/reports/profit", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <Stat label="Revenue" value={rupees(data?.revenue)} foot="Delivered orders" />
        <Stat label="Cost of goods" value={rupees(data?.cost)} />
        <Stat label="Gross profit" value={rupees(data?.profit)} tone={data?.profit > 0 ? "ok" : "danger"} />
        <Stat label="Margin" value={`${data?.marginPct ?? 0}%`} foot={`${data?.units ?? 0} units`} />
      </div>

      {/* The API's own caveat only — it states how the figure was derived, so
          dropping it would leave the number looking more exact than it is. */}
      {data?.note ? (
        <Card>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{data.note}</p>
        </Card>
      ) : null}
    </>
  );
}
