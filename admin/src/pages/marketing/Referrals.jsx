import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, confirmDialog } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  Banner, Card, DateRange, dateRange, Empty, Field, Loading, Modal, Pagination, Pill, Stat, Switch, Table, Tabs, rupees, when,
} from "../../components/ui";
import { Select } from "../../components/SelectMenu";

// Referral & Rewards: what the programme has done (overview), who referred
// whom (referrals), the coupons it issued, and its rules. The engine does the
// counting and issuing (backend referrals/referral.service.js) — this page
// reads it, edits the rules and makes audited corrections.

const COUPON_TONES = { available: "ok", reserved: "info", redeemed: "", expired: "warn", revoked: "danger" };
const FRIEND_STATUS = {
  pending: { label: "Awaiting first purchase", tone: "info" },
  active: { label: "Purchasing", tone: "ok" },
  rewarded: { label: "Purchasing", tone: "ok" },
  void: { label: "Void", tone: "danger" },
};

const person = (user) => (
  <div className="stack">
    <span>{user?.name || "—"}</span>
    <span className="row-sub">{user?.phone}</span>
  </div>
);

export default function Referrals() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "referrals", label: "Referrals" },
    { key: "coupons", label: "Coupons" },
    ...(can("settings.manage") ? [{ key: "rules", label: "Reward rules" }] : []),
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Referral &amp; Rewards</h1>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(key) => setParams({ tab: key })} />
      {tab === "overview" ? <Overview /> : null}
      {tab === "referrals" ? <ReferralList canManage={can("marketing.manage")} /> : null}
      {tab === "coupons" ? <CouponList canManage={can("marketing.manage")} /> : null}
      {tab === "rules" && can("settings.manage") ? <Rules /> : null}
    </div>
  );
}

// ---------------------------------------------------------------- overview

function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/referrals/stats").then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Loading />;
  const s = data.stats;

  return (
    <>
      {s.rewardsOwed ? (
        <Banner tone="warn">
          {s.rewardsOwed} earned reward(s) are waiting to be issued — the scheduler retries every 10 minutes.
        </Banner>
      ) : null}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Referred customers" value={s.referred} foot={`${s.awaitingFirst} awaiting a first purchase`} />
        <Stat label="Qualifying purchases" value={s.qualifyingPurchases} foot={`${s.purchasing} friends purchasing`} />
        <Stat label="Rewards issued" value={s.couponsIssued} foot={`${rupees(s.valueIssued)} in coupons`} />
        <Stat
          label="Rewards redeemed"
          value={s.couponsRedeemed}
          foot={`${rupees(s.valueRedeemed)} discounted · ${s.couponsAvailable} unused`}
        />
      </div>

      <div className="grid cols-2">
        <Card title="Recent referrals" tight>
          <Table
            columns={[
              { key: "referrer", label: "Referred by", render: (r) => r.referrer?.name || "—" },
              { key: "referee", label: "New customer", render: (r) => r.referee?.name || r.referee?.phone || "—" },
              { key: "count", label: "Purchases", align: "right", render: (r) => r.qualifyingPurchases },
              { key: "createdAt", label: "Joined", render: (r) => when(r.createdAt) },
            ]}
            rows={data.recentReferrals}
            empty={<Empty title="No referrals yet" />}
          />
        </Card>
        <Card title="Recently issued coupons" tight>
          <Table
            columns={[
              { key: "owner", label: "Customer", render: (c) => c.owner?.name || c.owner?.phone || "—" },
              { key: "amount", label: "Value", align: "right", render: (c) => rupees(c.amount) },
              { key: "status", label: "Status", render: (c) => <Pill tone={COUPON_TONES[c.status]}>{c.status}</Pill> },
              { key: "issuedAt", label: "Issued", render: (c) => when(c.issuedAt) },
            ]}
            rows={data.recentCoupons}
            empty={<Empty title="No coupons issued yet" />}
          />
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- referrals

function ReferralList({ canManage }) {
  const [filters, setFilters] = useState(() => ({ search: "", status: "", minPurchases: "", ...dateRange(), page: 1 }));
  const [data, setData] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/referrals", { ...filters, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  return (
    <>
      <Banner tone="error">{error}</Banner>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name, phone or referral code…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 280 }}
          aria-label="Search referrals"
        />
        <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Awaiting first purchase</option>
          <option value="active">Purchasing</option>
          <option value="void">Void</option>
        </Select>
        <Select value={filters.minPurchases} onChange={(e) => set("minPurchases", e.target.value)}>
          <option value="">Any purchases</option>
          {[1, 3, 5, 10].map((n) => (
            <option key={n} value={n}>{n}+ purchases</option>
          ))}
        </Select>
        <span className="spacer" />
        <DateRange value={filters} onChange={(range) => setFilters((f) => ({ ...f, ...range, page: 1 }))} />
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Referrals"
              onRowClick={(row) => setOpen(row.id)}
              columns={[
                {
                  key: "referrer",
                  label: "Referred by",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.referrer?.name || "—"}</span>
                      <span className="row-sub">{row.referrer?.phone} · {row.code}</span>
                    </div>
                  ),
                },
                { key: "referee", label: "New customer", render: (row) => person(row.referee) },
                { key: "count", label: "Qualifying purchases", align: "right", render: (row) => row.qualifyingPurchases },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => {
                    const key = row.status === "void" ? "void" : row.qualifyingPurchases > 0 ? "active" : "pending";
                    return <Pill tone={FRIEND_STATUS[key].tone}>{FRIEND_STATUS[key].label}</Pill>;
                  },
                },
                { key: "source", label: "Via", render: (row) => row.source || "—" },
                { key: "createdAt", label: "Joined", render: (row) => when(row.createdAt) },
              ]}
              rows={data.items}
              empty={<Empty title="No referrals" hint="They appear here when a new customer uses someone's code." />}
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>

      {open ? <ReferralDetail id={open} canManage={canManage} onClose={() => setOpen(null)} onChanged={load} /> : null}
    </>
  );
}

function ReferralDetail({ id, canManage, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const load = useCallback(() => {
    api.get(`/referrals/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id]);
  useEffect(load, [load]);

  async function act(path, body) {
    setBusy(true);
    try {
      await api.post(`/referrals/${id}/${path}`, body);
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const r = data?.referral;
  const p = data?.progress;

  return (
    <Modal title="Referral" onClose={onClose} wide>
      <Banner tone="error">{error}</Banner>
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="grid cols-3" style={{ marginBottom: 12 }}>
            <Field label="Referred by">{person(r.referrer)}</Field>
            <Field label="New customer">{person(r.referee)}</Field>
            <Field label="Code / joined">
              <span>{r.code} · {when(r.createdAt)}</span>
            </Field>
          </div>
          {r.status === "void" ? <Banner tone="warn">Void: {r.voidReason}</Banner> : null}
          <p>
            <strong>{p.qualifyingPurchases}</strong> qualifying purchase(s).{" "}
            {p.nextMilestone
              ? `Next reward: ${rupees(p.nextMilestone.reward)} at ${p.nextMilestone.purchases} (${p.nextMilestone.remaining} to go).`
              : "No further rewards."}
          </p>
          <div className="progress" style={{ marginBottom: 16 }}>
            <div className="progress-bar" style={{ width: `${p.percent}%` }} />
          </div>

          <h3>Purchases</h3>
          <Table
            columns={[
              { key: "orderCode", label: "Order", render: (x) => x.orderCode || "—" },
              { key: "amount", label: "Qualifying value", align: "right", render: (x) => rupees(x.amount) },
              {
                key: "status",
                label: "Counted",
                render: (x) => (
                  <div className="stack">
                    <Pill tone={x.status === "counted" ? "ok" : x.status === "reversed" ? "danger" : "warn"}>
                      {x.status === "counted" ? `#${x.ordinal}` : x.status}
                    </Pill>
                    {x.note ? <span className="row-sub">{x.note}</span> : null}
                  </div>
                ),
              },
              {
                key: "reward",
                label: "Reward",
                align: "right",
                render: (x) => (x.referrerReward ? rupees(x.referrerReward) : "—"),
              },
              { key: "countedAt", label: "When", render: (x) => when(x.countedAt) },
            ]}
            rows={[...r.purchases].reverse()}
            empty={<Empty title="No purchases recorded yet" />}
          />

          <h3 style={{ marginTop: 16 }}>Coupons issued</h3>
          <Table
            columns={[
              { key: "code", label: "Coupon", render: (c) => <span className="tag">{c.code}</span> },
              { key: "owner", label: "To", render: (c) => (c.source === "referral_welcome" ? "New customer (welcome)" : "Referrer") },
              { key: "milestone", label: "Milestone", align: "right", render: (c) => c.milestone },
              { key: "amount", label: "Value", align: "right", render: (c) => rupees(c.amount) },
              {
                key: "status",
                label: "Status",
                render: (c) => (
                  <div className="stack">
                    <Pill tone={COUPON_TONES[c.status]}>{c.status}</Pill>
                    {c.orderCode ? <span className="row-sub">{c.orderCode}</span> : null}
                  </div>
                ),
              },
            ]}
            rows={data.coupons}
            empty={<Empty title="No coupons yet" />}
          />

          {canManage && r.status !== "void" ? (
            <div className="inline" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
              <button className="btn" disabled={busy} onClick={() => act("recalculate")}>
                Recalculate from orders
              </button>
              <input
                placeholder="Reason to void (required)"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button
                className="btn danger"
                disabled={busy || !voidReason.trim()}
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: "Void referral?",
                    message: "Void this referral? Nothing more will be counted or earned.",
                    confirmText: "Void referral",
                    danger: true,
                  });
                  if (ok) act("void", { reason: voidReason });
                }}
              >
                Void referral
              </button>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- coupons

function CouponList({ canManage }) {
  const [filters, setFilters] = useState(() => ({ search: "", status: "", source: "", ...dateRange(), page: 1 }));
  const [data, setData] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/referrals/coupons", { ...filters, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? value : 1 }));

  async function revoke(coupon) {
    const reason = await confirmDialog({
      title: "Revoke coupon?",
      message: `Revoke ${coupon.code} (${rupees(coupon.amount)})?`,
      input: { label: "Reason", required: true },
      confirmText: "Revoke coupon",
      danger: true,
    });
    if (!reason) return;
    try {
      await api.post(`/referrals/coupons/${coupon.id}/revoke`, { reason });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Banner tone="error">{error}</Banner>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by coupon code, name or phone…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ minWidth: 280 }}
          aria-label="Search coupons"
        />
        <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          {["available", "reserved", "redeemed", "expired", "revoked"].map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
        <Select value={filters.source} onChange={(e) => set("source", e.target.value)}>
          <option value="">All rewards</option>
          <option value="referral">Referrer milestones</option>
          <option value="referral_welcome">Welcome rewards</option>
        </Select>
        <span className="spacer" />
        <DateRange value={filters} onChange={(range) => setFilters((f) => ({ ...f, ...range, page: 1 }))} />
      </div>

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Reward coupons"
              columns={[
                { key: "code", label: "Code", render: (c) => <span className="tag">{c.code}</span> },
                { key: "owner", label: "Customer", render: (c) => person(c.owner) },
                {
                  key: "title",
                  label: "Reward",
                  render: (c) => (
                    <div className="stack">
                      <span>{c.title}</span>
                      <span className="row-sub">
                        {c.source === "referral" ? `Milestone ${c.milestone}` : "Welcome"}
                        {c.sourceOrderCode ? ` · from ${c.sourceOrderCode}` : ""}
                      </span>
                    </div>
                  ),
                },
                { key: "amount", label: "Value", align: "right", render: (c) => rupees(c.amount) },
                {
                  key: "status",
                  label: "Status",
                  render: (c) => (
                    <div className="stack">
                      <Pill tone={COUPON_TONES[c.status]}>{c.status}</Pill>
                      {c.orderCode ? <span className="row-sub">{c.orderCode} · −{rupees(c.discountApplied)}</span> : null}
                      {c.revokedReason ? <span className="row-sub">{c.revokedReason}</span> : null}
                    </div>
                  ),
                },
                { key: "issuedAt", label: "Issued", render: (c) => when(c.issuedAt) },
                { key: "expiresAt", label: "Expires", render: (c) => when(c.expiresAt) },
                {
                  key: "actions",
                  label: "",
                  render: (c) =>
                    canManage && c.status === "available" ? (
                      <button className="btn sm ghost" onClick={() => revoke(c)}>Revoke</button>
                    ) : null,
                },
              ]}
              rows={data.items}
              empty={<Empty title="No coupons" hint="Coupons are issued when referred friends reach a milestone." />}
            />
            <Pagination meta={data.meta} onPage={(page) => set("page", page)} />
          </>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- rules

const toPaise = (value) => Math.round((Number(value) || 0) * 100);
const toRupees = (paise) => (paise ? paise / 100 : 0);

function Rules() {
  const [draft, setDraft] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/settings"), api.get("/catalog/categories/tree", { status: "all" }).catch(() => ({ tree: [] }))])
      .then(([{ settings }, { tree }]) => {
        const r = settings.referral;
        setDraft({
          ...r,
          milestones: (r.milestones || []).map((m) => ({ purchases: m.purchases, reward: toRupees(m.reward) })),
          repeatReward: toRupees(r.repeatReward),
          refereeReward: toRupees(r.refereeReward),
          minQualifyingOrderValue: toRupees(r.minQualifyingOrderValue),
          couponMinOrderValue: toRupees(r.couponMinOrderValue),
          excludedCategories: (r.excludedCategories || []).map(String),
        });
        const flat = [];
        const walk = (nodes, depth) => nodes.forEach((n) => {
          flat.push({ id: n.id, name: `${"— ".repeat(depth)}${n.name}` });
          if (depth < 1) walk(n.children || [], depth + 1);
        });
        walk(tree || [], 0);
        setCategories(flat);
      })
      .catch((err) => setError(err.message));
  }, []);

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setMilestone = (index, key, value) =>
    setDraft((d) => ({ ...d, milestones: d.milestones.map((m, i) => (i === index ? { ...m, [key]: value } : m)) }));

  const preview = useMemo(() => {
    if (!draft) return [];
    const lines = [...draft.milestones]
      .filter((m) => Number(m.purchases) > 0)
      .sort((a, b) => a.purchases - b.purchases)
      .map((m) => `Friend's ${m.purchases}${suffix(m.purchases)} qualifying purchase → ₹${Number(m.reward) || 0} coupon to the referrer`);
    if (Number(draft.repeatEvery) > 0) {
      lines.push(`Then every ${draft.repeatEvery} more purchases → ₹${Number(draft.repeatReward) || 0} coupon`);
    }
    if (Number(draft.refereeReward) > 0) lines.push(`New customer's first qualifying purchase → ₹${draft.refereeReward} welcome coupon`);
    lines.push(`A purchase qualifies when delivered and paid, with at least ₹${Number(draft.minQualifyingOrderValue) || 0} of items after offers`);
    lines.push(
      `Coupons last ${draft.couponExpiryDays} days${Number(draft.couponMinOrderValue) ? `, need a ₹${draft.couponMinOrderValue} cart` : ""}, ` +
        `${draft.combinable ? "can" : "cannot"} be used with another coupon code`
    );
    if (Number(draft.maxRewardsPerReferrer) > 0) lines.push(`At most ${draft.maxRewardsPerReferrer} rewards per referrer`);
    return lines;
  }, [draft]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const { settings } = await api.patch("/settings/referral", {
        enabled: draft.enabled,
        milestones: draft.milestones.map((m) => ({ purchases: Number(m.purchases), reward: toPaise(m.reward) })),
        repeatEvery: Number(draft.repeatEvery) || 0,
        repeatReward: toPaise(draft.repeatReward),
        refereeReward: toPaise(draft.refereeReward),
        minQualifyingOrderValue: toPaise(draft.minQualifyingOrderValue),
        couponExpiryDays: Number(draft.couponExpiryDays),
        couponMinOrderValue: toPaise(draft.couponMinOrderValue),
        combinable: draft.combinable,
        maxRewardsPerReferrer: Number(draft.maxRewardsPerReferrer) || 0,
        excludedCategories: draft.excludedCategories,
      });
      const r = settings.referral;
      setDraft((d) => ({ ...d, milestones: r.milestones.map((m) => ({ purchases: m.purchases, reward: toRupees(m.reward) })) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!draft) return error ? <Banner tone="error">{error}</Banner> : <Loading />;

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <Card title="Reward rules">
        <Banner tone="error">{error}</Banner>
        <div style={{ marginBottom: 14 }}>
          <Switch
            checked={Boolean(draft.enabled)}
            onChange={(on) => setDraft((d) => ({ ...d, enabled: on }))}
            onLabel="Referral programme is on"
            offLabel="Referral programme is off"
          />
          <p className="row-sub" style={{ marginTop: 6 }}>
            Off: no new referrals, and deliveries while off do not count. Existing referrals, progress and issued coupons
            are kept; progress resumes when switched back on.
          </p>
        </div>

        <h3>Milestones</h3>
        {draft.milestones.map((m, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end", marginBottom: 8 }}>
            <Field label="At purchase #">
              <input type="number" min="1" step="1" value={m.purchases} onChange={(e) => setMilestone(index, "purchases", e.target.value)} />
            </Field>
            <Field label="Reward (₹)">
              <input type="number" min="1" step="1" value={m.reward} onChange={(e) => setMilestone(index, "reward", e.target.value)} />
            </Field>
            <button
              type="button"
              className="btn ghost sm"
              style={{ marginBottom: 14 }}
              aria-label="Remove milestone"
              onClick={() => setDraft((d) => ({ ...d, milestones: d.milestones.filter((_, i) => i !== index) }))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn sm"
          onClick={() =>
            setDraft((d) => {
              const last = d.milestones.reduce((max, m) => Math.max(max, Number(m.purchases) || 0), 0);
              return { ...d, milestones: [...d.milestones, { purchases: last + 1, reward: 10 }] };
            })
          }
        >
          + Add milestone
        </button>

        <div className="grid cols-2" style={{ marginTop: 16 }}>
          <Field label="Then repeat every (purchases)" help="0 = rewards stop after the last milestone.">
            <input type="number" min="0" step="1" value={draft.repeatEvery} onChange={set("repeatEvery")} />
          </Field>
          <Field label="Repeat reward (₹)">
            <input type="number" min="0" step="1" value={draft.repeatReward} onChange={set("repeatReward")} />
          </Field>
          <Field label="Welcome coupon for the new customer (₹)" help="On their first qualifying purchase. 0 = none.">
            <input type="number" min="0" step="1" value={draft.refereeReward} onChange={set("refereeReward")} />
          </Field>
          <Field label="Minimum qualifying order (₹)" help="Items after offers; before delivery, wallet and coupons.">
            <input type="number" min="0" step="1" value={draft.minQualifyingOrderValue} onChange={set("minQualifyingOrderValue")} />
          </Field>
          <Field label="Coupon valid for (days)">
            <input type="number" min="1" step="1" value={draft.couponExpiryDays} onChange={set("couponExpiryDays")} />
          </Field>
          <Field label="Cart minimum to redeem (₹)">
            <input type="number" min="0" step="1" value={draft.couponMinOrderValue} onChange={set("couponMinOrderValue")} />
          </Field>
          <Field label="Max rewards per referrer" help="0 = no cap.">
            <input type="number" min="0" step="1" value={draft.maxRewardsPerReferrer} onChange={set("maxRewardsPerReferrer")} />
          </Field>
          <Field label="Stacking">
            <label className="checkbox">
              <input type="checkbox" checked={Boolean(draft.combinable)} onChange={set("combinable")} />
              Allow with another coupon code
            </label>
          </Field>
        </div>

        <Field label="Not discounted by reward coupons" help="Items in these categories (and below) keep full price.">
          <div style={{ maxHeight: 160, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
            {categories.map((c) => (
              <label key={c.id} className="checkbox" style={{ display: "flex" }}>
                <input
                  type="checkbox"
                  checked={draft.excludedCategories.includes(c.id)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      excludedCategories: e.target.checked
                        ? [...d.excludedCategories, c.id]
                        : d.excludedCategories.filter((id) => id !== c.id),
                    }))
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </Field>

        <button className="btn primary" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
          {saving ? "Saving…" : "Save rules"}
        </button>
      </Card>

      <Card title="What customers get">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          {preview.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Banner tone="info">
          Changes apply to purchases counted from now on. Coupons already issued keep their value and expiry; a milestone
          is never paid twice for the same friend.
        </Banner>
      </Card>
    </div>
  );
}

const suffix = (n) => {
  n = Number(n);
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
};
