import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../../api/client";
import {
  Banner, Card, Empty, Loading, Stat, Table, Tabs, rupees,
} from "../../components/ui";
import DateFilter, { todayRange } from "../../components/DateFilter";
import {
  IconAlertTriangle, IconCategories, IconChartLine, IconCustomers, IconInventory, IconOffers, IconOrders,
  IconPayments, IconProducts, IconUserPlus, IconWallet,
} from "../../components/Icons";
import { Avatar } from "../orders/Orders";

const CHART_COLOURS = ["#1f9a52", "#2f6df6", "#e0a100", "#7c5cdb", "#e0457b", "#0e8f8f"];

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--shadow)",
};

export default function Reports() {
  const [tab, setTab] = useState("sales");
  // Opens on Today; the field above the tabs switches to any other range.
  const [range, setRange] = useState(todayRange);

  return (
    <div className="page products-page reports-page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
        </div>
        {tab !== "inventory" ? <DateFilter value={range} onChange={setRange} /> : null}
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

// A small bar showing one figure's share of the biggest in the list.
function ShareBar({ value, max, tone }) {
  const pct = max ? Math.max(2, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <span className="level-bar share-bar" aria-hidden="true">
      <span className={`level-fill${tone ? ` ${tone}` : ""}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

const Rank = ({ n }) => <span className={`rank rank-${n <= 3 ? n : "x"}`}>{n}</span>;

function Sales({ range }) {
  const { data, loading, error } = useReport("/reports/sales", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const totals = data?.totals || {};
  const raw = data?.rows || [];
  const rows = raw.map((row) => ({
    period: row.period,
    orders: row.orders,
    net: Math.round(row.net / 100),
  }));

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Net sales" value={rupees(totals.net)} foot={`${totals.orders || 0} ${totals.orders === 1 ? "order" : "orders"}`} icon={IconChartLine} hue="green" />
        <Stat label="Average order" value={rupees(totals.averageOrderValue)} icon={IconOrders} hue="blue" />
        <Stat label="Discounts given" value={rupees(totals.discounts)} icon={IconOffers} hue="amber" />
        <Stat label="Tax collected" value={rupees(totals.tax)} foot="Included in the prices shown" icon={IconWallet} hue="violet" />
      </div>

      <Card title="Sales by day">
        {rows.length ? (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              {rows.length > 1 ? (
                <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.35 }} />
                      <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => (name === "net" ? [`₹${value}`, "Sales"] : [value, "Orders"])} />
                  <Area type="monotone" dataKey="net" stroke="var(--accent)" strokeWidth={3} fill="url(#salesFill)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              ) : (
                <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={TOOLTIP_STYLE} formatter={(value) => [`₹${value}`, "Sales"]} />
                  <Bar dataKey="net" fill="var(--accent)" radius={[10, 10, 0, 0]} maxBarSize={90} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty title="No sales in this window" />
        )}
      </Card>

      {raw.length ? (
        <Card title="Day by day" tight style={{ marginTop: 16 }}>
          <Table
            title="Sales by day"
            columns={[
              { key: "period", label: "Date", render: (row) => <span className="row-title">{row.period}</span> },
              { key: "orders", label: "Orders", align: "right", render: (row) => <span className="count-pill">{row.orders}</span> },
              { key: "units", label: "Units", align: "right" },
              { key: "gross", label: "Before discounts", align: "right", render: (row) => rupees(row.gross) },
              { key: "discounts", label: "Discounts", align: "right", render: (row) => (row.discounts ? <span style={{ color: "var(--chip-amber-fg)" }}>− {rupees(row.discounts)}</span> : "—") },
              { key: "tax", label: "Tax", align: "right", render: (row) => rupees(row.tax) },
              { key: "net", label: "Net sales", align: "right", render: (row) => <strong>{rupees(row.net)}</strong> },
            ]}
            rows={raw}
            keyOf={(row) => row.period}
          />
        </Card>
      ) : null}
    </>
  );
}

function Products({ range }) {
  const { data, loading, error } = useReport("/reports/products", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const products = data?.products || [];
  const top = Math.max(...products.map((p) => p.revenue || 0), 0);
  const totalRevenue = products.reduce((n, p) => n + (p.revenue || 0), 0);
  const totalUnits = products.reduce((n, p) => n + (p.units || 0), 0);
  const chart = products.slice(0, 8).map((p) => ({ name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name, revenue: Math.round(p.revenue / 100) }));

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Products sold" value={products.length} icon={IconProducts} hue="green" />
        <Stat label="Units sold" value={totalUnits} icon={IconOrders} hue="blue" />
        <Stat label="Revenue" value={rupees(totalRevenue)} icon={IconChartLine} hue="violet" />
        <Stat label="Best seller" value={products[0]?.name || "—"} foot={products[0] ? rupees(products[0].revenue) : undefined} icon={IconOffers} hue="amber" />
      </div>

      <div className="grid split">
        <Card title="Best sellers" tight>
          <Table
            title="Best sellers"
            columns={[
              { key: "rank", label: "#", sortable: false, exportable: false, render: (row) => <Rank n={products.indexOf(row) + 1} /> },
              { key: "name", label: "Product", render: (row) => <span className="row-title">{row.name}</span> },
              { key: "units", label: "Units", align: "right" },
              { key: "orders", label: "Orders", align: "right" },
              { key: "share", label: "Share", sortable: false, exportable: false, render: (row) => <ShareBar value={row.revenue} max={top} /> },
              { key: "revenue", label: "Revenue", align: "right", render: (row) => <strong>{rupees(row.revenue)}</strong> },
            ]}
            rows={products}
            empty={<Empty title="Nothing sold in this window" />}
          />
        </Card>

        <Card title="Top by revenue">
          {chart.length ? (
            <div style={{ width: "100%", height: Math.max(220, chart.length * 38) }}>
              <ResponsiveContainer>
                <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis type="number" tickLine={false} axisLine={false} style={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                  <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={TOOLTIP_STYLE} formatter={(value) => [`₹${value}`, "Revenue"]} />
                  <Bar dataKey="revenue" radius={[0, 8, 8, 0]} maxBarSize={22}>
                    {chart.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No data" />
          )}
        </Card>
      </div>
    </>
  );
}

function Categories({ range }) {
  const { data, loading, error } = useReport("/reports/categories", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const categories = data?.categories || [];
  const total = categories.reduce((n, c) => n + (c.revenue || 0), 0);
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
              render: (row) => {
                const index = categories.indexOf(row);
                return (
                  <span className="inline" style={{ gap: 10 }}>
                    <span className="legend-dot" style={{ background: index < 6 ? CHART_COLOURS[index] : "var(--border-strong, #cbd5cf)" }} />
                    <span className="row-title">{row.name}</span>
                  </span>
                );
              },
            },
            { key: "units", label: "Units", align: "right" },
            { key: "share", label: "Share", align: "right", sortable: false, exportable: false, render: (row) => (total ? `${Math.round((row.revenue / total) * 100)}%` : "—") },
            { key: "revenue", label: "Revenue", align: "right", render: (row) => <strong>{rupees(row.revenue)}</strong> },
          ]}
          rows={categories}
          empty={<Empty title="No category sales yet" />}
        />
      </Card>

      <Card title="Share of revenue">
        {pie.length ? (
          <div className="donut-wrap">
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3} cornerRadius={6}>
                    {pie.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => `₹${value}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="donut-center">
              <span>Total</span>
              <strong>{rupees(total)}</strong>
            </div>
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
  const top = data?.top || [];
  const best = Math.max(...top.map((c) => c.spend || 0), 0);

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Total customers" value={summary.totalCustomers ?? 0} icon={IconCustomers} hue="green" />
        <Stat label="New in this window" value={summary.newCustomers ?? 0} icon={IconUserPlus} hue="blue" />
        <Stat label="Ordered more than once" value={summary.repeatCustomers ?? 0} icon={IconOrders} hue="violet" />
        <Stat label="Average spend" value={rupees(summary.averageSpend)} icon={IconWallet} hue="amber" />
      </div>

      <Card title="Top customers" tight>
        <Table
          title="Top customers"
          columns={[
            { key: "rank", label: "#", sortable: false, exportable: false, render: (row) => <Rank n={top.indexOf(row) + 1} /> },
            {
              key: "name",
              label: "Customer",
              render: (row) => (
                <span className="person-cell">
                  <Avatar name={row.name || row.phone} />
                  <span className="stack">
                    <span className="row-title">{row.name || "—"}</span>
                    <span className="row-sub">{row.phone}</span>
                  </span>
                </span>
              ),
            },
            { key: "orders", label: "Orders", align: "right", render: (row) => <span className="count-pill">{row.orders}</span> },
            { key: "share", label: "", sortable: false, exportable: false, render: (row) => <ShareBar value={row.spend} max={best} /> },
            { key: "spend", label: "Spend", align: "right", render: (row) => <strong>{rupees(row.spend)}</strong> },
          ]}
          rows={top}
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

  const methods = data?.methods || [];
  const captured = methods.reduce((n, m) => n + (m.captured || 0), 0);
  const attempts = methods.reduce((n, m) => n + (m.count || 0), 0);
  const failed = methods.reduce((n, m) => n + (m.failed || 0), 0);
  const refunded = methods.reduce((n, m) => n + (m.refunded || 0), 0);
  const topCaptured = Math.max(...methods.map((m) => m.captured || 0), 0);

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Captured" value={rupees(captured)} icon={IconPayments} hue="green" />
        <Stat label="Attempts" value={attempts} icon={IconOrders} hue="blue" />
        <Stat label="Failed" value={failed} icon={IconAlertTriangle} hue={failed ? "red" : "green"} />
        <Stat label="Refunded" value={rupees(refunded)} icon={IconWallet} hue="amber" />
      </div>

      <Card title="How people paid" tight>
        <Table
          title="Payment methods"
          columns={[
            { key: "method", label: "Method", render: (row) => <span className="reward-pill">{row.method.toUpperCase()}</span> },
            { key: "count", label: "Attempts", align: "right" },
            {
              key: "failed",
              label: "Failed",
              align: "right",
              render: (row) => (row.failed ? <span style={{ color: "var(--danger)" }}>{row.failed}</span> : "—"),
            },
            { key: "share", label: "Share", sortable: false, exportable: false, render: (row) => <ShareBar value={row.captured} max={topCaptured} /> },
            { key: "captured", label: "Captured", align: "right", render: (row) => <strong>{rupees(row.captured)}</strong> },
            {
              key: "refunded",
              label: "Refunded",
              align: "right",
              render: (row) => (row.refunded ? rupees(row.refunded) : "—"),
            },
          ]}
          rows={methods}
          keyOf={(row) => row.method}
          empty={<Empty title="No payments in this window" />}
        />
      </Card>
    </>
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
      <Stat label="Stock value" value={rupees(summary.stockValue)} foot="At cost, not retail" icon={IconWallet} hue="green" to="/inventory" />
      <Stat label="Units on hand" value={summary.units ?? 0} icon={IconInventory} hue="blue" to="/inventory" />
      <Stat label="Low stock" value={summary.lowStock ?? 0} icon={IconAlertTriangle} hue="amber" to="/inventory?tab=low" />
      <Stat label="Out of stock" value={summary.outOfStock ?? 0} icon={IconAlertTriangle} hue={summary.outOfStock ? "red" : "green"} to="/inventory?tab=out" />
      <Stat label="Expiring within 3 days" value={summary.expiringSoon ?? 0} icon={IconCategories} hue="violet" to="/inventory?tab=expiring" />
    </div>
  );
}

function Profit({ range }) {
  const { data, loading, error } = useReport("/reports/profit", range);
  if (loading) return <Loading />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const revenue = data?.revenue || 0;
  const cost = data?.cost || 0;
  const profit = data?.profit || 0;
  const costPct = revenue ? Math.min(100, Math.round((cost / revenue) * 100)) : 0;

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Revenue" value={rupees(revenue)} foot="Delivered orders" icon={IconChartLine} hue="blue" />
        <Stat label="Cost of goods" value={rupees(cost)} icon={IconInventory} hue="amber" />
        <Stat label="Gross profit" value={rupees(profit)} icon={IconWallet} hue={profit > 0 ? "green" : "red"} />
        <Stat label="Margin" value={`${data?.marginPct ?? 0}%`} foot={`${data?.units ?? 0} units`} icon={IconOffers} hue="violet" />
      </div>

      <Card title="Where the revenue goes">
        <div className="split-bar" role="img" aria-label={`Cost ${costPct}% of revenue`}>
          <span className="split-cost" style={{ width: `${costPct}%` }}>{costPct >= 12 ? `Cost ${costPct}%` : ""}</span>
          <span className={`split-profit${profit > 0 ? "" : " loss"}`} style={{ width: `${100 - costPct}%` }}>
            {100 - costPct >= 12 ? `Profit ${100 - costPct}%` : ""}
          </span>
        </div>
        <div className="split-legend">
          <span><i className="legend-dot" style={{ background: "var(--chip-amber-fg)" }} /> Cost of goods {rupees(cost)}</span>
          <span><i className="legend-dot" style={{ background: "var(--accent)" }} /> Gross profit {rupees(profit)}</span>
        </div>
      </Card>

      {/* The API's own caveat only — it states how the figure was derived, so
          dropping it would leave the number looking more exact than it is. */}
      {data?.note ? (
        <Card style={{ marginTop: 16 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{data.note}</p>
        </Card>
      ) : null}
    </>
  );
}
