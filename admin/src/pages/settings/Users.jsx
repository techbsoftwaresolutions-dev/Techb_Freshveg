import Select from "../../components/Select";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import { FormSection, Segmented } from "../../components/FormKit";
import { Avatar } from "../orders/Orders";
import {
  Banner,
  Card,
  Empty,
  Field,
  Loading,
  Modal,
  Pagination,
  Pill,
  Table,
  when,
} from "../../components/ui";

// Staff accounts and their roles. Only a super admin opens this page — an
// admin can run the shop but cannot create other admins.
const ROLE_TONE = { super_admin: "accent", admin: "ok", store_manager: "warn" };

const ROLE_BLURB = {
  super_admin: "",
  admin: "Runs the shop day to day and manages staff.",
  store_manager: "Looks after catalog, stock and orders.",
  delivery_partner:
    "Delivers orders. Signs in to the delivery app with email and password.",
};

const BLANK = {
  name: "",
  phone: "",
  email: "",
  role: "store_manager",
  status: "active",
  password: "",
};

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
    const timer = setTimeout(
      () => {
        setLoading(true);
        api
          .get("/staff", {
            limit: 20,
            page,
            ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
          })
          .then((data) => {
            setItems(data.items);
            setMeta(data.meta);
          })
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false));
      },
      filters.search ? 250 : 0,
    );
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
    <div className="page products-page users-page">
      <div className="page-head">
        <div>
          <h1>Users</h1>
        </div>
        <button
          className="btn primary"
          onClick={() => navigate("/settings/users/new")}
        >
          + Add user
        </button>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">
        {deleted
          ? `${deleted} deleted.`
          : saved
            ? `${saved} ${created ? "added" : "saved"}.`
            : ""}
      </Banner>

      <div className="toolbar products-filters">
        <span className="search-field">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search"
            placeholder="Search by name, phone or email…"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </span>
        <div className="chip-row user-tabs" role="tablist" aria-label="Role">
          <button type="button" role="tab" aria-selected={filters.role === ""} className={`cat-chip small${filters.role === "" ? " on" : ""}`} onClick={() => setFilter("role", "")}>All roles</button>
          {roles.map((r) => (
            <button key={r.key} type="button" role="tab" aria-selected={filters.role === r.key} className={`cat-chip small${filters.role === r.key ? " on" : ""}`} onClick={() => setFilter("role", r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="chip-row user-tabs" role="tablist" aria-label="Status">
          {[["", "Any status"], ["active", "Active"], ["blocked", "Blocked"]].map(([value, label]) => (
            <button key={label} type="button" role="tab" aria-selected={filters.status === value} className={`cat-chip small${filters.status === value ? " on" : ""}`} onClick={() => setFilter("status", value)}>
              {label}
            </button>
          ))}
        </div>
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
                    <span className="person-cell">
                      <Avatar name={row.name || row.phone} />
                      <span className="stack">
                        <span className="row-title">
                          {row.name || "—"}{" "}
                          {row.id === me?.id && <Pill>you</Pill>}
                        </span>
                        <span className="row-sub">{row.email || "No email"}</span>
                      </span>
                    </span>
                  ),
                },
                {
                  key: "phone",
                  label: "Phone",
                  render: (row) => <span>{row.phone}</span>,
                },
                {
                  key: "role",
                  label: "Role",
                  render: (row) => (
                    <Pill tone={ROLE_TONE[row.role]}>
                      {roleLabel(row.role)}
                    </Pill>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <Pill tone={row.status === "active" ? "ok" : "danger"}>
                      {row.status}
                    </Pill>
                  ),
                },
                {
                  key: "lastLoginAt",
                  label: "Last sign-in",
                  render: (row) => (
                    <span className="muted">
                      {row.lastLoginAt ? when(row.lastLoginAt) : "Never"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  exportable: false,
                  sortable: false,
                  render: (row) => {
                    const self = row.id === me?.id;
                    return (
                      <div
                        className="inline"
                        style={{ gap: 2, justifyContent: "flex-end", flexWrap: "nowrap" }}
                      >
                        <button
                          type="button"
                          className="icon-edit"
                          title={`Edit ${row.name || row.phone}`}
                          aria-label={`Edit ${row.name || row.phone}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/settings/users/${row.id}`);
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" /></svg>
                        </button>
                        <button
                          type="button"
                          className="icon-delete"
                          aria-label={`Delete ${row.name || row.phone}`}
                          disabled={self || deleting === row.id}
                          title={
                            self
                              ? "You can't delete your own account"
                              : undefined
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfirming(row);
                          }}
                        >
                          {deleting === row.id ? "…" : (
                            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
                          )}
                        </button>
                      </div>
                    );
                  },
                },
              ]}
              rows={items}
              onRowClick={(row) => navigate(`/settings/users/${row.id}`)}
              empty={
                <Empty
                  title="No users found"
                  hint="Try clearing the filters, or add a user."
                />
              }
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
              <button
                className="btn"
                disabled={Boolean(deleting)}
                onClick={() => setConfirming(null)}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                disabled={Boolean(deleting)}
                onClick={() => removeUser(confirming)}
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            <strong>{confirming.name || confirming.phone}</strong> will no
            longer be able to sign in.
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
            back(
              `/settings/users?saved=${encodeURIComponent(saved.name)}${created ? "&created=1" : ""}`,
            )
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
  const [showPassword, setShowPassword] = useState(false);

  const set = (key, next) => setForm((f) => ({ ...f, [key]: next }));
  const role = roles.find((r) => r.key === form.role);

  const passwordProblem =
    form.password && form.password.length < minPassword
      ? `At least ${minPassword} characters`
      : "";
  const phoneProblem =
    isNew && form.phone && !/^\d{10}$/.test(form.phone) ? "10 digits" : "";
  const isPartner = form.role === "delivery_partner";
  const needsPassword = true;
  const emailProblem =
    isPartner && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
      ? "Enter a valid email"
      : "";
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
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={
              saving ||
              incomplete ||
              Boolean(passwordProblem) ||
              Boolean(phoneProblem)
            }
            onClick={submit}
          >
            {saving ? "Saving…" : isNew ? "Add user" : "Save changes"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      <div className="offer-layout">
        <div className="offer-main">
          <FormSection step="1" title="Details">
            <div className="grid cols-2">
              <Field label="Full name" error={fieldErrors.name}>
                <input
                  type="text"
                  value={form.name}
                  placeholder="e.g. Ravi Kumar"
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field label="Mobile number" error={fieldErrors.phone || phoneProblem}>
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
            >
              <input
                type="text"
                inputMode="email"
                autoComplete="off"
                value={form.email}
                placeholder="name@example.com"
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
          </FormSection>

          <FormSection step="2" title="Role">
            <div className="type-grid" role="radiogroup" aria-label="Role">
              {roles.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={form.role === r.key}
                  disabled={isSelf}
                  className={`type-tile${form.role === r.key ? " on" : ""}`}
                  onClick={() => set("role", r.key)}
                >
                  <span className="type-glyph">{r.label.charAt(0)}</span>
                  <strong>{r.label}</strong>
                </button>
              ))}
            </div>
            {isSelf ? <span className="field-error" style={{ color: "var(--text-muted)", fontSize: 12.5 }}>You can't change your own role.</span> : null}
            {fieldErrors.role ? <span className="field-error" style={{ color: "var(--danger)", fontSize: 12.5 }}>{fieldErrors.role}</span> : null}

            {role && (
              <div className="perm-box">
                <div className="perm-box-title">{role.label} can</div>
                <div className="perm-chips">
                  {(showAllPerms ? role.permissions : role.permissions.slice(0, 5)).map((p) => (
                    <span key={p} className="perm-chip">
                      {p}
                    </span>
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
          </FormSection>

          {!isNew && (
            <FormSection step="3" title="Account">
              <Field label="Status">
                <Segmented
                  value={form.status}
                  onChange={(v) => !isSelf && set("status", v)}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "blocked", label: "Blocked" },
                  ]}
                />
              </Field>
              {isSelf ? <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>You can't block your own account.</span> : null}
            </FormSection>
          )}

          <FormSection step={isNew ? "3" : "4"} title="Sign-in">
            <Field
              label={isNew ? "Password" : "Reset password (optional)"}
              error={fieldErrors.password || passwordProblem}
            >
              <span className="affix">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  placeholder={isNew ? `At least ${minPassword} characters` : "Leave empty to keep the current one"}
                  onChange={(e) => set("password", e.target.value)}
                />
                <button type="button" className="affix-tag end affix-button" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </Field>
          </FormSection>
        </div>

        <aside className="offer-preview" aria-label="Preview">
          <span className="newcat-preview-label">Preview</span>
          <div className="newcat-tile">
            <Avatar name={form.name || form.phone} size={72} />
            <strong>{form.name.trim() || "Full name"}</strong>
            <span className="newcat-where">{role?.label || form.role}</span>
            <span className="muted" style={{ fontSize: 12.5 }}>{form.phone || "Mobile number"}</span>
            {form.email ? <span className="muted" style={{ fontSize: 12.5 }}>{form.email}</span> : null}
          </div>
          <ul className="offer-facts">
            <li><span>Status</span><b>{form.status}</b></li>
            <li><span>Permissions</span><b>{role?.permissions?.length ?? 0}</b></li>
            <li><span>Signs in with</span><b>{isPartner ? "Email + password" : "Mobile + password"}</b></li>
          </ul>
        </aside>
      </div>
    </Modal>
  );
}
