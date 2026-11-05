import Select from "../../components/Select";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, Tabs, when } from "../../components/ui";

// Three views over the same collection, because they answer three different
// questions a shop actually asks: what do I have, what is running out, and
// what will spoil.
const TABS = [
  { key: "stock", label: "Stock on hand" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
  { key: "expiring", label: "Expiring soon" },
  { key: "movements", label: "Movement log" },
];

export default function Inventory() {
  const { can } = useAuth();
  const editable = can("inventory.adjust");

  // ?tab=out opens a tab directly (the dashboard's Out of Stock card links here).
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "stock";
  const setTab = (key) => setParams(key === "stock" ? {} : { tab: key }, { replace: true });
  const [stores, setStores] = useState([]);
  const [store, setStore] = useState("");
  // `tab` records which view the rows belong to. Switching tabs renders once
  // with the previous tab's rows before the new request even starts, and a
  // stock row is not an expiring row (no `batches`) — drawing one as the other
  // is what blanked the whole page.
  const [data, setData] = useState({ items: [], meta: null, tab: null });
  const requestId = useRef(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(null);

  // Category and subcategory narrow every stock view (low stock included). The
  // subcategory is whichever child of the chosen category is picked; leaving it
  // on "All" covers the whole category.
  // The search box: what is typed, and what has been sent to the server after a
  // short pause so it is not asked on every keystroke.
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [tree, setTree] = useState([]);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const subcategories = tree.find((node) => node.id === category)?.children || [];
  const categoryFilter = subcategory || category;

  useEffect(() => {
    // Not every role can read the catalog; without it the filter just stays hidden.
    api
      .get("/catalog/categories/tree", { status: "active" })
      .then((res) => setTree(res.tree || []))
      .catch(() => setTree([]));
  }, []);

  useEffect(() => {
    api
      .get("/stores/public")
      .then(({ stores: list }) => {
        setStores(list);
        if (list.length) setStore(list[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const path =
      tab === "low" ? "/inventory/low-stock"
      : tab === "out" ? "/inventory/out-of-stock"
      : tab === "expiring" ? "/inventory/expiring"
      : tab === "movements" ? "/inventory/movements"
      : "/inventory";

    setError("");
    const mine = ++requestId.current;
    api
      .get(path, { store: store || undefined, category: categoryFilter || undefined, q: term || undefined, page, limit: 20 })
      .then((res) => mine === requestId.current && setData({ ...res, items: res.items || [], tab }))
      .catch((err) => {
        if (mine !== requestId.current) return;
        setError(err.message);
        setData({ items: [], meta: null, tab });
      })
      .finally(() => mine === requestId.current && setLoading(false));
  }, [tab, store, page, categoryFilter, term]);

  useEffect(() => {
    if (!store && tab !== "movements") return;
    load();
  }, [load, store, tab]);

  // The little numbers on the tabs: how many rows each view would show.
  const [counts, setCounts] = useState({});
  const loadCounts = useCallback(() => {
    if (!store) return;
    const paths = { stock: "/inventory", low: "/inventory/low-stock", out: "/inventory/out-of-stock", expiring: "/inventory/expiring" };
    Promise.all(
      Object.entries(paths).map(([key, path]) =>
        api
          .get(path, { store, limit: 1 })
          .then((res) => [key, res.meta?.total ?? res.items?.length ?? 0])
          .catch(() => [key, undefined])
      )
    ).then((pairs) => setCounts(Object.fromEntries(pairs)));
  }, [store]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const [notice, setNotice] = useState("");

  // One modal, three ways to change a count: set it (a stock-take), add to it
  // (goods received) or take some off (damaged / spoiled).
  async function changeStock({ mode, variant, quantity, reason, batchNo, expiresOn, costPrice }) {
    setError("");
    try {
      if (mode === "receive") {
        await api.post("/inventory/receive", {
          store, variant, quantity, reason,
          ...(batchNo ? { batchNo } : {}),
          ...(expiresOn ? { expiresOn } : {}),
          ...(costPrice ? { costPrice: Math.round(Number(costPrice) * 100) } : {}),
        });
        setNotice("Stock added.");
      } else if (mode === "damage") {
        await api.post("/inventory/damage", { store, variant, quantity, reason });
        setNotice("Written off — it's in the movement log.");
      } else {
        await api.post("/inventory/adjust", { store, variant, quantity, reason });
        setNotice("Count saved — the difference is in the movement log.");
      }
      setAdjusting(null);
      load();
      loadCounts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page products-page inventory-page">
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{notice}</Banner>

      <div className="inv-stats">
        <button type="button" className={`inv-stat ok${tab === "stock" ? " on" : ""}`} onClick={() => { setTab("stock"); setPage(1); }}>
          <span>In stock</span><strong>{counts.stock ?? "—"}</strong>
        </button>
        <button type="button" className={`inv-stat warn${tab === "low" ? " on" : ""}`} onClick={() => { setTab("low"); setPage(1); }}>
          <span>Running low</span><strong>{counts.low ?? "—"}</strong>
        </button>
        <button type="button" className={`inv-stat danger${tab === "out" ? " on" : ""}`} onClick={() => { setTab("out"); setPage(1); }}>
          <span>Out of stock</span><strong>{counts.out ?? "—"}</strong>
        </button>
        <button type="button" className={`inv-stat info${tab === "expiring" ? " on" : ""}`} onClick={() => { setTab("expiring"); setPage(1); }}>
          <span>Expiring soon</span><strong>{counts.expiring ?? "—"}</strong>
        </button>
      </div>

      <Tabs
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
        active={tab}
        onChange={(key) => {
          setTab(key);
          setPage(1);
        }}
      />

      <div className="toolbar products-filters inv-toolbar">
        {tab !== "movements" && (
          <span className="search-field">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="search"
              placeholder="Search item or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search inventory"
            />
          </span>
        )}
        {tree.length > 0 && tab !== "movements" && (
          <>
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory("");
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {tree.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </Select>
            <Select
              value={subcategory}
              onChange={(e) => {
                setSubcategory(e.target.value);
                setPage(1);
              }}
              disabled={!subcategories.length}
            >
              <option value="">{category ? "All subcategories" : "Subcategory"}</option>
              {subcategories.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </Select>
          </>
        )}
      </div>

      <Card tight>
        {loading || data.tab !== tab ? (
          <Loading />
        ) : tab === "movements" ? (
          <MovementTable rows={data.items} />
        ) : tab === "expiring" ? (
          <ExpiringTable rows={data.items} days={data.meta?.days} />
        ) : (
          <>
            <Table
              title="Stock levels"
              columns={[
                {
                  key: "product",
                  label: "Item",
                  render: (row) => (
                    <div className="row-with-media">
                      {row.product?.media?.[0]?.url ? (
                        <img className="row-media" src={row.product.media[0].url} alt="" />
                      ) : (
                        <span className="row-media row-media-empty" aria-hidden="true">{(row.product?.name || "?").charAt(0)}</span>
                      )}
                      <div className="stack">
                        <span className="row-title">{row.product?.name}</span>
                        <span className="row-sub">
                          {row.variant?.name} · <span className="tag">{row.variant?.sku}</span>
                        </span>
                      </div>
                    </div>
                  ),
                },
                { key: "onHand", label: "On hand", align: "right" },
                {
                  key: "reserved",
                  label: "Reserved",
                  align: "right",
                  render: (row) => (row.reserved ? <span className="muted">{row.reserved}</span> : "—"),
                },
                {
                  key: "available",
                  label: "Available",
                  align: "right",
                  render: (row) => (
                    <strong style={{ color: row.available <= 0 ? "var(--danger)" : undefined }}>
                      {row.available}
                    </strong>
                  ),
                },
                {
                  key: "level",
                  label: "Stock level",
                  sortable: false,
                  exportable: false,
                  render: (row) => {
                    const cap = Math.max((row.lowStockThreshold ?? row.variant?.lowStockThreshold ?? 5) * 3, row.onHand || 0, 1);
                    const pct = Math.max(0, Math.min(100, Math.round(((row.available || 0) / cap) * 100)));
                    const tone = row.available <= 0 ? "danger" : row.isLow ? "warn" : "ok";
                    return (
                      <span className="level-bar" aria-hidden="true">
                        <span className={`level-fill ${tone}`} style={{ width: `${pct}%` }} />
                      </span>
                    );
                  },
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) =>
                    row.neverStocked ? (
                      <Pill tone="danger">Never stocked</Pill>
                    ) : row.soldOut ? (
                      <Pill tone="danger">Marked sold out</Pill>
                    ) : row.available < 1 ? (
                      <Pill tone="danger">Out of stock</Pill>
                    ) : row.isLow ? (
                      <Pill tone="warn">Low</Pill>
                    ) : (
                      <Pill tone="ok">OK</Pill>
                    ),
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: (row) =>
                    editable && (
                      <span className="inv-actions">
                        <button className="btn sm primary" onClick={() => setAdjusting({ row, mode: "receive" })}>
                          + Add stock
                        </button>
                        <button className="btn sm" onClick={() => setAdjusting({ row, mode: "adjust" })}>
                          Adjust
                        </button>
                      </span>
                    ),
                },
              ]}
              rows={data.items}
              empty={
                <Empty
                  title={
                    tab === "low" ? "Nothing is running low"
                    : tab === "out" ? "Nothing is out of stock"
                    : "No stock recorded"
                  }
                  hint={
                    tab === "low" ? "Every item is above its threshold."
                    : tab === "out" ? "Every item on sale at this store has at least one unit available."
                    : "Receive stock to get started."
                  }
                />
              }
            />
            <Pagination meta={data.meta} onPage={setPage} />
          </>
        )}
      </Card>

      {adjusting && (
        <StockModal row={adjusting.row} initialMode={adjusting.mode} onClose={() => setAdjusting(null)} onSave={changeStock} />
      )}
    </div>
  );
}

function MovementTable({ rows }) {
  return (
    <Table
      title="Stock movements"
      columns={[
        { key: "createdAt", label: "When", render: (row) => when(row.createdAt) },
        {
          key: "type",
          label: "Type",
          render: (row) => (
            <Pill
              tone={
                ["receive", "transfer_in", "return"].includes(row.type) ? "ok"
                : ["dispatch", "damage", "transfer_out"].includes(row.type) ? "danger"
                : "info"
              }
            >
              {row.type}
            </Pill>
          ),
        },
        {
          key: "quantity",
          label: "Qty",
          align: "right",
          render: (row) => (
            <strong style={{ color: row.quantity < 0 ? "var(--danger)" : "var(--ok)" }}>
              {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
            </strong>
          ),
        },
        {
          key: "balance",
          label: "On hand",
          align: "right",
          render: (row) => (
            <span className="muted">
              {row.onHandBefore} → {row.onHandAfter}
            </span>
          ),
        },
        { key: "reason", label: "Reason", render: (row) => <span className="muted">{row.reason || "—"}</span> },
        {
          key: "ref",
          label: "Reference",
          render: (row) => (row.refCode ? <span className="tag">{row.refCode}</span> : "—"),
        },
        { key: "actorName", label: "By", render: (row) => <span className="muted">{row.actorName || "system"}</span> },
      ]}
      rows={rows}
      empty={<Empty title="No movements yet" />}
    />
  );
}

function ExpiringTable({ rows, days = 3 }) {
  const flat = rows.flatMap((row) =>
    (row.batches || []).map((batch) => ({ ...batch, product: row.product, variant: row.variant, id: batch.id || batch._id }))
  );

  return (
    <Table
      title="Expiring stock"
      columns={[
        {
          key: "product",
          label: "Item",
          render: (row) => (
            <div className="stack">
              <span className="row-title">{row.product?.name}</span>
              <span className="row-sub">{row.variant?.name}</span>
            </div>
          ),
        },
        { key: "batchNo", label: "Batch", render: (row) => <span className="tag">{row.batchNo}</span> },
        { key: "quantity", label: "Qty", align: "right" },
        {
          key: "expiresOn",
          label: "Expires",
          render: (row) => {
            const days = Math.ceil((new Date(row.expiresOn) - Date.now()) / 86400000);
            return (
              <Pill tone={days <= 0 ? "danger" : days <= 2 ? "warn" : undefined}>
                {days <= 0 ? "Expired" : `${days} day${days === 1 ? "" : "s"}`}
              </Pill>
            );
          },
        },
      ]}
      rows={flat}
      empty={
        <Empty
          title="Nothing expiring soon"
          hint={`No batches at this store expire within the next ${days} days, and none are already expired.`}
        />
      }
    />
  );
}

const MODES = [
  { key: "receive", label: "Add stock", hint: "Goods have arrived — enter how many to add." },
  { key: "adjust", label: "Stock count", hint: "Enter the quantity actually on the shelf. The difference is written to the movement log with your name against it." },
  { key: "damage", label: "Write off", hint: "Damaged or spoiled units — enter how many to take off." },
];
const DEFAULT_REASON = { receive: "Goods received", adjust: "Stock count", damage: "Damaged / spoiled" };

function StockModal({ row, initialMode = "adjust", onClose, onSave }) {
  const [mode, setMode] = useState(initialMode);
  const [quantity, setQuantity] = useState(initialMode === "adjust" ? row.onHand : "");
  const [reason, setReason] = useState(DEFAULT_REASON[initialMode]);
  const [batchNo, setBatchNo] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const current = MODES.find((m) => m.key === mode);
  const qty = Number(quantity);
  const valid = quantity !== "" && Number.isFinite(qty) && (mode === "adjust" ? qty >= 0 : qty > 0);
  const after =
    mode === "receive" ? row.onHand + qty : mode === "damage" ? Math.max(0, row.onHand - qty) : qty;

  function pick(next) {
    setMode(next);
    setReason(DEFAULT_REASON[next]);
    setQuantity(next === "adjust" ? row.onHand : "");
  }

  return (
    <Modal
      title={`${row.product?.name}${row.variant?.name ? ` · ${row.variant.name}` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${mode === "damage" ? "danger" : "primary"}`}
            disabled={!valid || saving}
            onClick={async () => {
              setSaving(true);
              await onSave({ mode, variant: row.variant.id, quantity: qty, reason, batchNo, expiresOn, costPrice });
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : mode === "receive" ? "Add stock" : mode === "damage" ? "Write off" : "Save count"}
          </button>
        </>
      }
    >
      <div className="chip-row stock-modes" role="tablist">
        {MODES.map((m) => (
          <button key={m.key} type="button" role="tab" aria-selected={mode === m.key} className={`cat-chip${mode === m.key ? " on" : ""}`} onClick={() => pick(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{current.hint}</p>

      <div className="stock-now">
        <div><span>On hand</span><strong>{row.onHand}</strong></div>
        <div><span>Reserved</span><strong>{row.reserved || 0}</strong></div>
        <div className="arrow" aria-hidden="true">→</div>
        <div className="after"><span>After</span><strong>{valid ? after : "—"}</strong></div>
      </div>

      <div className="grid cols-2">
        <Field label={mode === "adjust" ? "Counted quantity" : "Quantity"}>
          <input type="number" min="0" autoFocus value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Reason">
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>

      {mode === "receive" ? (
        <div className="grid cols-3">
          <Field label="Batch no." help="Optional">
            <input type="text" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
          </Field>
          <Field label="Expiry date" help="Optional — feeds Expiring soon">
            <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </Field>
          <Field label="Cost per unit (₹)" help="Optional">
            <input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </Field>
        </div>
      ) : null}
    </Modal>
  );
}
