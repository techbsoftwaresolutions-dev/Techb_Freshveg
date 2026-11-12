import Select from "../../components/Select";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { Banner, Field, Loading, Tabs } from "../../components/ui";
import { Affix, FormSection, Segmented, SwitchRow } from "../../components/FormKit";
import { DEFAULT_TEMPLATE, INVOICE_TEMPLATES, invoiceHtml, sampleInvoice } from "../orders/invoice";

// One settings document, edited a section at a time — so two admins working on
// different areas do not overwrite each other with a whole-document save.
const SECTIONS = [
  { key: "company", label: "Company" },
  { key: "payment", label: "Payment" },
  { key: "loyalty", label: "Loyalty" },
  { key: "referral", label: "Referrals" },
  { key: "delivery", label: "Delivery" },
  { key: "notifications", label: "Notifications" },
  { key: "app", label: "Apps" },
  { key: "pos", label: "POS" },
  { key: "print", label: "Print" },
];

const POS_TEMPLATES = {
  standard: "Standard - scan bar, category chips, bill table and a Quick Add row",
  compact: "Compact - scan bar and a tall bill list only; best for barcode scanners",
  touch: "Touch - large product tiles first, bigger buttons; best for touch screens",
  terminal: "Terminal - full screen with its own top bar, category rail, product grid and bottom action bar; best for a dedicated counter screen",
};

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

  if (loading)
    return (
      <div className="page">
        <Loading />
      </div>
    );

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
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setDraft((d) => ({
      ...d,
      [parent]: { ...(d[parent] || {}), [key]: value },
    }));
  };

  // Money fields are stored in paise; the form works in rupees.
  const money = (key) => ({
    type: "number",
    value: (draft[key] || 0) / 100,
    onChange: (e) =>
      setDraft((d) => ({
        ...d,
        [key]: Math.round(Number(e.target.value) * 100),
      })),
  });

  // On/off rows, top-level or inside a nested block (channels, abandoned cart…).
  const flag = (key, title) => (
    <SwitchRow checked={Boolean(draft[key])} onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))} title={title} />
  );
  const nestedFlag = (parent, key, title) => (
    <SwitchRow
      checked={Boolean(draft[parent]?.[key])}
      onChange={(v) => setDraft((d) => ({ ...d, [parent]: { ...(d[parent] || {}), [key]: v } }))}
      title={title}
    />
  );
  const nestedNumber = (parent, key, fallback) => ({
    type: "number",
    value: draft[parent]?.[key] ?? fallback,
    onChange: (e) => setDraft((d) => ({ ...d, [parent]: { ...(d[parent] || {}), [key]: Number(e.target.value) } })),
  });

  return (
    <div className="page products-page settings-page">
      <div className="page-head">
        <div>
          <h1>General settings</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{notice}</Banner>

      <Tabs tabs={SECTIONS} active={section} onChange={setSection} />

      <div className="offer-main settings-main">
        {section === "company" ? (
          <>
            <FormSection step="1" title="Business">
              <div className="grid cols-2">
                <Field label="Trading name">
                  <input type="text" value={draft.name || ""} onChange={set("name")} />
                </Field>
                <Field label="Legal name">
                  <input type="text" value={draft.legalName || ""} onChange={set("legalName")} />
                </Field>
              </div>
              <div className="grid cols-2">
                <Field label="GSTIN">
                  <input type="text" className="mono" value={draft.gstin || ""} onChange={set("gstin")} />
                </Field>
                <Field label="FSSAI licence">
                  <input type="text" className="mono" value={draft.fssai || ""} onChange={set("fssai")} />
                </Field>
              </div>
            </FormSection>
            <FormSection step="2" title="Contact">
              <div className="grid cols-2">
                <Field label="Support phone">
                  <input type="text" value={draft.supportPhone || ""} onChange={set("supportPhone")} />
                </Field>
                <Field label="Support email">
                  <input type="text" value={draft.supportEmail || ""} onChange={set("supportEmail")} />
                </Field>
              </div>
              <Field label="Address">
                <textarea rows={3} value={draft.address || ""} onChange={set("address")} />
              </Field>
            </FormSection>
          </>
        ) : null}

        {section === "payment" ? (
          <>
            <FormSection step="1" title="Ways to pay">
              {flag("codEnabled", "Cash on delivery")}
              {flag("onlineEnabled", "Online payment")}
              {flag("allowWallet", "Allow wallet at checkout")}
              {flag("allowLoyalty", "Allow points at checkout")}
            </FormSection>
            <FormSection step="2" title="Gateway & refunds">
              <Field label="Gateway">
                <Segmented
                  value={draft.provider || "none"}
                  onChange={(v) => setDraft((d) => ({ ...d, provider: v }))}
                  options={[
                    { value: "none", label: "None" },
                    { value: "razorpay", label: "Razorpay" },
                    { value: "stripe", label: "Stripe" },
                  ]}
                />
              </Field>
              {flag("autoRefundToWallet", "Refund to wallet by default (instant)")}
              <Banner tone="info">
                With no gateway keys set, checkout falls back to cash on delivery
                rather than failing.
              </Banner>
            </FormSection>
          </>
        ) : null}

        {section === "loyalty" ? (
          <>
            <FormSection step="1" title="Programme">
              {flag("enabled", "Loyalty points are running")}
            </FormSection>
            <FormSection step="2" title="Earning & redeeming">
              <div className="grid cols-3">
                <Field label="Rupees per point">
                  <Affix prefix="₹">
                    <input type="number" value={draft.rupeesPerPoint ?? 100} onChange={set("rupeesPerPoint")} />
                  </Affix>
                </Field>
                <Field label="Point value">
                  <Affix suffix="paise">
                    <input type="number" value={draft.pointValuePaise ?? 10} onChange={set("pointValuePaise")} />
                  </Affix>
                </Field>
                <Field label="Minimum to redeem">
                  <Affix suffix="points">
                    <input type="number" value={draft.minPointsToRedeem ?? 0} onChange={set("minPointsToRedeem")} />
                  </Affix>
                </Field>
                <Field label="Max share of an order">
                  <Affix suffix="%">
                    <input type="number" value={draft.maxRedeemPctOfOrder ?? 0} onChange={set("maxRedeemPctOfOrder")} />
                  </Affix>
                </Field>
                <Field label="Points expire after">
                  <Affix suffix="days">
                    <input type="number" value={draft.expiryDays ?? 0} onChange={set("expiryDays")} />
                  </Affix>
                </Field>
              </div>
            </FormSection>
          </>
        ) : null}

        {section === "referral" ? (
          <>
            <FormSection step="1" title="Programme">
              {flag("enabled", "Referrals are running")}
            </FormSection>
            <FormSection step="2" title="Rewards">
              <div className="grid cols-3">
                <Field label="Reward to the referrer">
                  <Affix prefix="₹"><input {...money("referrerReward")} /></Affix>
                </Field>
                <Field label="Reward to the friend">
                  <Affix prefix="₹"><input {...money("refereeReward")} /></Affix>
                </Field>
                <Field label="Minimum first order">
                  <Affix prefix="₹"><input {...money("minFirstOrderValue")} /></Affix>
                </Field>
              </div>
              <Banner tone="info">
                Rewards are paid when the friend's first order is{" "}
                <strong>delivered</strong>, not when they sign up.
              </Banner>
            </FormSection>
          </>
        ) : null}

        {section === "delivery" ? (
          <>
            <FormSection step="1" title="Delivery options">
              {flag("slotsEnabled", "Let customers choose a delivery slot")}
              {flag("liveTrackingEnabled", "Live rider tracking")}
              <div className="grid cols-3">
                <Field label="Open slots this many days ahead">
                  <Affix suffix="days">
                    <input type="number" value={draft.slotDays ?? 3} onChange={set("slotDays")} />
                  </Affix>
                </Field>
              </div>
            </FormSection>
            <FormSection step="2" title="Proof at handover">
              {flag("otpRequired", "Require a handover OTP")}
              {flag("proofPhotoRequired", "Require a photo at handover")}
              {flag("proofSignatureRequired", "Require a signature")}
            </FormSection>
          </>
        ) : null}

        {section === "notifications" ? (
          <>
            <FormSection step="1" title="Channels">
              <div className="type-grid">
                {["push", "sms", "email", "whatsapp"].map((channel) => {
                  const on = Boolean(draft.channels?.[channel]);
                  return (
                    <button
                      key={channel}
                      type="button"
                      aria-pressed={on}
                      className={`type-tile${on ? " on" : ""}`}
                      onClick={() =>
                        setDraft((d) => ({ ...d, channels: { ...(d.channels || {}), [channel]: !on } }))
                      }
                    >
                      <span className="type-glyph">{on ? "✓" : "+"}</span>
                      <strong style={{ textTransform: "capitalize" }}>{channel === "sms" ? "SMS" : channel}</strong>
                    </button>
                  );
                })}
              </div>
            </FormSection>

            <FormSection step="2" title="Abandoned cart">
              {nestedFlag("abandonedCart", "enabled", "Nudge customers who leave something in the cart")}
              <div className="grid cols-3">
                <Field label="First nudge after">
                  <Affix suffix="min"><input {...nestedNumber("abandonedCart", "firstReminderMinutes", 30)} /></Affix>
                </Field>
                <Field label="Second nudge after">
                  <Affix suffix="hours"><input {...nestedNumber("abandonedCart", "secondReminderHours", 6)} /></Affix>
                </Field>
                <Field label="Coupon in the second nudge">
                  <input
                    type="text"
                    className="mono"
                    value={draft.abandonedCart?.secondReminderCoupon || ""}
                    onChange={setNested("abandonedCart", "secondReminderCoupon")}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection step="3" title="Owner alerts">
              <div style={{ maxWidth: 420 }}>
                <Field label="Owner WhatsApp number (with country code)">
                  <input
                    type="tel"
                    placeholder="+917010272131"
                    value={draft.ownerWhatsApp || ""}
                    onChange={set("ownerWhatsApp")}
                  />
                </Field>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                  Order alerts include the product list, customer phone, and payment status.
                </p>
              </div>
            </FormSection>

            <FormSection step="4" title="Win back">
              {nestedFlag("winBack", "enabled", "Message customers who have not ordered in a while")}
              <div className="grid cols-3">
                <Field label="Inactive for">
                  <Affix suffix="days"><input {...nestedNumber("winBack", "inactiveDays", 30)} /></Affix>
                </Field>
              </div>
            </FormSection>

            <FormSection step="5" title="Staff alerts">
              {flag("lowStockAlerts", "Alert staff when stock runs low")}
            </FormSection>
          </>
        ) : null}

        {section === "app" ? (
          <>
            <FormSection step="1" title="Shop features">
              {flag("reviewsEnabled", "Reviews")}
              {flag("reviewsNeedApproval", "Hold reviews for approval")}
              {flag("wishlistEnabled", "Wishlist")}
              {flag("guestCheckoutEnabled", "Guest checkout")}
            </FormSection>
            <FormSection step="2" title="App version">
              <div className="grid cols-2">
                <Field label="Minimum supported app version">
                  <input type="text" className="mono" value={draft.minSupportedVersion || ""} onChange={set("minSupportedVersion")} placeholder="1.0.0" />
                </Field>
              </div>
            </FormSection>
            <FormSection step="3" title="Maintenance">
              {flag("maintenanceMode", "Maintenance mode — the apps show a message instead of the shop")}
              {draft.maintenanceMode ? (
                <Field label="What the message says">
                  <textarea rows={3} value={draft.maintenanceMessage || ""} onChange={set("maintenanceMessage")} />
                </Field>
              ) : null}
            </FormSection>
          </>
        ) : null}

        {section === "pos" ? (
          <FormSection step="1" title="Billing screen">
            <Field label="POS screen template" help={POS_TEMPLATES[draft.template || "standard"]}>
              <Select value={draft.template || "standard"} onChange={set("template")}>
                <option value="standard">Standard</option>
                <option value="compact">Compact</option>
                <option value="touch">Touch</option>
                <option value="terminal">Terminal (full screen)</option>
              </Select>
            </Field>
          </FormSection>
        ) : null}

        {section === "print" ? (
          // One page: the templates on the left, a live preview on the right.
          <FitToScreen className="print-layout">
            <div className="print-list" role="radiogroup" aria-label="Invoice template">
              {Object.entries(INVOICE_TEMPLATES).map(([key, tpl]) => {
                const on = (draft.invoiceTemplate || DEFAULT_TEMPLATE) === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`print-item${on ? " on" : ""}`}
                    onClick={() => setDraft((d) => ({ ...d, invoiceTemplate: key }))}
                  >
                    <span className="print-item-head">
                      <i className="print-dot" style={{ background: `rgb(${tpl.accent.join(",")})` }} />
                      <strong>{tpl.label}</strong>
                      {on && <span className="print-check" aria-hidden="true">✓</span>}
                    </span>
                    <span className="print-tags">
                      <span className="tag">{tpl.title}</span>
                      <span className="tag">{tpl.logo ? "With logo" : "No logo"}</span>
                      <span className="tag">{tpl.receipt ? "80mm" : "A4"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <InvoicePreview template={draft.invoiceTemplate || DEFAULT_TEMPLATE} />
          </FitToScreen>
        ) : null}

        <div className="settings-savebar">
          <button className="btn primary" disabled={saving} onClick={save}>
            {saving
              ? "Saving…"
              : `Save ${SECTIONS.find((s) => s.key === section)?.label.toLowerCase()} settings`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Fills the screen from where it starts down to just above the sticky save
// bar, so the page itself never needs scrolling.
function FitToScreen({ className, children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(null);
  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      // Room left for the save bar (and its gap) under the panel.
      setHeight(Math.max(420, window.innerHeight - top - 96));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={ref} className={className} style={height ? { height } : undefined}>
      {children}
    </div>
  );
}

// A scaled-down A4 page showing the chosen template with a sample order.
// "Fit" shrinks it until the whole page shows; the zoom buttons (bottom-right)
// scale from there, and only the preview area scrolls when zoomed in.
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function InvoicePreview({ template }) {
  const html = useMemo(() => invoiceHtml(sampleInvoice(template)), [template]);
  const box = useRef(null);
  const [fit, setFit] = useState(0.5); // scale at which the whole page fits
  const [zoom, setZoom] = useState(1); // multiple of `fit`
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => {
      // Inner size, less the padding round the page.
      const width = el.clientWidth - 24;
      const height = el.clientHeight - 24;
      setFit(Math.max(0.15, Math.min(width / PAGE_W, height / PAGE_H)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = fit * zoom;
  const step = (dir) =>
    setZoom((z) => {
      const i = ZOOM_STEPS.findIndex((s) => s >= z - 0.001);
      const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i < 0 ? ZOOM_STEPS.length - 1 : i) + dir))];
      return next;
    });

  return (
    <div className="invoice-preview">
      <div className="invoice-scroll" ref={box}>
        <div className="invoice-page" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
          <iframe title="Invoice preview" srcDoc={html} style={{ transform: `scale(${scale})` }} />
        </div>
      </div>
      <div className="zoom-ctl" role="group" aria-label="Preview zoom">
        <button type="button" onClick={() => step(-1)} disabled={zoom <= ZOOM_STEPS[0]} aria-label="Zoom out">−</button>
        <span className="zoom-val" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => step(1)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Zoom in">+</button>
        <button type="button" className="zoom-fit" onClick={() => setZoom(1)} disabled={zoom === 1} title="Fit the whole page">Fit</button>
      </div>
    </div>
  );
}

const PAGE_W = 820;
const PAGE_H = 1100;
