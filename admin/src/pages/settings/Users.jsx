import Select from "../../components/Select";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, when } from "../../components/ui";

// Staff accounts and their roles. Only a super admin opens this page — an
// admin can run the shop but cannot create other admins.
const ROLE_TONE = { super_admin: "accent", admin: "ok", store_manager: "warn" };

const ROLE_BLURB = {
  super_admin: "Full control, including settings and every user.",
  admin: "Runs the shop day to day and manages staff.",
  store_manager: "Looks after catalog, stock and orders.",
  delivery_partner: "Delivers orders. Signs in to the delivery app with email and password.",
};

const BLANK = { name: "", phone: "", email: "", role: "store_manager", status: "active", password: "" };

export default function Users() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  // A save returns here as ?saved=<name>, which is the confirmation.
  const [params] = useSearchParams();
  const saved = params.get("saved");
  const created = params.get("created") === "1";

  const [roles, setRoles] = useState([]);
  const [minPassword, setMinPassword] = useState(8);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [confirming, setConfirming] = useState(null); // the row awaiting a yes/no

  const roleLabel = (key) => roles.find((r) => r.key === key)?.label || key;

  useEffect(() => {
    api
      .get("/staff/meta")
      .then((data) => {
        setRoles(data.roles);
        setMinPassword(data.minPassword);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    // Typing in the search box waits a beat so each keystroke isn't a request.
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .get("/staff", { limit: 20, page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) })
        .then((data) => {
          setItems(data.items);
          setMeta(data.meta);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [page, filters]);

  // The API refuses deleting yourself or the last super admin and says why.
  async function removeUser(row) {
    setDeleting(row.id);
    setError("");
    setDeleted("");
    try {
      await api.delete(`/staff/${row.id}`);
      setItems((list) => list.filter((u) => u.id !== row.id));
      setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
      setDeleted(row.name || row.phone);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Users</h1>
        </div>
        <button className="btn primary" onClick={() => navigate("/settings/users/new")}>
          + Add user
        </button>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{deleted ? `${deleted} deleted.` : saved ? `${saved} ${created ? "added" : "saved"}.` : ""}</Banner>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name, phone or email…"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          style={{ minWidth: 260 }}
        />
        <Select value={filters.role} onChange={(e) => setFilter("role", e.target.value)}>
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </Select>
        <Select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">Any status</option>
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
              title="Users"
              columns={[
                {
                  key: "name",
                  label: "User",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">
                        {row.name || "—"} {row.id === me?.id && <Pill>you</Pill>}
                      </span>
                      <span className="row-sub">{row.email || "No email"}</span>
                    </div>
                  ),
                },
                { key: "phone", label: "Phone", render: (row) => <span>{row.phone}</span> },
                {
                  key: "role",
                  label: "Role",
                  render: (row) => <Pill tone={ROLE_TONE[row.role]}>{roleLabel(row.role)}</Pill>,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Pill tone={row.status === "active" ? "ok" : "danger"}>{row.status}</Pill>,
                },
                {
                  key: "lastLoginAt",
                  label: "Last sign-in",
                  render: (row) => <span className="muted">{row.lastLoginAt ? when(row.lastLoginAt) : "Never"}</span>,
                },
                {
                  key: "actions",
                  label: "Actions",
                  align: "right",
                  exportable: false,
                  render: (row) => {
                    const self = row.id === me?.id;
                    return (
                      <div className="inline" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/settings/users/${row.id}`);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn sm danger"
                          disabled={self || deleting === row.id}
                          title={self ? "You can't delete your own account" : undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfirming(row);
                          }}
                        >
                          {deleting === row.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    );
                  },
                },
              ]}
              rows={items}
              onRowClick={(row) => navigate(`/settings/users/${row.id}`)}
              empty={<Empty title="No users found" hint="Try clearing the filters, or add a user." />}
            />
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </Card>


      {confirming && (
        <Modal
          title="Delete user?"
          onClose={() => !deleting && setConfirming(null)}
          footer={
            <>
              <button className="btn" disabled={Boolean(deleting)} onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button className="btn danger" disabled={Boolean(deleting)} onClick={() => removeUser(confirming)}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            <strong>{confirming.name || confirming.phone}</strong> will no longer be able to sign in.
          </p>
          <p className="faint" style={{ fontSize: 13, marginBottom: 0 }}>
            To keep their record, block them instead of deleting.
          </p>
        </Modal>
      )}
    </div>
  );
}

// /settings/users/new and /settings/users/:id — the form as a page.
export function UserFormPage() {
  const { user: me } = useAuth();
  return (
    <FormRoute
      backTo="/settings/users"
      backLabel="Users"
      load={async (id) => {
        const meta = await api.get("/staff/meta");
        const user = id ? (await api.get(`/staff/${id}`)).user : null;
        return { ...meta, user };
      }}
      render={({ roles, minPassword, user }, back) => (
        <UserModal
          value={user || BLANK}
          roles={roles}
          minPassword={minPassword}
          isSelf={Boolean(user && user.id === me?.id)}
          onClose={() => back()}
          onSaved={(saved, created) =>
            back(`/settings/users?saved=${encodeURIComponent(saved.name)}${created ? "&created=1" : ""}`)
          }
        />
      )}
    />
  );
}

function UserModal({ value, roles, minPassword, isSelf, onClose, onSaved }) {
  const isNew = !value.id;
  const [form, setForm] = useState({ ...BLANK, ...value, password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showAllPerms, setShowAllPerms] = useState(false);

  const set = (key, next) => setForm((f) => ({ ...f, [key]: next }));
  const role = roles.find((r) => r.key === form.role);

  const passwordProblem =
    form.password && form.password.length < minPassword ? `At least ${minPassword} characters` : "";
  const phoneProblem = isNew && form.phone && !/^\d{10}$/.test(form.phone) ? "10 digits" : "";
  const isPartner = form.role === "delivery_partner";
  const needsPassword = true;
  const emailProblem =
    isPartner && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? "Enter a valid email" : "";
  const incomplete =
    !form.name.trim() ||
    Boolean(emailProblem) ||
    (isNew && (!/^\d{10}$/.test(form.phone) || !form.password));

  async function submit() {
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      if (isNew) {
        const { user } = await api.post("/staff", {
          name: form.name,
          phone: form.phone,
          email: form.email,
          role: form.role,
          password: form.password,
        });
        onSaved(user, true);
      } else {
        const body = { name: form.name, email: form.email };
        if (!isSelf) {
          body.role = form.role;
          body.status = form.status;
        }
        if (form.password && needsPassword) body.password = form.password;
        const { user } = await api.patch(`/staff/${value.id}`, body);
        onSaved(user, false);
      }
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details || {});
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? "Add user" : form.name || "Edit user"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={saving || incomplete || Boolean(passwordProblem) || Boolean(phoneProblem)}
            onClick={submit}
          >
            {saving ? "Saving…" : isNew ? "Add user" : "Save changes"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      <div className="section-label">Details</div>
      <div className="grid cols-2">
        <Field label="Full name" error={fieldErrors.name}>
          <input type="text" value={form.name} placeholder="e.g. Ravi Kumar" onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field
          label="Mobile number"
          error={fieldErrors.phone || phoneProblem}
          help={isNew ? "10 digits. They sign in with this." : "The sign-in number can't be changed."}
        >
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={form.phone}
            placeholder="98765 43210"
            disabled={!isNew}
            onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </Field>
      </div>
      <Field
        label={isPartner ? "Email (their sign-in)" : "Email (optional)"}
        error={fieldErrors.email || (form.email ? emailProblem : "")}
        help={isPartner ? "The delivery boy signs in to the app with this email and the password below." : undefined}
      >
        <input type="text" inputMode="email" autoComplete="off" value={form.email} placeholder="name@example.com" onChange={(e) => set("email", e.target.value)} />
      </Field>

      <div className="section-label">Role</div>
      <Field
        label="Role"
        error={fieldErrors.role}
        help={isSelf ? "You can't change your own role." : role ? ROLE_BLURB[role.key] : undefined}
      >
        <Select value={form.role} disabled={isSelf} onChange={(e) => set("role", e.target.value)}>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </Select>
      </Field>

      {role && (
        <div className="perm-box">
          <div className="perm-box-title">{role.label} can</div>
          <div className="perm-chips">
            {(showAllPerms ? role.permissions : role.permissions.slice(0, 5)).map((p) => (
              <span key={p} className="perm-chip">{p}</span>
            ))}
            {role.permissions.length > 5 && (
              <button type="button" className="perm-chip more" onClick={() => setShowAllPerms((v) => !v)}>
                {showAllPerms ? "Show less" : `+${role.permissions.length - 5} more`}
              </button>
            )}
            {!role.permissions.length && <span className="faint">Nothing in the admin</span>}
          </div>
        </div>
      )}

      {!isNew && (
        <>
          <div className="section-label">Account</div>
          <Field label="Status" help={isSelf ? "You can't block your own account." : "Blocked users can't sign in."}>
            <Select value={form.status} disabled={isSelf} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </Select>
          </Field>
        </>
      )}

      <div className="section-label">Sign-in</div>
      <Field
        label={isNew ? "Password" : "Reset password (optional)"}
        error={fieldErrors.password || passwordProblem}
        help={isNew ? `At least ${minPassword} characters.` : "Leave blank to keep the current password. A role change applies the next time they sign in."}
      >
        <input
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
      </Field>
    </Modal>
  );
}
