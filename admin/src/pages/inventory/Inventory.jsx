import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, when } from "../../components/ui";

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
  const [adjusting, setAdjusting] = useState(null);

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

    api
      .get(path, { store: store || undefined, page, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tab, store, page]);

  useEffect(() => {
    if (!store && tab !== "movements") return;
    load();
  }, [load, store, tab]);

  async function adjust(payload) {
    try {
      await api.post("/inventory/adjust", { ...payload, store });
      setAdjusting(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn sm${tab === t.key ? " primary" : ""}`}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
          >
            {t.label}
          </button>
        ))}
        <span className="spacer" />
        <select value={store} onChange={(e) => setStore(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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
                  label: "Item",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.product?.name}</span>
                      <span className="row-sub">
                        {row.variant?.name} · <span className="tag">{row.variant?.sku}</span>
                      </span>
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
                      <button
                        className="btn sm"
                        onClick={() => setAdjusting(row)}
                      >
                        Adjust
                      </button>
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
        <AdjustModal row={adjusting} onClose={() => setAdjusting(null)} onSave={adjust} />
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

function AdjustModal({ row, onClose, onSave }) {
  const [quantity, setQuantity] = useState(row.onHand);
  const [reason, setReason] = useState("Stock count");

  return (
    <Modal
      title={`Adjust — ${row.product?.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => onSave({ variant: row.variant.id, quantity: Number(quantity), reason })}
          >
            Save adjustment
          </button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Enter the quantity actually on the shelf. The difference is written to the movement log with
        your name against it.
      </p>
      <div className="grid cols-2">
        <Field label="Counted quantity">
          <input type="number" autoFocus value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Currently recorded">
          <input type="number" value={row.onHand} disabled />
        </Field>
      </div>
      <Field label="Reason">
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
