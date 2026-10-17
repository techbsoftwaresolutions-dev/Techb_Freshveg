import Select from "../../components/Select";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Banner, Card, Field, Loading, Tabs } from "../../components/ui";

// One settings document, edited a section at a time — so two admins working on
// different areas do not overwrite each other with a whole-document save.
const SECTIONS = [
  { key: "company", label: "Company" },
  { key: "tax", label: "Tax" },
  { key: "payment", label: "Payment" },
  { key: "loyalty", label: "Loyalty" },
  { key: "referral", label: "Referrals" },
  { key: "delivery", label: "Delivery" },
  { key: "notifications", label: "Notifications" },
  { key: "app", label: "Apps" },
];

export default function General() {
  const [settings, setSettings] = useState(null);
  const [section, setSection] = useState("company");
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api
      .get("/settings")
      .then((data) => {
        setSettings(data.settings);
        setDraft(data.settings[section] || {});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings) setDraft(structuredClone(settings[section] || {}));
  }, [section, settings]);

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await api.patch(`/settings/${section}`, draft);
      setSettings(data.settings);
      setNotice("Saved. Every client picks this up on its next read.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page"><Loading /></div>;

  const set = (key) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.type === "number"
          ? Number(event.target.value)
          : event.target.value;
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const setNested = (parent, key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDraft((d) => ({ ...d, [parent]: { ...(d[parent] || {}), [key]: value } }));
  };

  // Money fields are stored in paise; the form works in rupees.
  const money = (key) => ({
    type: "number",
    value: (draft[key] || 0) / 100,
    onChange: (e) => setDraft((d) => ({ ...d, [key]: Math.round(Number(e.target.value) * 100) })),
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>General settings</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{notice}</Banner>

      <Tabs tabs={SECTIONS} active={section} onChange={setSection} />

      <Card>
        {section === "company" ? (
          <>
            <div className="grid cols-2">
              <Field label="Trading name"><input type="text" value={draft.name || ""} onChange={set("name")} /></Field>
              <Field label="Legal name"><input type="text" value={draft.legalName || ""} onChange={set("legalName")} /></Field>
            </div>
            <div className="grid cols-2">
              <Field label="GSTIN"><input type="text" value={draft.gstin || ""} onChange={set("gstin")} /></Field>
              <Field label="FSSAI licence"><input type="text" value={draft.fssai || ""} onChange={set("fssai")} /></Field>
            </div>
            <div className="grid cols-2">
              <Field label="Support phone"><input type="text" value={draft.supportPhone || ""} onChange={set("supportPhone")} /></Field>
              <Field label="Support email"><input type="text" value={draft.supportEmail || ""} onChange={set("supportEmail")} /></Field>
            </div>
            <Field label="Address"><textarea value={draft.address || ""} onChange={set("address")} /></Field>
          </>
        ) : null}

        {section === "tax" ? (
          <>
            <label className="checkbox" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={Boolean(draft.pricesIncludeTax)} onChange={set("pricesIncludeTax")} />
              Prices shown to customers include tax
            </label>
            <div className="grid cols-3">
              <Field label="Default tax rate (%)"><input type="number" value={draft.defaultRatePct ?? 0} onChange={set("defaultRatePct")} /></Field>
              <Field label="Home state code" help="Used to decide CGST+SGST versus IGST.">
                <input type="text" value={draft.homeStateCode || ""} onChange={set("homeStateCode")} />
              </Field>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={Boolean(draft.splitCgstSgst)} onChange={set("splitCgstSgst")} />
              Split the rate into CGST and SGST on invoices
            </label>
          </>
        ) : null}

        {section === "payment" ? (
          <>
            <div className="inline" style={{ marginBottom: 14, gap: 20, flexWrap: "wrap" }}>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.codEnabled)} onChange={set("codEnabled")} />
                Cash on delivery
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.onlineEnabled)} onChange={set("onlineEnabled")} />
                Online payment
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.allowWallet)} onChange={set("allowWallet")} />
                Allow wallet at checkout
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.allowLoyalty)} onChange={set("allowLoyalty")} />
                Allow points at checkout
              </label>
            </div>

            <div className="grid cols-2">
              <Field label="Gateway" help="API keys come from the server's environment, never from here.">
                <Select value={draft.provider || "none"} onChange={set("provider")}>
                  <option value="none">None — cash and wallet only</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                </Select>
              </Field>
              <Field label="Refunds">
                <label className="checkbox" style={{ marginTop: 8 }}>
                  <input type="checkbox" checked={Boolean(draft.autoRefundToWallet)} onChange={set("autoRefundToWallet")} />
                  Refund to wallet by default (instant)
                </label>
              </Field>
            </div>

            <Banner tone="info">
              With no gateway keys set, checkout falls back to cash on delivery rather than failing.
            </Banner>
          </>
        ) : null}

        {section === "loyalty" ? (
          <>
            <label className="checkbox" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={Boolean(draft.enabled)} onChange={set("enabled")} />
              Loyalty points are running
            </label>
            <div className="grid cols-3">
              <Field label="Rupees per point" help="₹100 spent = 1 point by default.">
                <input type="number" value={draft.rupeesPerPoint ?? 100} onChange={set("rupeesPerPoint")} />
              </Field>
              <Field label="Point value (paise)" help="10 paise = 100 points are worth ₹10.">
                <input type="number" value={draft.pointValuePaise ?? 10} onChange={set("pointValuePaise")} />
              </Field>
              <Field label="Minimum to redeem"><input type="number" value={draft.minPointsToRedeem ?? 0} onChange={set("minPointsToRedeem")} /></Field>
              <Field label="Max % of an order"><input type="number" value={draft.maxRedeemPctOfOrder ?? 0} onChange={set("maxRedeemPctOfOrder")} /></Field>
              <Field label="Points expire after (days)"><input type="number" value={draft.expiryDays ?? 0} onChange={set("expiryDays")} /></Field>
            </div>
          </>
        ) : null}

        {section === "referral" ? (
          <>
            <label className="checkbox" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={Boolean(draft.enabled)} onChange={set("enabled")} />
              Referrals are running
            </label>
            <div className="grid cols-3">
              <Field label="Reward to the referrer (₹)"><input {...money("referrerReward")} /></Field>
              <Field label="Reward to the friend (₹)"><input {...money("refereeReward")} /></Field>
              <Field label="Minimum first order (₹)" help="Below this, the referral does not pay out.">
                <input {...money("minFirstOrderValue")} />
              </Field>
            </div>
            <Banner tone="info">
              Rewards are paid when the friend's first order is <strong>delivered</strong>, not when
              they sign up.
            </Banner>
          </>
        ) : null}

        {section === "delivery" ? (
          <>
            <div className="inline" style={{ marginBottom: 14, gap: 20, flexWrap: "wrap" }}>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.slotsEnabled)} onChange={set("slotsEnabled")} />
                Let customers choose a delivery slot
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.liveTrackingEnabled)} onChange={set("liveTrackingEnabled")} />
                Live rider tracking
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.otpRequired)} onChange={set("otpRequired")} />
                Require a handover OTP
              </label>
            </div>
            <div className="grid cols-3">
              <Field label="Open slots this many days ahead">
                <input type="number" value={draft.slotDays ?? 3} onChange={set("slotDays")} />
              </Field>
            </div>
            <div className="inline" style={{ gap: 20, flexWrap: "wrap" }}>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.proofPhotoRequired)} onChange={set("proofPhotoRequired")} />
                Require a photo at handover
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.proofSignatureRequired)} onChange={set("proofSignatureRequired")} />
                Require a signature
              </label>
            </div>
          </>
        ) : null}

        {section === "notifications" ? (
          <>
            <div className="section-label">Channels</div>
            <div className="inline" style={{ gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
              {["push", "sms", "email", "whatsapp"].map((channel) => (
                <label key={channel} className="checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.channels?.[channel])}
                    onChange={setNested("channels", channel)}
                  />
                  {channel}
                </label>
              ))}
            </div>

            <div className="section-label">Abandoned cart</div>
            <label className="checkbox" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={Boolean(draft.abandonedCart?.enabled)}
                onChange={setNested("abandonedCart", "enabled")}
              />
              Nudge customers who leave something in the cart
            </label>
            <div className="grid cols-3">
              <Field label="First nudge after (minutes)">
                <input
                  type="number"
                  value={draft.abandonedCart?.firstReminderMinutes ?? 30}
                  onChange={(e) => setDraft((d) => ({ ...d, abandonedCart: { ...d.abandonedCart, firstReminderMinutes: Number(e.target.value) } }))}
                />
              </Field>
              <Field label="Second nudge after (hours)">
                <input
                  type="number"
                  value={draft.abandonedCart?.secondReminderHours ?? 6}
                  onChange={(e) => setDraft((d) => ({ ...d, abandonedCart: { ...d.abandonedCart, secondReminderHours: Number(e.target.value) } }))}
                />
              </Field>
              <Field label="Coupon in the second nudge">
                <input
                  type="text"
                  value={draft.abandonedCart?.secondReminderCoupon || ""}
                  onChange={setNested("abandonedCart", "secondReminderCoupon")}
                />
              </Field>
            </div>

            <div className="section-label">Win back</div>
            <label className="checkbox" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={Boolean(draft.winBack?.enabled)}
                onChange={setNested("winBack", "enabled")}
              />
              Message customers who have not ordered in a while
            </label>
            <div className="grid cols-3">
              <Field label="Inactive for (days)">
                <input
                  type="number"
                  value={draft.winBack?.inactiveDays ?? 30}
                  onChange={(e) => setDraft((d) => ({ ...d, winBack: { ...d.winBack, inactiveDays: Number(e.target.value) } }))}
                />
              </Field>
            </div>

            <label className="checkbox">
              <input type="checkbox" checked={Boolean(draft.lowStockAlerts)} onChange={set("lowStockAlerts")} />
              Alert staff when stock runs low
            </label>
          </>
        ) : null}

        {section === "app" ? (
          <>
            <div className="inline" style={{ gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.reviewsEnabled)} onChange={set("reviewsEnabled")} />
                Reviews
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.reviewsNeedApproval)} onChange={set("reviewsNeedApproval")} />
                Hold reviews for approval
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.wishlistEnabled)} onChange={set("wishlistEnabled")} />
                Wishlist
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(draft.guestCheckoutEnabled)} onChange={set("guestCheckoutEnabled")} />
                Guest checkout
              </label>
            </div>

            <div className="grid cols-2">
              <Field label="Minimum supported app version">
                <input type="text" value={draft.minSupportedVersion || ""} onChange={set("minSupportedVersion")} />
              </Field>
            </div>

            <label className="checkbox" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={Boolean(draft.maintenanceMode)} onChange={set("maintenanceMode")} />
              Maintenance mode — the apps show a message instead of the shop
            </label>
            {draft.maintenanceMode ? (
              <Field label="What the message says">
                <textarea value={draft.maintenanceMessage || ""} onChange={set("maintenanceMessage")} />
              </Field>
            ) : null}
          </>
        ) : null}

        <div className="divider" />
        <button className="btn primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : `Save ${SECTIONS.find((s) => s.key === section)?.label.toLowerCase()} settings`}
        </button>
      </Card>
    </div>
  );
}
