import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Avatar } from "./orders/Orders";
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
  IconDelivery,
  IconShield,
} from "../components/Icons";

// Slides for the banner at the top of the dashboard. Each one is a shortcut
// to the screen an admin is most likely to want next.
const PROMO_SLIDES = [
  { title: "Fresh Groceries", accent: "Better Living", text: "Quality products, delivered with care.", cta: "View Catalog", to: "/catalog/products" },
  { title: "Orders on the move", accent: "Keep them flowing", text: "Check what is new, packed and out for delivery.", cta: "Open Orders", to: "/orders" },
  { title: "Shelves stay full", accent: "Never miss a sale", text: "See what is running low before it runs out.", cta: "Review Stock", to: "/inventory" },
];

function PromoBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = (step) => setIndex((i) => (i + step + PROMO_SLIDES.length) % PROMO_SLIDES.length);

  // Slides across by itself every five seconds; holds still while the cursor
  // is over the banner, and restarts its count after any manual change.
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % PROMO_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, [paused, index]);

  return (
    <section
      className="promo"
      aria-roledescription="carousel"
      aria-label="Shortcuts"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="promo-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {PROMO_SLIDES.map((slide, i) => (
          <div
            key={slide.to}
            className={`promo-slide s${i % 3}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${PROMO_SLIDES.length}`}
            aria-hidden={i !== index}
          >
            <div className="promo-copy">
              <h2>
                {slide.title}
                <br />
                {slide.accent}
              </h2>
              <p>{slide.text}</p>
              <Link to={slide.to} className="promo-cta" tabIndex={i === index ? 0 : -1}>
                {slide.cta}
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="promo-arrow left" onClick={() => go(-1)} aria-label="Previous">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
      </button>
      <button type="button" className="promo-arrow right" onClick={() => go(1)} aria-label="Next">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </button>
      <div className="promo-dots">
        {PROMO_SLIDES.map((_, i) => (
          <button key={i} type="button" className={i === index ? "on" : ""} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`} />
        ))}
      </div>
    </section>
  );
}

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

const sum14 = (arr, key) => arr.reduce((total, row) => total + (row[key] || 0), 0);

function orderTone(status) {
  if (status === "DELIVERED") return "ok";
  if (status === "CANCELLED" || status === "REJECTED") return "danger";
  if (status === "PAYMENT_PENDING") return "warn";
  return "info";
}

function pctChange(current, previous) {
  if (previous > 0) return ((current - previous) / previous) * 100;
  return current > 0 ? 100 : 0;
}

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
const PAGE_SIZE = 5;

// Footer of a dashboard list card: Previous / Next through five rows at a time.
function Pager({ page, total, onPage }) {
  if (total <= PAGE_SIZE) return null;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);
  return (
    <div className="dash-pager">
      <button type="button" className="btn sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        ‹ Previous
      </button>
      <span className="faint">
        {first}–{last} of {total}
      </span>
      <button type="button" className="btn sm" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>
        Next ›
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { can, user } = useAuth();
  const [metric, setMetric] = useState("revenue");
  const navigate = useNavigate();
  // A row that opens its product when clicked (or Enter/Space when focused).
  const openProduct = (id) =>
    id
      ? {
          onClick: () => navigate(`/catalog/products/${id}`),
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(`/catalog/products/${id}`);
            }
          },
          role: "link",
          tabIndex: 0,
          style: { cursor: "pointer" },
          title: "Open product",
        }
      : {};
  // Every list card is the same fixed size and shows five rows at a time;
  // Previous / Next step through the rest.
  const [pages, setPages] = useState({});
  const pageOf = (rows, key) => rows.slice((pages[key] || 0) * PAGE_SIZE, ((pages[key] || 0) + 1) * PAGE_SIZE);
  const goPage = (key, next) => setPages((p) => ({ ...p, [key]: next }));
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [lowStock, setLowStock] = useState([]);
  const [outOfStock, setOutOfStock] = useState({ items: [], total: 0 });
  const [tickets, setTickets] = useState([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      can("reports.view")
        ? api.get("/reports/dashboard")
        : Promise.resolve(null),
      can("orders.view")
        ? api.get("/orders", { limit: 30 })
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
        ? api.get("/reports/products", { limit: 50 })
        : Promise.resolve({ products: [] }),
      can("inventory.view")
        ? api.get("/inventory/out-of-stock", { limit: 50 })
        : Promise.resolve({ items: [], meta: null }),
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
          outData,
        ]) => {
          setData(dashboard);
          setOrders(orderData.items || []);
          setOrdersTotal(orderData.meta?.total || 0);
          setLowStock(stockData.items || []);
          setTickets(ticketData.items || []);
          setProductsTotal(productData.meta?.total || 0);
          setCustomersTotal(customerData.meta?.total || 0);
          setTopProducts(topProductData.products || []);
          setOutOfStock({ items: outData.items || [], total: outData.meta?.total || 0 });
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
    orders: row.orders,
  }));
  const periodRevenue = sum14(daily, "revenue");
  const periodOrders = sum14(daily, "orders");
  const avgOrder = periodOrders ? Math.round(periodRevenue / periodOrders) : 0;
  const bestDay = chart.reduce((best, row) => (row.revenue > (best?.revenue || 0) ? row : best), null);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user?.name || "").trim().split(/\s+/)[0];

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
    <div className="page dash-page">
      <div className="page-head dash-head">
        <div>
          <h1>
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div className="dash-head-actions">
          {can("orders.view") && (lifetime.pendingOrders ?? 0) > 0 ? (
            <Link className="dash-alert amber" to={`/orders?status=${PENDING_ORDER_STATUSES}`}>
              <span className="dash-alert-dot" />
              {lifetime.pendingOrders} pending {lifetime.pendingOrders === 1 ? "order" : "orders"}
            </Link>
          ) : null}
          {can("inventory.view") && (data?.lowStockCount ?? 0) > 0 ? (
            <Link className="dash-alert red" to="/inventory">
              <span className="dash-alert-dot" />
              {data.lowStockCount} low on stock
            </Link>
          ) : null}
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="grid cols-6" style={{ marginBottom: 14 }}>
        <Stat
          icon={IconWallet}
          hue="green"
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
          hue="violet"
          label="Total Customers"
          value={customersTotal}
          foot="View customers"
          to="/customers"
        />
        <Stat
          icon={IconProducts}
          hue="orange"
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

      <div className="grid dashboard-3" style={{ marginBottom: 14 }}>
        <div className="dash-col">
          <PromoBanner />
          <Card
            className={`dash-fixed dash-top`}
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
                {pageOf(topProducts, "top").map((product, index) => (
                  <div className="rank-item row-link" key={product.id || product.name} {...openProduct(product.id)}>
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
            <Pager page={pages.top || 0} total={topProducts.length} onPage={(n) => goPage("top", n)} />
          </Card>

        </div>

        <div className="dash-col">
          <Card
            className="dash-fixed dash-sales"
            title="Sales Overview"
            actions={
              <div className="chip-row" role="tablist" aria-label="Metric">
                {[["revenue", "Revenue"], ["orders", "Orders"]].map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={metric === key} className={`cat-chip small${metric === key ? " on" : ""}`} onClick={() => setMetric(key)}>
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="sales-sum">
              <div>
                <span>Last 14 days</span>
                <strong>{rupees(periodRevenue)}</strong>
              </div>
              <div>
                <span>Orders</span>
                <strong>{periodOrders}</strong>
              </div>
              <div>
                <span>Avg. order</span>
                <strong>{rupees(avgOrder)}</strong>
              </div>
              <div>
                <span>Best day</span>
                <strong>{bestDay ? bestDay.day : "—"}</strong>
              </div>
            </div>
            {periodRevenue > 0 || periodOrders > 0 ? (
              <div style={{ width: "100%", flex: 1, minHeight: 240 }}>
                <ResponsiveContainer>
                  <AreaChart
                    data={chart}
                    margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
                  >
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={18}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 12 }}
                      tickFormatter={(v) => (metric === "revenue" ? rupees(v) : v)}
                      width={70}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--border-strong)" }}
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      formatter={(value) => (metric === "revenue" ? [rupees(value), "Revenue"] : [value, "Orders"])}
                    />
                    <Area
                      type="monotone"
                      dataKey={metric}
                      stroke="var(--accent)"
                      fill="url(#salesFill)"
                      strokeWidth={2.4}
                      dot={false}
                      activeDot={{ r: 5 }}
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
            className={`dash-fixed dash-low`}
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
                    {pageOf(lowStock, "low").map((row) => {
                      const image = row.product?.media?.find((m) => m.type === "image")?.url;
                      return (
                        <tr key={row.id} className="row-link" {...openProduct(row.product?.id || row.product?._id)}>
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
            <Pager page={pages.low || 0} total={lowStock.length} onPage={(n) => goPage("low", n)} />
          </Card>
        </div>

        <div className="dash-col">
          <Card
            className={`dash-fixed dash-orders`}
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
                <table className="data recent-orders">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageOf(orders, "orders").map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link to={`/orders/${order.id}`} className="mono">
                            {order.code}
                          </Link>
                          <div className="row-sub">{when(order.placedAt)}</div>
                        </td>
                        <td>
                          <span className="person-cell">
                            <Avatar name={order.customerSnapshot?.name || order.customerSnapshot?.phone || "?"} size={30} />
                            <span className="stack">
                              <span className="row-title">{order.customerSnapshot?.name || "—"}</span>
                              <span className="row-sub">
                                {order.customerSnapshot?.phone}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>
                          <Pill tone={orderTone(order.status)}>
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
            <Pager page={pages.orders || 0} total={orders.length} onPage={(n) => goPage("orders", n)} />
          </Card>

          {can("inventory.view") ? (
            <Card
              className={`dash-fixed dash-out`}
              title={`Out of Stock${outOfStock.total ? ` (${outOfStock.total})` : ""}`}
              actions={
                <Link className="btn sm" to="/inventory?tab=out">
                  View all
                </Link>
              }
              tight
            >
              {outOfStock.items.length ? (
                <div className="table-wrap">
                  <table className="data">
                    <tbody>
                      {pageOf(outOfStock.items, "out").map((row) => {
                        const image = row.product?.media?.find((m) => m.type === "image")?.url;
                        return (
                          <tr key={row.id} className="row-link" {...openProduct(row.product?.id || row.product?._id)}>
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
                                  <span className="row-title">{row.product?.name}</span>
                                  <span className="row-sub">
                                    {[row.variant?.name, row.store?.name].filter(Boolean).join(" · ")}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="num">
                              <Pill tone="danger">{row.neverStocked ? "Never stocked" : "Out of stock"}</Pill>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="Everything is in stock" hint="Every item on sale has at least one unit available." />
              )}
              <Pager page={pages.out || 0} total={outOfStock.items.length} onPage={(n) => goPage("out", n)} />
            </Card>
          ) : null}


          {tickets.length ? (
            <Card
              className="dash-tix"
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
      </div>

      <div className="quick-grid">
        {[
          { to: "/catalog/products", label: "Products", icon: IconProducts, hue: "orange", perm: "catalog.view" },
          { to: "/orders", label: "Orders", icon: IconOrders, hue: "blue", perm: "orders.view" },
          { to: "/inventory", label: "Inventory", icon: IconInventory, hue: "red", perm: "inventory.view" },
          { to: "/customers", label: "Customers", icon: IconCustomers, hue: "violet", perm: "customers.view" },
          { to: "/delivery", label: "Delivery", icon: IconDelivery, hue: "indigo", perm: "delivery.view" },
          { to: "/support", label: "Support", icon: IconSupport, hue: "pink", perm: "customers.view" },
          { to: "/reports", label: "Reports", icon: IconChartLine, hue: "green", perm: "reports.view" },
        ]
          .filter((item) => can(item.perm))
          .map(({ to, label, icon: Icon, hue }) => (
            <Link key={to} to={to} className="quick-tile">
              <span className={`icon-chip ${hue}`}>
                <Icon />
              </span>
              <strong>{label}</strong>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          ))}
      </div>
    </div>
  );
}
