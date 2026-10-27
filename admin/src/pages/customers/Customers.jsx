import Select from "../../components/Select";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import {
  Banner, Card, Divider, Empty, Field, Loading, Modal, Pagination, Pill, Stat, Table, Tabs, rupees, when,
} from "../../components/ui";

export default function Customers() {
  const { can } = useAuth();
  const canManage = can("customers.manage");

  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: "", status: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/customers", { ...filters, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Customers</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name, phone or email…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 260 }}
        />
        <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </Select>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Customers"
              columns={[
                {
                  key: "name",
                  label: "Customer",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.name || "—"}</span>
                      <span className="row-sub">{row.phone}{row.email ? ` · ${row.email}` : ""}</span>
                    </div>
                  ),
                },
                { key: "orders", label: "Orders", align: "right" },
                {
                  key: "totalSpend",
                  label: "Spend",
                  align: "right",
                  render: (row) => <strong>{rupees(row.totalSpend)}</strong>,
                },
                {
                  key: "lastOrderAt",
                  label: "Last order",
                  render: (row) => <span className="muted">{row.lastOrderAt ? when(row.lastOrderAt) : "Never"}</span>,
                },
                {
                  key: "walletBalance",
                  label: "Wallet",
                  align: "right",
                  render: (row) => (row.walletBalance ? rupees(row.walletBalance) : "—"),
                },
                {
                  key: "loyaltyPoints",
                  label: "Points",
                  align: "right",
                  render: (row) => row.loyaltyPoints || "—",
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <Pill tone={row.status === "active" ? "ok" : "danger"}>{row.status}</Pill>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  sortable: false,
                  exportable: false,
                  render: (row) =>
                    canManage && (
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn sm" onClick={() => navigate(`/customers/${row.id}/edit`)}>Edit</button>
                        <button className="btn sm danger" onClick={() => setDeleting(row)}>Delete</button>
                      </div>
                    ),
                },
              ]}
              rows={data.items}
              onRowClick={(row) => navigate(`/customers/${row.id}`)}
              empty={<Empty title="No customers yet" hint="Accounts are created the first time someone signs in." />}
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>

      {deleting ? (
        <DeleteCustomerModal
          customer={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            load();
          }}
          onBlocked={() => {
            setDeleting(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

// /customers/:id — one customer's record (orders, wallet, points, addresses)
// as a page. The small balance adjustments it offers stay as dialogs.
export function CustomerPage() {
  const { can } = useAuth();
  return (
    <FormRoute
      backTo="/customers"
      backLabel="Customers"
      load={async (id) => (id ? { id } : null)}
      render={({ id }, back) => (
        <CustomerDrawer id={id} canManage={can("customers.manage")} onClose={back} onChanged={() => {}} />
      )}
    />
  );
}

// /customers/:id/edit — the edit form as a page, like the other add/edit forms.
export function CustomerEditPage() {
  return (
    <FormRoute
      backTo="/customers"
      backLabel="Customers"
      load={async (id) => (id ? (await api.get(`/customers/${id}`)).customer : null)}
      render={(customer, back) => (
        <EditCustomerModal customer={customer} onClose={() => back()} onSaved={() => back("/customers")} />
      )}
    />
  );
}

function CustomerDrawer({ id, canManage, onClose, onChanged }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("orders");
  const [adjusting, setAdjusting] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .get(`/customers/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <Modal title="Customer" onClose={onClose} wide><Loading /></Modal>;
  }

  const { customer, orders, wallet, loyalty, stats } = data;

  return (
    <Modal
      title={
        <div className="inline">
          <h2>{customer.name || customer.phone}</h2>
          <Pill tone={customer.status === "active" ? "ok" : "danger"}>{customer.status}</Pill>
        </div>
      }
      onClose={onClose}
      wide
      footer={<button className="btn" onClick={onClose}>Close</button>}
    >
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Orders" value={stats.orders} foot={`${stats.delivered} delivered`} />
        <Stat label="Lifetime spend" value={rupees(stats.totalSpend)} foot={`avg ${rupees(stats.averageOrder)}`} />
        <Stat label="Wallet" value={rupees(customer.walletBalance)} />
        <Stat label="Points" value={customer.loyaltyPoints} />
      </div>

      {canManage ? (
        <div className="inline" style={{ marginBottom: 14, gap: 8 }}>
          <button className="btn sm" onClick={() => setAdjusting("wallet")}>Adjust wallet</button>
          <button className="btn sm" onClick={() => setAdjusting("loyalty")}>Adjust points</button>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={() => navigate(`/customers/${id}/edit`)}>Edit customer</button>
          <button className="btn sm danger" onClick={() => setDeletingCustomer(true)}>Delete</button>
        </div>
      ) : null}

      <Tabs
        tabs={[
          { key: "orders", label: "Orders", count: orders.length },
          { key: "wallet", label: "Wallet", count: wallet.length },
          { key: "loyalty", label: "Points", count: loyalty.length },
          { key: "addresses", label: "Addresses", count: customer.addresses?.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "orders" ? (
        <Table
          title="Customer orders"
          columns={[
            {
              key: "code",
              label: "Order",
              render: (row) => (
                <div className="stack">
                  <Link to={`/orders/${row.id}`} className="mono" onClick={onClose}>{row.code}</Link>
                  <span className="row-sub">{when(row.placedAt)}</span>
                </div>
              ),
            },
            { key: "items", label: "Items", align: "right", render: (row) => row.items?.length },
            { key: "total", label: "Total", align: "right", render: (row) => rupees(row.pricing?.total) },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Pill tone={row.status === "DELIVERED" ? "ok" : "info"}>
                  {row.status.replace(/_/g, " ").toLowerCase()}
                </Pill>
              ),
            },
          ]}
          rows={orders}
          empty={<Empty title="No orders yet" />}
        />
      ) : null}

      {tab === "wallet" ? (
        <Table
          title="Wallet ledger"
          columns={[
            { key: "when", label: "When", render: (row) => when(row.createdAt) },
            { key: "reason", label: "Reason", render: (row) => <span className="muted">{row.reason.replace(/_/g, " ")}</span> },
            { key: "note", label: "Note", render: (row) => <span className="row-sub">{row.note || "—"}</span> },
            {
              key: "amount",
              label: "Amount",
              align: "right",
              render: (row) => (
                <strong style={{ color: row.amount > 0 ? "var(--ok)" : "var(--danger)" }}>
                  {row.amount > 0 ? "+" : "−"}{rupees(Math.abs(row.amount))}
                </strong>
              ),
            },
            { key: "balanceAfter", label: "Balance", align: "right", render: (row) => rupees(row.balanceAfter) },
          ]}
          rows={wallet}
          empty={<Empty title="No wallet activity" hint="Refunds, cashback and adjustments appear here." />}
        />
      ) : null}

      {tab === "loyalty" ? (
        <Table
          title="Loyalty points"
          columns={[
            { key: "when", label: "When", render: (row) => when(row.createdAt) },
            { key: "reason", label: "Reason", render: (row) => <span className="muted">{row.reason}</span> },
            { key: "order", label: "Order", render: (row) => <span className="mono row-sub">{row.orderCode || "—"}</span> },
            {
              key: "points",
              label: "Points",
              align: "right",
              render: (row) => (
                <strong style={{ color: row.points > 0 ? "var(--ok)" : "var(--danger)" }}>
                  {row.points > 0 ? "+" : ""}{row.points}
                </strong>
              ),
            },
            { key: "balanceAfter", label: "Balance", align: "right" },
          ]}
          rows={loyalty}
          empty={<Empty title="No points activity" />}
        />
      ) : null}

      {tab === "addresses" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {(customer.addresses || []).map((address) => (
            <div key={address.id} className="panel" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
              <div className="inline">
                <strong>{address.label}</strong>
                {address.isDefault ? <Pill tone="accent">default</Pill> : null}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {[address.line1, address.line2, address.landmark, address.city, address.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>
          ))}
          {!customer.addresses?.length ? <Empty title="No saved addresses" /> : null}
        </div>
      ) : null}

      {deletingCustomer ? (
        <DeleteCustomerModal
          customer={{ ...customer, orders: stats.orders }}
          onClose={() => setDeletingCustomer(false)}
          onDeleted={() => {
            setDeletingCustomer(false);
            onChanged();
            onClose();
          }}
          onBlocked={() => {
            setDeletingCustomer(false);
            load();
            onChanged();
          }}
        />
      ) : null}

      {adjusting ? (
        <AdjustModal
          kind={adjusting}
          customerId={id}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            load();
            onChanged();
          }}
        />
      ) : null}
    </Modal>
  );
}

function AdjustModal({ kind, customerId, onClose, onSaved }) {
  const isWallet = kind === "wallet";
  const [value, setValue] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (isWallet) {
        await api.post(`/customers/${customerId}/wallet`, { amount: Math.round(value * 100), note });
      } else {
        await api.post(`/customers/${customerId}/loyalty`, { points: Math.round(value), note });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isWallet ? "Adjust wallet balance" : "Adjust loyalty points"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !value || !note.trim()} onClick={save}>
            {busy ? "Saving…" : "Apply adjustment"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Use a negative number to take {isWallet ? "money" : "points"} away. This writes a ledger
        entry with your name against it — the note is required because a balance nobody can explain
        is worse than no balance at all.
      </p>

      <Field label={isWallet ? "Amount (₹)" : "Points"}>
        <input type="number" autoFocus value={value} onChange={(e) => setValue(Number(e.target.value))} />
      </Field>

      <Field label="Reason">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isWallet ? "Goodwill for a late delivery" : "Correction after a failed redemption"}
        />
      </Field>
    </Modal>
  );
}

function EditCustomerModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: customer.name || "",
    phone: customer.phone || "",
    email: customer.email || "",
    status: customer.status || "active",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const phoneOk = /^\d{10}$/.test(form.phone);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/customers/${customer.id}`, form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Edit customer"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !phoneOk} onClick={save}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>
      <Field label="Name">
        <input type="text" autoFocus value={form.name} onChange={set("name")} placeholder="Customer name" />
      </Field>
      <div className="grid cols-2">
        <Field
          label="Phone"
          error={form.phone && !phoneOk ? "Enter a 10-digit number" : ""}
        >
          <input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set("status")}>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </Select>
        </Field>
      </div>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" />
      </Field>
    </Modal>
  );
}

function DeleteCustomerModal({ customer, onClose, onDeleted, onBlocked }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refused, setRefused] = useState(false);
  const label = customer.name || customer.phone;
  const hasBalance = customer.walletBalance > 0 || customer.loyaltyPoints > 0;

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api.delete(`/customers/${customer.id}`);
      onDeleted();
    } catch (err) {
      setError(err.message);
      setRefused(err.status === 409 || /can't be deleted/i.test(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function blockInstead() {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/customers/${customer.id}`, { status: "blocked" });
      onBlocked();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Delete customer"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          {refused ? (
            customer.status === "blocked" ? null : (
              <button className="btn primary" disabled={busy} onClick={blockInstead}>
                {busy ? "Blocking…" : "Block instead"}
              </button>
            )
          ) : (
            <button className="btn danger" disabled={busy} onClick={remove}>
              {busy ? "Deleting…" : "Delete customer"}
            </button>
          )}
        </>
      }
    >
      <Banner tone="error">{error}</Banner>
      <p style={{ marginTop: 0 }}>
        Delete <strong>{label}</strong>{customer.name ? ` (${customer.phone})` : ""}? This can't be undone.
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        Their addresses, cart, wishlist, notifications and wallet and points history are removed with the account.
        Customers who already have orders, reviews or support tickets can't be deleted — block them instead, which
        stops sign-ins and keeps the history.
      </p>
      {hasBalance ? (
        <Banner tone="warn">
          This account still holds {customer.walletBalance > 0 ? rupees(customer.walletBalance) + " in the wallet" : ""}
          {customer.walletBalance > 0 && customer.loyaltyPoints > 0 ? " and " : ""}
          {customer.loyaltyPoints > 0 ? `${customer.loyaltyPoints} loyalty points` : ""}. Deleting removes it.
        </Banner>
      ) : null}
    </Modal>
  );
}
