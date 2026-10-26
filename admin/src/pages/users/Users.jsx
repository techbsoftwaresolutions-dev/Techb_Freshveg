import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, confirmDialog, toast } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, when } from "../../components/ui";

// Admin → Users and → Delivery Boys: staff accounts (never customers — the API
// filters them out). Both pages are one list; Delivery Boys is the same list
// fixed to that role, with delivery counts instead of a role column. What the
// signed-in admin may do comes from the API (assignableRoles, canEdit,
// canChangeAccess), and the API enforces it again on every request.

const ROLE_TONE = { super_admin: "accent", admin: "info", store_manager: "warn", delivery_partner: "ok" };
const DELIVERY = "delivery_partner";

export function RoleBadge({ user }) {
  return <Pill tone={ROLE_TONE[user.role]}>{user.roleLabel}{user.legacyRole ? " (legacy)" : ""}</Pill>;
}

const StatusPill = ({ status }) => (
  <Pill tone={status === "active" ? "ok" : "danger"}>
    {status === "active" ? "Active" : status === "deleted" ? "Erased" : "Inactive"}
  </Pill>
);

// Erasing is not deactivating: the person's details go for good, the orders
// they delivered keep only their name. The API refuses while they hold a run
// or unsettled cash, and says which.
async function eraseAccount(user, note) {
  const reason = await confirmDialog({
    title: "Erase account?",
    message: `Erase ${user.name}'s account? Their phone number and details are removed for good and they can no longer sign in. Delivered orders keep their name for the store's records.`,
    input: note === undefined ? { label: "Note for the record (optional)" } : undefined,
    typeToConfirm: "DELETE",
    confirmText: "Erase account",
    danger: true,
  });
  if (reason === false) return false;
  try {
    const result = await api.post(`/users/${user.id}/erase`, { confirm: "DELETE", note: note ?? reason });
    toast("success", result.message);
    return true;
  } catch {
    return false; // the API client has already shown the reason as a toast
  }
}

// Delivery employees' requests to delete their account, raised from the
// delivery app's Profile → Delete my account.
function DeletionRequests({ onChanged }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => {
    api.get("/users/deletion-requests", { status: "requested" }).then((data) => setRows(data.items)).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);
  if (!rows?.length) return null;

  async function decline(row) {
    const note = await confirmDialog({
      title: "Decline deletion request?",
      input: { label: "Why is the request declined? The employee sees this in the app.", required: true },
      confirmText: "Decline request",
    });
    if (!note) return;
    try {
      await api.post(`/users/deletion-requests/${row.id}/reject`, { note });
      load();
    } catch {
      // shown as a toast by the API client
    }
  }

  return (
    <Card title={`Account deletion requests (${rows.length})`} style={{ marginBottom: 16 }}>
      <Table
        title="Account deletion requests"
        columns={[
          { key: "user", label: "Delivery boy", render: (row) => `${row.user?.name || "—"} · ${row.user?.phone || ""}` },
          { key: "requestedAt", label: "Requested", render: (row) => when(row.requestedAt) },
          { key: "reason", label: "Reason", render: (row) => row.reason || <span className="faint">None given</span> },
          {
            key: "actions",
            label: "Actions",
            sortable: false,
            render: (row) => (
              <div className="inline" style={{ gap: 6 }}>
                <button className="btn sm danger" onClick={async () => (await eraseAccount(row.user, "On the employee's request")) && (load(), onChanged())}>
                  Erase account
                </button>
                <button className="btn sm" onClick={() => decline(row)}>Decline</button>
              </div>
            ),
          },
        ]}
        rows={rows}
      />
    </Card>
  );
}

export default function Users() {
  return <StaffList title="Users" addLabel="Create New User" />;
}

export function DeliveryBoys() {
  return <StaffList title="Delivery Boys" role={DELIVERY} addLabel="Add Delivery Boy" />;
}

// /users/new and /delivery-boys/new — creating an account is its own page;
// the same form as editing, drawn full-page by FormRoute. On the Delivery
// Boys page the role is fixed.
export function NewUserPage({ fixedRole }) {
  const deliveryOnly = fixedRole === DELIVERY;
  return (
    <FormRoute
      backTo={deliveryOnly ? "/delivery-boys" : "/users"}
      backLabel={deliveryOnly ? "Delivery Boys" : "Users"}
      // Which roles this admin may hand out — the API decides.
      load={async () => (await api.get("/users", { limit: 1 })).assignableRoles}
      render={(assignableRoles, back) => (
        <UserForm user={null} assignableRoles={assignableRoles} fixedRole={fixedRole} onClose={back} onSaved={back} />
      )}
    />
  );
}

function StaffList({ title, role, addLabel }) {
  const deliveryOnly = role === DELIVERY;
  const [data, setData] = useState({ items: [], meta: null, assignableRoles: [] });
  const [filters, setFilters] = useState({ search: "", role: role || "", status: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get("/users", { ...filters, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  async function toggleStatus(user) {
    const activating = user.status !== "active";
    if (!activating) {
      const ok = await confirmDialog({
        title: "Deactivate user?",
        message: `Deactivate ${user.name}? They will be signed out and cannot sign in until reactivated.`,
        confirmText: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }
    setBusyId(user.id);
    try {
      await api.patch(`/users/${user.id}`, { status: activating ? "active" : "blocked" });
      load();
    } catch {
      // the API client has already shown the reason as a toast
    } finally {
      setBusyId(null);
    }
  }

  const canCreate = deliveryOnly
    ? data.assignableRoles.some((r) => r.key === DELIVERY)
    : data.assignableRoles.length > 0;

  const columns = [
    {
      key: "name",
      label: deliveryOnly ? "Delivery boy" : "User",
      render: (row) => (
        <div className="stack">
          <span className="row-title">
            {row.name || "—"}
            {row.self ? <span className="faint" style={{ fontWeight: 400 }}> · you</span> : null}
          </span>
          <span className="row-sub">{row.email || "No email"}</span>
        </div>
      ),
    },
    { key: "phone", label: "Phone" },
    ...(deliveryOnly
      ? [
        { key: "active", label: "On the road", align: "right", render: (row) => row.deliveries?.active ?? 0 },
        { key: "delivered", label: "Delivered", align: "right", render: (row) => row.deliveries?.delivered ?? 0 },
      ]
      : [{ key: "role", label: "Role", render: (row) => <RoleBadge user={row} /> }]),
    { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
    { key: "createdAt", label: "Created", render: (row) => <span className="muted">{when(row.createdAt)}</span> },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => (
        <div className="inline" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn sm" onClick={() => setEditing(row)}>
            {row.canEdit && row.status !== "deleted" ? "Edit" : "View"}
          </button>
          {row.canChangeAccess && row.status !== "deleted" ? (
            <button
              className={`btn sm${row.status === "active" ? " danger" : ""}`}
              disabled={busyId === row.id}
              onClick={() => toggleStatus(row)}
            >
              {busyId === row.id ? "…" : row.status === "active" ? "Deactivate" : "Activate"}
            </button>
          ) : null}
          {deliveryOnly && row.canChangeAccess && row.status !== "deleted" ? (
            <button className="btn sm danger" onClick={async () => (await eraseAccount(row)) && load()}>
              Erase
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
        </div>
        {canCreate ? (
          <button className="btn primary" onClick={() => navigate(deliveryOnly ? "/delivery-boys/new" : "/users/new")}>
            + {addLabel}
          </button>
        ) : null}
      </div>

      <Banner tone="error">{error}</Banner>

      {deliveryOnly ? <DeletionRequests onChanged={load} /> : null}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name, phone or email…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 260 }}
          aria-label="Search users"
        />
        {deliveryOnly ? null : (
          <select value={filters.role} onChange={(e) => set("role", e.target.value)} aria-label="Filter by role">
            <option value="">All roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="store_manager">Store Supervisor</option>
            <option value={DELIVERY}>Delivery Boy</option>
          </select>
        )}
        <select value={filters.status} onChange={(e) => set("status", e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="blocked">Inactive</option>
        </select>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title={title}
              columns={columns}
              rows={data.items}
              onRowClick={(row) => setEditing(row)}
              empty={
                <Empty
                  title={filters.search || filters.status || (!deliveryOnly && filters.role) ? "No one matches these filters" : `No ${title.toLowerCase()} yet`}
                  hint={canCreate ? `Use “${addLabel}” to add the first one.` : undefined}
                />
              }
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>

      {editing ? (
        <UserForm
          user={editing}
          assignableRoles={data.assignableRoles}
          fixedRole={role}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

// Create, view and edit one account. On the Delivery Boys page the role is
// fixed to Delivery Boy; elsewhere it is chosen from the roles this admin may
// hand out.
function UserForm({ user, assignableRoles, fixedRole, onClose, onSaved }) {
  const creating = !user;
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    role: user?.role || fixedRole || "",
    status: user?.status || "active",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const readOnly = !creating && !user.canEdit;
  const roleLocked = readOnly || Boolean(fixedRole) || (!creating && !user.canChangeAccess);
  const isDelivery = form.role === DELIVERY;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // A legacy role (picker, support) stays selectable for the account that has it.
  const roleOptions = [...assignableRoles];
  if (user && !roleOptions.some((r) => r.key === user.role)) {
    roleOptions.unshift({ key: user.role, label: `${user.roleLabel}${user.legacyRole ? " (legacy)" : ""}` });
  }

  async function save(event) {
    event?.preventDefault();
    // The same rules the API applies, checked first so the common slips show
    // instantly; the API's answer still decides.
    const local = {};
    if (!form.name.trim()) local.name = "Enter the person's full name";
    if (!/^\d{10}$/.test(form.phone.trim())) local.phone = "Phone must be 10 digits";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) local.email = "That email address does not look right";
    if (!form.role) local.role = "Choose a role";
    if (!isDelivery && creating && form.password.length < 8) local.password = "Use at least 8 characters";
    if (!isDelivery && !creating && form.password && form.password.length < 8) local.password = "Use at least 8 characters";
    setErrors(local);
    if (Object.keys(local).length) return;

    const body = { name: form.name, phone: form.phone, email: form.email };
    if (creating || form.role !== user.role) body.role = form.role;
    if (creating) body.status = form.status;
    if (!isDelivery && form.password) body.password = form.password;

    setSaving(true);
    setError("");
    try {
      if (creating) await api.post("/users", body);
      else await api.patch(`/users/${user.id}`, body);
      onSaved();
    } catch (err) {
      setError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  const title = creating ? (fixedRole === DELIVERY ? "Add Delivery Boy" : "Create New User") : user.name || user.phone;

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {readOnly ? null : (
            <button className="btn primary" disabled={saving} onClick={save}>
              {saving ? "Saving…" : creating ? "Create account" : "Save changes"}
            </button>
          )}
        </>
      }
    >
      <Banner tone="error">{error}</Banner>
      {readOnly ? <Banner tone="info">Only a Super Admin can change a Super Admin's account.</Banner> : null}

      {!creating ? (
        <div className="inline" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <RoleBadge user={user} />
          <StatusPill status={user.status} />
          <span className="faint" style={{ fontSize: 12 }}>
            Created {when(user.createdAt)} · {user.lastLoginAt ? `last signed in ${when(user.lastLoginAt)}` : "never signed in"}
            {user.deliveries ? ` · ${user.deliveries.active} on the road, ${user.deliveries.delivered} delivered` : ""}
          </span>
        </div>
      ) : null}

      <form onSubmit={save}>
        <Field label="Full name" error={errors.name}>
          <input type="text" value={form.name} onChange={set("name")} disabled={readOnly} autoFocus={creating} maxLength={80} />
        </Field>
        <div className="grid cols-2">
          <Field label="Phone number" error={errors.phone} help={isDelivery ? "The delivery app sends the sign-in OTP here." : "Used to sign in to this portal."}>
            <input type="text" inputMode="numeric" autoComplete="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} disabled={readOnly} />
          </Field>
          <Field label="Email address" error={errors.email} help="Optional.">
            <input type="text" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} disabled={readOnly} />
          </Field>
        </div>
        <div className="grid cols-2">
          <Field label="Role" error={errors.role} help={!creating && user.self ? "You cannot change your own role." : undefined}>
            <select value={form.role} onChange={set("role")} disabled={roleLocked}>
              {form.role ? null : <option value="">Choose a role</option>}
              {roleOptions.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </Field>
          {creating ? (
            <Field label="Account status">
              <select value={form.status} onChange={set("status")}>
                <option value="active">Active — can sign in now</option>
                <option value="blocked">Inactive — activate later</option>
              </select>
            </Field>
          ) : null}
        </div>
        {isDelivery || readOnly ? null : (
          <Field
            label={creating ? "Password" : "Reset password"}
            error={errors.password}
            help={creating ? "At least 8 characters. Share it with them privately." : "Leave blank to keep the current password."}
          >
            <input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
          </Field>
        )}
        {/* lets Enter submit from any field */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
