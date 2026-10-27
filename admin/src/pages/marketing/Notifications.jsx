import Select from "../../components/Select";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import {
  Banner,
  Card,
  Divider,
  Empty,
  Field,
  Loading,
  Modal,
  Pagination,
  Pill,
  Stat,
  Table,
  Tabs,
  when,
} from "../../components/ui";

const CHANNEL_LABEL = {
  push: "Push",
  sms: "SMS",
  email: "Email",
  whatsapp: "WhatsApp",
  inapp: "In-app",
};

const STATUS_TONE = {
  sent: "ok",
  failed: "danger",
  skipped: "warn",
  queued: "info",
};

const AUDIENCE_LABEL = {
  all: "Every active customer",
  new: "Signed up, never ordered",
  repeat: "Ordered more than once",
  lapsed: "Has not ordered in 30 days",
};

export default function Notifications() {
  const [tab, setTab] = useState("templates");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: "templates", label: "Templates" },
          { key: "broadcast", label: "Broadcast" },
          { key: "log", label: "Delivery log" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "templates" && <Templates />}
      {tab === "broadcast" && <Broadcast />}
      {tab === "log" && <DeliveryLog />}
    </div>
  );
}

// ---------------------------------------------------------------- templates

function Templates() {
  const { can } = useAuth();
  const canManage = can("marketing.manage");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const openTemplate = (template) =>
    navigate(
      template?.id
        ? `/marketing/notifications/templates/${template.id}`
        : "/marketing/notifications/templates/new",
    );

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/notifications/templates")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;

  const templates = data?.templates || [];
  const transactional = templates.filter((t) => t.category === "transactional");
  const marketing = templates.filter((t) => t.category === "marketing");

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="page-head" style={{ marginBottom: 12 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          {templates.length} templates covering {data?.events?.length || 0}{" "}
          events.
        </span>
        {canManage ? (
          <button className="btn" onClick={() => openTemplate(null)}>
            + New template
          </button>
        ) : null}
      </div>

      <Group
        title="Order updates"
        rows={transactional}
        canManage={canManage}
        onEdit={openTemplate}
      />

      <Group
        title="Offers and campaigns"
        rows={marketing}
        canManage={canManage}
        onEdit={openTemplate}
      />
    </>
  );
}

// /marketing/notifications/templates/new and …/:id — the template form as a page.
export function TemplateFormPage() {
  return (
    <FormRoute
      backTo="/marketing/notifications"
      backLabel="Notifications"
      load={async (id) => {
        const data = await api.get("/notifications/templates");
        const template = id
          ? (data.templates || []).find((t) => t.id === id)
          : {};
        return template
          ? {
              template,
              events: data.events || [],
              channels: data.channels || Object.keys(CHANNEL_LABEL),
            }
          : null;
      }}
      render={({ template, events, channels }, back) => (
        <TemplateModal
          template={template}
          events={events}
          channels={channels}
          onClose={back}
          onSaved={back}
        />
      )}
    />
  );
}

function Group({ title, rows, canManage, onEdit }) {
  return (
    <Card title={title} tight style={{ marginBottom: 14 }}>
      <Table
        title={title}
        columns={[
          {
            key: "name",
            label: "Template",
            render: (row) => (
              <div className="stack">
                <span className="row-title">{row.name}</span>
                <span className="row-sub mono" style={{ fontSize: 11.5 }}>
                  {row.event}
                </span>
              </div>
            ),
          },
          {
            key: "copy",
            label: "Reads as",
            render: (row) => (
              <div className="stack">
                <span>{row.default?.title || "—"}</span>
                <span className="row-sub">{row.default?.body}</span>
              </div>
            ),
          },
          {
            key: "channels",
            label: "Goes out on",
            render: (row) => (
              <div className="inline" style={{ gap: 4, flexWrap: "wrap" }}>
                {(row.channels || []).map((channel) => (
                  <Pill key={channel}>{CHANNEL_LABEL[channel] || channel}</Pill>
                ))}
              </div>
            ),
          },
          {
            key: "audience",
            label: "Who",
            render: (row) => (
              <span className="muted">{row.audience.split("_").join(" ")}</span>
            ),
          },
          {
            key: "enabled",
            label: "",
            render: (row) =>
              row.enabled ? (
                <Pill tone="ok">on</Pill>
              ) : (
                <Pill tone="danger">off</Pill>
              ),
          },
        ]}
        rows={rows}
        onRowClick={canManage ? (row) => onEdit(row) : undefined}
        empty={<Empty title="No templates in this group" />}
      />
    </Card>
  );
}

function TemplateModal({ template, events, channels, onClose, onSaved }) {
  const isNew = !template.id;
  const [form, setForm] = useState({
    name: template.name || "",
    event: template.event || "CUSTOM",
    description: template.description || "",
    audience: template.audience || "customer",
    category: template.category || "transactional",
    channels: template.channels || ["push", "inapp"],
    enabled: template.enabled !== false,
    default: { title: "", body: "", deeplink: "", ...(template.default || {}) },
  });
  const [overrides, setOverrides] = useState(() => {
    const seed = {};
    for (const channel of Object.keys(CHANNEL_LABEL)) {
      if (template[channel]?.title || template[channel]?.body)
        seed[channel] = template[channel];
    }
    return seed;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleChannel(channel) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(channel)
        ? f.channels.filter((c) => c !== channel)
        : [...f.channels, channel],
    }));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const payload = { ...form, ...overrides };
      if (isNew) await api.post("/notifications/templates", payload);
      else await api.patch(`/notifications/templates/${template.id}`, payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? "New template" : form.name}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || !form.name}
            onClick={save}
          >
            {busy ? "Saving…" : "Save template"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      <div className="grid cols-2">
        <Field label="Name">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field
          label="Fires on"
          help={isNew ? "The event that triggers it." : ""}
        >
          <Select
            value={form.event}
            disabled={!isNew}
            onChange={(e) => setForm({ ...form, event: e.target.value })}
          >
            {events.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid cols-3">
        <Field label="Audience">
          <Select
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
          >
            <option value="customer">Customers</option>
            <option value="delivery_partner">Delivery partners</option>
            <option value="admin">Staff</option>
          </Select>
        </Field>
        <Field label="Kind">
          <Select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="transactional">Transactional</option>
            <option value="marketing">Marketing</option>
          </Select>
        </Field>
        <Field label="Enabled">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span>{form.enabled ? "Sending" : "Paused"}</span>
          </label>
        </Field>
      </div>

      <div className="section-label">Channels</div>
      <div
        className="inline"
        style={{ gap: 8, flexWrap: "wrap", marginBottom: 14 }}
      >
        {channels.map((channel) => (
          <button
            key={channel}
            type="button"
            className={`chip ${form.channels.includes(channel) ? "on" : ""}`}
            onClick={() => toggleChannel(channel)}
          >
            {CHANNEL_LABEL[channel] || channel}
          </button>
        ))}
      </div>

      <div className="section-label">Default copy</div>
      <CopyFields
        value={form.default}
        onChange={(next) => setForm({ ...form, default: next })}
      />

      <Divider style={{ margin: "16px 0" }} />

      <div className="section-label">Per-channel wording</div>
      {form.channels
        .filter((channel) => channel !== "inapp")
        .map((channel) => (
          <div key={channel} style={{ marginBottom: 12 }}>
            <div className="section-label" style={{ fontSize: 11.5 }}>
              {CHANNEL_LABEL[channel] || channel}
            </div>
            <CopyFields
              value={
                overrides[channel] || { title: "", body: "", deeplink: "" }
              }
              onChange={(next) =>
                setOverrides({ ...overrides, [channel]: next })
              }
              compact
            />
          </div>
        ))}
    </Modal>
  );
}

function CopyFields({ value, onChange, compact }) {
  return (
    <>
      <div className="grid cols-2">
        <Field label="Title">
          <input
            type="text"
            value={value.title || ""}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </Field>
        {!compact ? (
          <Field label="Deeplink">
            <input
              type="text"
              value={value.deeplink || ""}
              onChange={(e) => onChange({ ...value, deeplink: e.target.value })}
            />
          </Field>
        ) : null}
      </div>
      <Field label="Body">
        <textarea
          rows={compact ? 2 : 3}
          value={value.body || ""}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
        />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------- broadcast

function Broadcast() {
  const { can } = useAuth();
  const canManage = can("marketing.manage");

  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [event, setEvent] = useState("");
  const [context, setContext] = useState({
    title: "",
    body: "",
    offerCode: "",
  });
  // Either a built-in segment or "group:<id>" for a saved customer group.
  const [audience, setAudience] = useState("all");
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/notifications/templates")
      .then((data) => {
        const marketing = (data.templates || []).filter(
          (t) => t.category === "marketing",
        );
        setTemplates(marketing);
        if (marketing.length) setEvent(marketing[0].event);
      })
      .catch((err) => setError(err.message));

    api
      .get("/customers/groups/all")
      .then((d) => setGroups(d.groups || []))
      .catch(() => {});
  }, []);

  const selected = templates.find((t) => t.event === event);
  const group = groups.find((g) => `group:${g.id}` === audience);
  const audienceLabel = group
    ? `the “${group.name}” group (${group.memberCount})`
    : AUDIENCE_LABEL[audience] || audience;

  async function send() {
    setBusy(true);
    setError("");
    try {
      const payload = group
        ? { event, context, group: group.id }
        : { event, context, segment: audience };
      const data = await api.post("/notifications/broadcast", payload);
      setResult(data);
      setConfirming(false);
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <Empty
        title="You can read campaigns but not send them"
        hint="Sending needs the marketing.manage permission."
      />
    );
  }

  return (
    <div className="grid split">
      <Card title="Send a campaign">
        <Banner tone="error">{error}</Banner>

        {!templates.length ? (
          <Empty
            title="No marketing templates yet"
            hint="Create one on the Templates tab — only marketing templates can be broadcast."
          />
        ) : (
          <>
            <Field label="Template">
              <Select value={event} onChange={(e) => setEvent(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.event} value={t.event}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Who gets it">
              <Select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="all">{AUDIENCE_LABEL.all}</option>
                <option value="new">{AUDIENCE_LABEL.new}</option>
                <option value="repeat">{AUDIENCE_LABEL.repeat}</option>
                <option value="lapsed">{AUDIENCE_LABEL.lapsed}</option>
                {groups.length ? (
                  <optgroup label="Saved groups">
                    {groups.map((g) => (
                      <option key={g.id} value={`group:${g.id}`}>
                        {g.name} ({g.memberCount})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            </Field>

            <Divider style={{ margin: "14px 0" }} />

            <div className="section-label">Fill the placeholders</div>
            <Field label="Headline">
              <input
                type="text"
                value={context.title}
                onChange={(e) =>
                  setContext({ ...context, title: e.target.value })
                }
              />
            </Field>
            <Field label="Message">
              <textarea
                rows={3}
                value={context.body}
                onChange={(e) =>
                  setContext({ ...context, body: e.target.value })
                }
              />
            </Field>
            <Field label="Offer code">
              <input
                type="text"
                value={context.offerCode}
                onChange={(e) =>
                  setContext({ ...context, offerCode: e.target.value })
                }
              />
            </Field>

            <button
              className="btn primary"
              style={{ marginTop: 12 }}
              disabled={busy || !event}
              onClick={() => setConfirming(true)}
            >
              Review and send
            </button>
          </>
        )}
      </Card>

      <div>
        <Card title="Preview" style={{ marginBottom: 14 }}>
          {selected ? (
            <div className="preview-push">
              <strong>
                {fill(selected.default?.title, context) ||
                  context.title ||
                  "Your headline"}
              </strong>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                {fill(selected.default?.body, context) ||
                  context.body ||
                  "Your message goes here."}
              </p>
              <div
                className="inline"
                style={{ gap: 4, marginTop: 10, flexWrap: "wrap" }}
              >
                {(selected.channels || []).map((channel) => (
                  <Pill key={channel}>{CHANNEL_LABEL[channel] || channel}</Pill>
                ))}
              </div>
            </div>
          ) : (
            <Empty title="Pick a template to preview it" />
          )}
        </Card>

        {result ? (
          <div className="grid cols-2">
            <Stat label="In the audience" value={result.audience} />
            <Stat
              label="Actually sent"
              value={result.sent}
              tone="ok"
              foot={`${result.audience - result.sent} skipped`}
            />
          </div>
        ) : (
          <Card>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Anyone who has turned offers off is skipped and counted — the
              difference between the two numbers after a send is your opt-out
              rate.
            </p>
          </Card>
        )}
      </div>

      {confirming ? (
        <Modal
          title="Send this campaign?"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button className="btn primary" disabled={busy} onClick={send}>
                {busy ? "Sending…" : "Send it"}
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            This goes to <strong>{audienceLabel}</strong> on{" "}
            {(selected?.channels || [])
              .map((c) => CHANNEL_LABEL[c] || c)
              .join(", ")}
            .
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            There is no unsend. Read the preview once more before you confirm.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function fill(text, context) {
  if (!text) return "";
  return text.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (_m, key) => context[key] ?? "",
  );
}

// ---------------------------------------------------------------- log

function DeliveryLog() {
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ event: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api
      .get("/notifications/templates")
      .then((d) => setEvents(d.events || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get("/notifications/log", { ...filters, limit: 25 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <Banner tone="error">{error}</Banner>

      <div className="toolbar">
        <Select
          value={filters.event}
          onChange={(e) => setFilters({ event: e.target.value, page: 1 })}
        >
          <option value="">Every event</option>
          {events.map((event) => (
            <option key={event} value={event}>
              {event}
            </option>
          ))}
        </Select>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 12.5 }}>
          What was attempted and how it went — read this when someone says they
          were never told.
        </span>
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Delivery log"
              columns={[
                {
                  key: "when",
                  label: "When",
                  render: (row) => (
                    <span className="muted">{when(row.createdAt)}</span>
                  ),
                },
                {
                  key: "user",
                  label: "To",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.user?.name || "—"}</span>
                      <span className="row-sub">{row.user?.phone}</span>
                    </div>
                  ),
                },
                {
                  key: "event",
                  label: "Message",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.title}</span>
                      <span className="row-sub mono" style={{ fontSize: 11.5 }}>
                        {row.event}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "channels",
                  label: "Channels",
                  render: (row) => (
                    <div
                      className="inline"
                      style={{ gap: 4, flexWrap: "wrap" }}
                    >
                      {(row.channels || []).map((c) => (
                        <Pill key={c.channel} tone={STATUS_TONE[c.status]}>
                          {CHANNEL_LABEL[c.channel] || c.channel}
                          {c.status !== "sent" ? ` · ${c.status}` : ""}
                        </Pill>
                      ))}
                    </div>
                  ),
                },
                {
                  key: "why",
                  label: "Notes",
                  render: (row) => {
                    const note = (row.channels || []).find(
                      (c) => c.reason || c.error,
                    );
                    return note ? (
                      <span className="row-sub">
                        {note.reason || note.error}
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    );
                  },
                },
                {
                  key: "readAt",
                  label: "Read",
                  render: (row) =>
                    row.readAt ? (
                      <Pill tone="ok">read</Pill>
                    ) : (
                      <span className="faint">unread</span>
                    ),
                },
              ]}
              rows={data.items}
              empty={<Empty title="Nothing sent yet" />}
            />
            <Pagination
              meta={data.meta}
              onPage={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </Card>
    </>
  );
}
