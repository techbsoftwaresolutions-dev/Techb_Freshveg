import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Banner,
  Card,
  Empty,
  Loading,
  Pill,
  Stat,
  rupees,
  when,
} from "../components/ui";
import {
  IconWallet,
  IconOrders,
  IconCustomers,
  IconProducts,
  IconAlertTriangle,
  IconInventory,
  IconSupport,
  IconChartLine,
  IconCategories,
  IconOffers,
  IconSettings,
  IconReviews,
  IconMaintenance,
  IconBanners,
  IconAudit,
  IconDelivery,
  IconShield,
} from "../components/Icons";

// Builds a fully-populated 14-day series (UTC-dated, matching how the
// backend groups `trend`) so a missing day reads as zero rather than
// quietly shifting every later day one slot to the left.
function buildDailySeries(trendRows) {
  const byDate = new Map((trendRows || []).map((row) => [row.date, row]));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    days.push({
      date: key,
      orders: row?.orders || 0,
      revenue: row?.revenue || 0,
    });
  }
  return days;
}

function pctChange(current, previous) {
  if (previous > 0) return ((current - previous) / previous) * 100;
  return current > 0 ? 100 : 0;
}

// An audit diff on an image field reads as a full upload URL (scheme, host,
// port, /uploads/...) — useless as a glance-able activity line. Show just the
// file name; the full path is one click away on the Audit Log page.
function cleanSummary(text) {
  if (!text) return text;
  return text.replace(/https?:\/\/\S+/g, (url) => {
    const trimmed = url.replace(/[),.]+$/, "");
    return trimmed.split("/").pop() || trimmed;
  });
}

const ACTIVITY_ICONS = {
  Product: IconProducts,
  Category: IconCategories,
  Order: IconOrders,
  Customer: IconCustomers,
  Offer: IconOffers,
  Settings: IconSettings,
  Review: IconReviews,
  SupportTicket: IconSupport,
  MaintenanceAsset: IconMaintenance,
  Banner: IconBanners,
};

// Matches the backend's own definition of "pending" for lifetime.pendingOrders
// (report.routes.js): every status except the three that mean the order is
// done, one way or another.
const PENDING_ORDER_STATUSES = [
  "ORDER_PLACED",
  "PAYMENT_PENDING",
  "ORDER_CONFIRMED",
  "ORDER_ACCEPTED",
  "PICKING",
  "PACKING",
  "READY_FOR_PICKUP",
  "ASSIGNED_TO_DELIVERY",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
].join(",");

// One call to /reports/dashboard rather than the six list endpoints this used
// to stitch together — the aggregation belongs on the server, where it can see
// every order rather than the most recent fifty.
export default function Dashboard() {
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [lowStock, setLowStock] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      can("reports.view")
        ? api.get("/reports/dashboard")
        : Promise.resolve(null),
      can("orders.view")
        ? api.get("/orders", { limit: 8 })
        : Promise.resolve({ items: [], meta: null }),
      can("inventory.view")
        ? api.get("/inventory/low-stock")
        : Promise.resolve({ items: [] }),
      can("customers.view")
        ? api.get("/support", { open: "true", limit: 5 })
        : Promise.resolve({ items: [] }),
      can("catalog.view")
        ? api.get("/catalog/products", { limit: 1 })
        : Promise.resolve({ meta: null }),
      can("customers.view")
        ? api.get("/customers", { limit: 1 })
        : Promise.resolve({ meta: null }),
      can("reports.view")
        ? api.get("/reports/products", { limit: 5 })
        : Promise.resolve({ products: [] }),
      can("reports.view")
        ? api.get("/audit", { limit: 6 })
        : Promise.resolve({ items: [] }),
    ])
      .then(
        ([
          dashboard,
          orderData,
          stockData,
          ticketData,
          productData,
          customerData,
          topProductData,
          activityData,
        ]) => {
          setData(dashboard);
          setOrders(orderData.items || []);
          setOrdersTotal(orderData.meta?.total || 0);
          setLowStock(stockData.items || []);
          setTickets(ticketData.items || []);
          setProductsTotal(productData.meta?.total || 0);
          setCustomersTotal(customerData.meta?.total || 0);
          setTopProducts(topProductData.products || []);
          setActivity(activityData.items || []);
        },
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [can]);

  if (loading)
    return (
      <div className="page">
        <Loading />
      </div>
    );

  const today = data?.today || {};
  const lifetime = data?.lifetime || {};
  const daily = buildDailySeries(data?.trend);
  const chart = daily.map((row) => ({
    day: new Date(row.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
    revenue: row.revenue,
  }));

  const lastWeek = daily.slice(0, 7);
  const thisWeek = daily.slice(7, 14);
  const sum = (arr, key) => arr.reduce((total, row) => total + row[key], 0);
  const revenueTrend = pctChange(
    sum(thisWeek, "revenue"),
    sum(lastWeek, "revenue"),
  );
  const ordersTrend = pctChange(
    sum(thisWeek, "orders"),
    sum(lastWeek, "orders"),
  );
  const revenueSpark = thisWeek.map((row) => row.revenue);
  const ordersSpark = thisWeek.map((row) => row.orders);

  const maxProductRevenue = Math.max(
    1,
    ...topProducts.map((p) => p.revenue || 0),
  );

  return (
    <div className="page">
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-6" style={{ marginBottom: 14 }}>
        <Stat
          icon={IconWallet}
          hue="violet"
          label="Total Revenue"
          value={rupees(lifetime.revenue)}
          trend={revenueTrend}
          spark={revenueSpark}
          foot={`${rupees(today.revenue)} today`}
          to="/reports"
        />
        <Stat
          icon={IconOrders}
          hue="blue"
          label="Total Orders"
          value={ordersTotal}
          trend={ordersTrend}
          spark={ordersSpark}
          foot={`${today.orders ?? 0} placed today`}
          to="/orders"
        />
        <Stat
          icon={IconCustomers}
          hue="green"
          label="Total Customers"
          value={customersTotal}
          foot="View customers"
          to="/customers"
        />
        <Stat
          icon={IconProducts}
          hue="indigo"
          label="Total Products"
          value={productsTotal}
          foot="View catalog"
          to="/catalog/products"
        />
        <Stat
          icon={IconAlertTriangle}
          hue="amber"
          label="Pending Orders"
          value={lifetime.pendingOrders ?? 0}
          foot="Not yet delivered"
          to={`/orders?status=${PENDING_ORDER_STATUSES}`}
        />
        <Stat
          icon={IconInventory}
          hue="red"
          label="Low Stock Items"
          value={data?.lowStockCount ?? 0}
          tone={data?.lowStockCount ? "danger" : undefined}
          foot="Review stock"
          to="/inventory"
        />
      </div>

      <div className="grid dashboard-cols" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <Card
            title="Sales Overview"
            actions={
              <span className="faint" style={{ fontSize: 12 }}>
                Last 14 days
              </span>
            }
          >
            {chart.some((row) => row.revenue > 0) ? (
              <div style={{ width: "100%", height: 250 }}>
                <ResponsiveContainer>
                  <AreaChart
                    data={chart}
                    margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 12 }}
                      tickFormatter={(v) => rupees(v)}
                      width={70}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--border-strong)" }}
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value) => [rupees(value), "Revenue"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--accent)"
                      fill="var(--accent-soft)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty
                icon={IconChartLine}
                title="No orders yet"
                hint="They will appear here as they come in."
              />
            )}
          </Card>

          <Card
            title="Recent Orders"
            actions={
              <Link className="btn sm" to="/orders">
                View all
              </Link>
            }
            tight
          >
            {orders.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link to={`/orders/${order.id}`} className="mono">
                            {order.code}
                          </Link>
                          <div className="row-sub">{when(order.placedAt)}</div>
                        </td>
                        <td>
                          <div className="stack">
                            <span>{order.customerSnapshot?.name || "—"}</span>
                            <span className="row-sub">
                              {order.customerSnapshot?.phone}
                            </span>
                          </div>
                        </td>
                        <td>
                          <Pill
                            tone={order.status === "DELIVERED" ? "ok" : "info"}
                          >
                            {order.status.replace(/_/g, " ").toLowerCase()}
                          </Pill>
                        </td>
                        <td className="num">
                          <strong>{rupees(order.pricing?.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No orders yet" />
            )}
          </Card>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <Card
            title="Top Selling Products"
            actions={
              <Link className="btn sm" to="/reports">
                View all
              </Link>
            }
            tight
          >
            {topProducts.length ? (
              <div className="rank-list">
                {topProducts.map((product, index) => (
                  <div className="rank-item" key={product.id || product.name}>
                    <span className="rank-num">{index + 1}</span>
                    {product.image ? (
                      <img src={product.image} alt="" className="rank-thumb" />
                    ) : (
                      <span className="rank-thumb rank-thumb-fallback">
                        <IconProducts />
                      </span>
                    )}
                    <div className="rank-body">
                      <div className="rank-row">
                        <span className="row-title">{product.name}</span>
                        <strong>{rupees(product.revenue)}</strong>
                      </div>
                      <div className="row-sub">{product.units} units</div>
                      <div className="rank-bar">
                        <span
                          style={{
                            width: `${Math.round(((product.revenue || 0) / maxProductRevenue) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No sales yet"
                hint="Top sellers show up once orders come in."
              />
            )}
          </Card>

          <Card
            title="Running Low Stock"
            actions={
              <Link className="btn sm" to="/inventory">
                Inventory
              </Link>
            }
            tight
          >
            {lowStock.length ? (
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    {lowStock.slice(0, 6).map((row) => {
                      const image = row.product?.media?.find((m) => m.type === "image")?.url;
                      return (
                        <tr key={row.id}>
                          <td>
                            <div className="inline" style={{ gap: 10 }}>
                              {image ? (
                                <img src={image} alt="" className="rank-thumb" />
                              ) : (
                                <span className="rank-thumb rank-thumb-fallback">
                                  <IconProducts />
                                </span>
                              )}
                              <div className="stack">
                                <span className="row-title">
                                  {row.product?.name}
                                </span>
                                <span className="row-sub">{row.variant?.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="num">
                            <Pill tone={row.available <= 0 ? "danger" : "warn"}>
                              {row.available} left
                            </Pill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Stock looks healthy"
                hint="Nothing is below its threshold."
              />
            )}
          </Card>

          {tickets.length ? (
            <Card
              title="Open Support Tickets"
              actions={
                <Link className="btn sm" to="/support">
                  Support
                </Link>
              }
              tight
            >
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <div className="stack">
                            <span className="row-title">{ticket.subject}</span>
                            <span className="row-sub mono">{ticket.code}</span>
                          </div>
                        </td>
                        <td className="right">
                          <Pill
                            tone={
                              ticket.priority === "high" ||
                              ticket.priority === "urgent"
                                ? "danger"
                                : undefined
                            }
                          >
                            {ticket.priority}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>

        <Card
          title="Recent Activity"
          actions={
            <Link className="btn sm" to="/settings/audit">
              View all
            </Link>
          }
          tight
        >
          {activity.length ? (
            <div className="activity-list">
              {activity.map((entry) => {
                const EntryIcon = ACTIVITY_ICONS[entry.entity] || IconAudit;
                const thumb = entry.thumbnail;
                return (
                  <div className="activity-item" key={entry.id}>
                    {thumb ? (
                      <img src={thumb} alt="" className="activity-icon activity-thumb" />
                    ) : (
                      <span className="activity-icon">
                        <EntryIcon />
                      </span>
                    )}
                    <div className="activity-body">
                      <div className="row-title">
                        {cleanSummary(entry.summary) || `${entry.action} ${entry.entity}`}
                      </div>
                      <div className="row-sub">
                        {entry.actorName || "System"}
                      </div>
                    </div>
                    <span className="activity-time">
                      {when(entry.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="No admin activity yet"
              hint="Staff changes will show up here."
            />
          )}
        </Card>
      </div>

      <div className="feature-row">
        <div className="feature-badge">
          <span className="icon-chip blue">
            <IconDelivery />
          </span>
          <div>
            <strong>Fast &amp; Reliable Delivery</strong>
            <span>We deliver your products safely.</span>
          </div>
        </div>
        <div className="feature-badge">
          <span className="icon-chip indigo">
            <IconShield />
          </span>
          <div>
            <strong>Secure Payments</strong>
            <span>UPI, card or cash on delivery.</span>
          </div>
        </div>
        <div className="feature-badge">
          <span className="icon-chip pink">
            <IconSupport />
          </span>
          <div>
            <strong>Support When You Need It</strong>
            <span>Reach us from the Support queue.</span>
          </div>
        </div>
        <div className="feature-badge">
          <span className="icon-chip amber">
            <IconReviews />
          </span>
          <div>
            <strong>Quality Products</strong>
            <span>Fresh &amp; trusted, checked before dispatch.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
