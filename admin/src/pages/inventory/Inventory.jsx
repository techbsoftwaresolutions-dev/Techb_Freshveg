import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, toast } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, when } from "../../components/ui";
import { Select } from "../../components/SelectMenu";

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
  const [data, setData] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const searchable = tab === "stock" || tab === "low" || tab === "out";
  // Category tabs, as on the Products page: the main (top-level) categories,
  // each covering everything under it.
  const [roots, setRoots] = useState([]);
  const [category, setCategory] = useState("");

  useEffect(() => {
    api
      .get("/catalog/categories/tree", { status: "active" })
      .then(({ tree }) => setRoots(tree))
      .catch(() => {});
  }, []);

  // Typing waits for a pause before asking the server again.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

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
      : "/inventory/variants";

    api
      .get(path, {
        store: store || undefined,
        page,
        limit: 20,
        q: searchable && q ? q : undefined,
        category: category || undefined,
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tab, store, page, q, searchable, category]);

  useEffect(() => {
    if (!store && tab !== "movements") return;
    load();
  }, [load, store, tab]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        {[{ id: "", name: "All" }, ...roots].map((root) => (
          <button
            key={root.id || "all"}
            className={`btn sm${category === root.id ? " primary" : ""}`}
            onClick={() => {
              setCategory(root.id);
              setPage(1);
            }}
          >
            {root.name}
          </button>
        ))}
        <span className="spacer" />
        <Select
          value={tab}
          aria-label="Inventory view"
          onChange={(e) => {
            setTab(e.target.value);
            setPage(1);
          }}
        >
          {TABS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        {searchable ? (
          <input
            type="search"
            placeholder="Product, variant or SKU"
            aria-label="Search inventory"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        ) : null}
        <Select value={store} onChange={(e) => setStore(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : tab === "movements" ? (
          <MovementTable rows={data.items} />
        ) : tab === "expiring" ? (
          <ExpiringTable rows={data.items} />
        ) : (
          <>
            <Table
              title="Stock levels"
              columns={[
                {
                  key: "product",
                  label: "Product",
                  render: (row) => <span className="row-title">{row.product?.name}</span>,
                },
                {
                  key: "variant",
                  label: "Variant",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.variant?.name || "—"}</span>
                      <span className="row-sub"><span className="tag">{row.variant?.sku}</span></span>
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
                  key: "status",
                  label: "",
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
                      <button className="btn sm" onClick={() => setAdding(row)}>
                        Add stock
                      </button>
                    ),
                },
              ]}
              rows={data.items}
              empty={
                <Empty
                  title={
                    q ? `Nothing matches “${q}”`
                    : tab === "low" ? "Nothing is running low"
                    : tab === "out" ? "Nothing is out of stock"
                    : "No stock recorded"
                  }
                  hint={
                    q ? "Try part of the product name, the pack size or the SKU."
                    : tab === "low" ? "Every item is above its threshold."
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

      {adding && (
        <AddStockModal
          row={adding}
          store={store}
          onClose={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            load();
          }}
        />
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

function ExpiringTable({ rows }) {
  const flat = rows.flatMap((row) =>
    row.batches.map((batch) => ({ ...batch, product: row.product, variant: row.variant, id: batch.id || batch._id }))
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
      empty={<Empty title="Nothing expiring soon" hint="No batches are within the warning window." />}
    />
  );
}

// Same call as the product page's Stock card (POST /inventory/receive): the
// amount is added to what is on hand, never written over it, and lands in the
// movement log as a "receive" with your name against it.
function AddStockModal({ row, store, onClose, onAdded }) {
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const amount = Number(quantity);
  const valid = Number.isInteger(amount) && amount > 0;
  const pack = row.variant?.name || row.product?.unit || "units";

  async function submit(event) {
    event?.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/inventory/receive", { store, variant: row.variant.id, quantity: amount });
      toast("success", `Added ${amount} × ${pack} to ${row.product?.name}`);
      onAdded();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Add stock — ${row.product?.name}${row.variant?.name ? ` · ${row.variant.name}` : ""}`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={!valid || busy}>
            {busy ? "Adding…" : "Add stock"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>
      <form onSubmit={submit} className="grid cols-2">
        <Field label="Currently on hand">
          <input type="text" value={`${row.onHand ?? 0} × ${pack}`} disabled />
        </Field>
        <Field
          label={`Quantity to add (${pack})`}
          help={quantity && !valid ? "Enter a whole number above 0." : undefined}
        >
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            autoFocus
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
      </form>
      {valid ? (
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
          On hand after: <strong>{(row.onHand ?? 0) + amount}</strong>
        </p>
      ) : null}
    </Modal>
  );
}
