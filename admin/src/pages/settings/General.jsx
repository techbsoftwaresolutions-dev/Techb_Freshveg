import { useEffect, useState } from "react";
import { api, toast } from "../../api/client";
import { Banner, Card, Field, Loading, Pill, Tabs } from "../../components/ui";
import { refreshBranding } from "../../api/branding";
import VideoHeroConfig from "./VideoHeroConfig";


// A save's confirmation, as a toast (components/Toaster.jsx).
const notifySaved = (message) => message && toast("success", message);
// One settings document, edited a section at a time — so two admins working on
// different areas do not overwrite each other with a whole-document save.
const SECTIONS = [
  { key: "company", label: "Company" },
  { key: "tax", label: "Tax" },
  { key: "payment", label: "Payment" },
  { key: "loyalty", label: "Loyalty" },
  { key: "delivery", label: "Delivery" },
  { key: "notifications", label: "Notifications" },
  { key: "app", label: "Apps" },
  { key: "website", label: "Website" },
  { key: "branding", label: "Branding" },
];

// The homepage layouts the storefront can render (settings.website.homeTemplate).
const HOME_TEMPLATES = [
  {
    key: "classic",
    name: "Classic",
  },
  {
    key: "fresh",
    name: "Farm Fresh",
  },
  {
    key: "video",
    name: "Video Hero",
  },
];

// Settings → Branding: each brand image, where it shows and what it must be.
// The size rules are enforced by the API on upload (backend
// src/modules/settings/branding.js); these lines only describe them.
// `build` marks the ones baked into the native apps at build time.
const BRAND_ASSETS = [
  {
    key: "logo",
    label: "Primary logo",
    shape: "logo",
    purpose: "Website header, sign-in and loading screens; customer and delivery app headers and sign-in screens; admin sign-in.",
    spec: "PNG, WebP or JPG, at least 200×60px. A transparent PNG sits best on every background.",
  },
  {
    key: "symbol",
    label: "Symbol",
    shape: "favicon",
    purpose: "The compact square mark: website footer and “Why us” section, admin sidebar.",
    spec: "Square or nearly square, at least 96×96px.",
  },
  {
    key: "favicon",
    label: "Favicon",
    shape: "favicon",
    purpose: "Browser tab and bookmarks on the website and admin, and the website's iPhone home-screen icon.",
    spec: "Square or nearly square, at least 48×48px (512×512 recommended).",
  },
  {
    key: "shareImage",
    label: "Social share image",
    shape: "logo",
    purpose: "The picture shown when a website link is shared on WhatsApp, Facebook or X.",
    spec: "At least 600×315px; 1200×630 recommended. Cropped to 1.91 : 1.",
  },
  // One icon per app, kept apart: each app's `npm run brand:sync` reads
  // only its own (scripts/sync-brand-assets.js).
  {
    key: "customerAppIcon",
    label: "Customer app icon",
    app: "Customer app · The Farmers Basket",
    shape: "favicon",
    build: true,
    purpose: "Launcher icon of the customer (shopping) app only. Also the website's “Add to Home Screen” icon, which updates live.",
    spec: "Square PNG, WebP or JPG, 1024×1024 to 4096×4096px, without transparency (iOS fills it with black).",
  },
  {
    key: "deliveryAppIcon",
    label: "Delivery app icon",
    app: "Delivery app · Farmers Basket Delivery",
    shape: "favicon",
    build: true,
    purpose: "Launcher icon of the delivery partner app only. Riders see it; customers never do.",
    spec: "Square PNG, WebP or JPG, 1024×1024 to 4096×4096px, without transparency (iOS fills it with black).",
  },
  {
    key: "splash",
    label: "Splash artwork",
    shape: "favicon",
    build: true,
    accept: "image/png,image/webp",
    purpose: "Shown, centred on cream, while the customer and delivery apps start (shared by both). Separate from the logo.",
    spec: "PNG or WebP with a transparent background, at least 512×512px (1024×1024 recommended).",
  },
];

// The customer app's home hero (settings.app.homeHero) — independent of the
// website's design above, though Video Hero plays the website's playlist.
const APP_HEROES = [
  {
    key: "classic",
    name: "Classic Banner",
    description: "Your Marketing → Banners images, swiped across the top of the home screen.",
  },
  {
    key: "video",
    name: "Video Hero",
    description: "The Video Hero playlist loops behind your hero text and button, as on the website.",
  },
];

export default function General() {
  const [settings, setSettings] = useState(null);
  const [section, setSection] = useState("company");
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [configuringVideo, setConfiguringVideo] = useState(false);

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
    notifySaved("");
    try {
      const data = await api.patch(`/settings/${section}`, draft);
      setSettings(data.settings);
      // The admin's own sidebar, sign-in page and tab icon, right away.
      if (section === "branding") refreshBranding(data.settings.branding);
      notifySaved(`${SECTIONS.find((s) => s.key === section)?.label || "Settings"} settings saved successfully`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // "Save configuration" in the Video Hero popup saves and switches the
  // homepage to it in one go; a failure stays in the popup, nothing changes.
  async function saveVideoHero(videoHero) {
    const data = await api.patch("/settings/website", { ...draft, homeTemplate: "video", videoHero });
    setSettings(data.settings);
    setConfiguringVideo(false);
  }

  if (loading) return <div className="page"><Loading /></div>;

  const savedVideoHero = settings?.website?.videoHero;
  const videoConfigured = Boolean(savedVideoHero?.videos?.length);

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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>General settings</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>

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
                <select value={draft.provider || "none"} onChange={set("provider")}>
                  <option value="none">None — cash and wallet only</option>
                  <option value="razorpay">Razorpay</option>
                </select>
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
            <div className="section-label">Customer App Header Style</div>
            <p className="muted" style={{ margin: "0 0 4px", fontSize: 13 }}>
              Choose how the hero section appears on the Fresh Market customer app.
            </p>
            <div className="template-picker" role="radiogroup" aria-label="Customer app header style">
              {APP_HEROES.map((hero) => {
                const selected = (draft.homeHero || "classic") === hero.key;
                // Video Hero plays the website's playlist, so it needs one first.
                const blocked = hero.key === "video" && !videoConfigured;
                return (
                  <button
                    key={hero.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={blocked}
                    className={`template-option${selected ? " selected" : ""}`}
                    style={blocked ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    onClick={() => setDraft((d) => ({ ...d, homeHero: hero.key }))}
                  >
                    <TemplateThumb kind={hero.key} />
                    <span className="template-option-name">
                      {hero.name}
                      {selected ? <span className="template-option-tick">Selected</span> : null}
                    </span>
                    <span className="template-option-desc">
                      {blocked ? "Add videos first: Website tab → Configure video hero." : hero.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {(draft.homeHero || "classic") !== (settings?.app?.homeHero || "classic") ? (
              <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
                Not saved yet — the app keeps showing the{" "}
                {APP_HEROES.find((hero) => hero.key === (settings?.app?.homeHero || "classic"))?.name} until you save.
              </p>
            ) : null}

            <div className="grid cols-2" style={{ marginTop: 14 }}>
              <Field
                label="Hero text"
                help={`Shown over the hero in the app. Leave empty to ${
                  (draft.homeHero || "classic") === "video" ? "use the website's Video Hero text" : "show the banner alone"
                }. ${(draft.heroText || "").length}/300`}
              >
                <textarea
                  value={draft.heroText || ""}
                  onChange={set("heroText")}
                  maxLength={300}
                  rows={3}
                  placeholder={(draft.homeHero || "classic") === "video" ? savedVideoHero?.text || "" : "e.g. Fresh from 800+ farms, every morning"}
                />
              </Field>
              <Field label="Button label" help="Opens all categories (a banner with its own link goes there). Empty hides the button.">
                <input type="text" value={draft.heroCtaLabel ?? "Shop Now"} onChange={set("heroCtaLabel")} maxLength={30} />
              </Field>
            </div>

            <div className="divider" />

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

        {section === "website" ? (
          <>
            <div className="section-label">Homepage design</div>
            <div className="template-picker" role="radiogroup" aria-label="Homepage design">
              {HOME_TEMPLATES.map((template) => {
                const selected = (draft.homeTemplate || "classic") === template.key;
                return (
                  <button
                    key={template.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`template-option${selected ? " selected" : ""}`}
                    onClick={() =>
                      // Video Hero cannot go live without its videos: ask for
                      // them first, and switch only once they are saved.
                      template.key === "video" && !videoConfigured
                        ? setConfiguringVideo(true)
                        : setDraft((d) => ({ ...d, homeTemplate: template.key }))
                    }
                  >
                    <TemplateThumb kind={template.key} />
                    <span className="template-option-name">
                      {template.name}
                      {selected ? <span className="template-option-tick">Selected</span> : null}
                    </span>
                    <span className="template-option-desc">{template.description}</span>
                  </button>
                );
              })}
            </div>
            {videoConfigured || draft.homeTemplate === "video" ? (
              <div className="inline" style={{ marginTop: 14, gap: 12, flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={() => setConfiguringVideo(true)}>
                  Configure video hero
                </button>
                <span className="muted" style={{ fontSize: 13 }}>
                  {videoConfigured
                    ? `${savedVideoHero.videos.length} video${savedVideoHero.videos.length === 1 ? "" : "s"} in the playlist${draft.homeTemplate === "video" ? "" : " — kept while another design is live"}`
                    : "No videos chosen yet"}
                </span>
              </div>
            ) : null}
            {configuringVideo ? (
              <VideoHeroConfig
                initial={savedVideoHero}
                onCancel={() => setConfiguringVideo(false)}
                onSave={saveVideoHero}
              />
            ) : null}
          </>
        ) : null}

        {section === "branding" ? (
          <>
            <h3 className="brand-group">Live branding</h3>
            <p className="muted brand-note">
              Used by the website, the customer and delivery apps and this admin as soon as it is saved. The website
              picks it up within a minute; the apps when they next open or come back to the front.
            </p>
            <div className="grid cols-2">
              {BRAND_ASSETS.filter((a) => !a.build).map((asset) => (
                <ImageSetting
                  key={asset.key}
                  asset={asset}
                  value={draft[asset.key] || ""}
                  saved={settings.branding?.[asset.key] || ""}
                  onChange={(url) => setDraft((d) => ({ ...d, [asset.key]: url }))}
                />
              ))}
            </div>

            <div className="divider" />
            <h3 className="brand-group">App build assets</h3>
            <Banner tone="info">
              A phone's launcher icon and splash screen are part of the installed app, so saving here does not change
              apps people already have. After saving, run <code>npm run brand:sync</code> in <code>customer-app</code>{" "}
              (customer icon) and/or <code>delivery-app</code> (delivery icon), then build and publish new versions.
              Each app keeps its bundled icon and splash until then.
            </Banner>
            <div className="grid cols-2">
              {BRAND_ASSETS.filter((a) => a.build).map((asset) => (
                <ImageSetting
                  key={asset.key}
                  asset={asset}
                  value={draft[asset.key] || ""}
                  saved={settings.branding?.[asset.key] || ""}
                  onChange={(url) => setDraft((d) => ({ ...d, [asset.key]: url }))}
                />
              ))}
            </div>
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

// One brand image: what it is for, preview, upload (to Cloudinary via
// /uploads, which checks its size and shape), reset to the default, and where
// it stands. Saved with the rest of the tab by its Save button; until then the
// old image stays live.
function ImageSetting({ asset, value, saved, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const { label } = asset;
  const changed = value !== saved;

  const status = changed ? (
    <Pill tone="warn">Not saved yet</Pill>
  ) : asset.build ? (
    <Pill tone="info">{saved ? "Saved · needs an app build" : "Bundled default"}</Pill>
  ) : (
    <Pill tone="ok">{saved ? "Saved · live" : "Bundled default · live"}</Pill>
  );

  return (
    <Field label={label} error={uploadError}>
      {asset.app ? <span className="tag brand-app">{asset.app}</span> : null}
      <div className="brand-head">
        <span className="help">{asset.purpose}</span>
        {status}
      </div>
      <div className={`brand-preview ${asset.shape}`}>
        {value ? <img src={value} alt={`${label} preview`} /> : <span className="faint">Using the default {label.toLowerCase()}</span>}
      </div>
      <span className="help">{asset.spec}</span>
      <div className="inline" style={{ gap: 10, marginTop: 10 }}>
        <label className="btn sm" aria-disabled={uploading} style={{ cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading…" : value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          <input
            type="file"
            accept={asset.accept || "image/png,image/webp,image/jpeg"}
            hidden
            disabled={uploading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setUploading(true);
              setUploadError("");
              try {
                onChange((await api.upload(file, "branding", { kind: asset.key })).url);
              } catch (err) {
                setUploadError(err.message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        {value ? (
          <button type="button" className="btn sm" onClick={() => onChange("")}>
            Reset to default
          </button>
        ) : null}
        {changed && saved ? (
          <button type="button" className="btn sm ghost" onClick={() => onChange(saved)}>
            Undo
          </button>
        ) : null}
      </div>
    </Field>
  );
}

// A small wireframe of each homepage layout, so the choice is visual.
function TemplateThumb({ kind }) {
  const green = "#1b7a3a";
  const soft = "#e8f5ec";
  const line = "#cfd6d3";
  if (kind === "video") {
    return (
      <svg viewBox="0 0 160 110" className="template-thumb" aria-hidden="true">
        <rect width="160" height="110" rx="6" fill="#fff" />
        <rect x="6" y="6" width="148" height="40" rx="4" fill="#1f4d2c" />
        <rect x="6" y="6" width="148" height="40" rx="4" fill="url(#vh-sky)" />
        <defs>
          <linearGradient id="vh-sky" x1="0" x2="1">
            <stop offset="0" stopColor="#0f2a17" stopOpacity="0.9" />
            <stop offset="0.6" stopColor="#4c8a3f" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path d="M112 18v16l13-8z" fill="#fff" opacity="0.9" />
        <rect x="12" y="20" width="54" height="5" rx="2" fill="#fff" />
        <rect x="12" y="28" width="40" height="5" rx="2" fill="#fff" />
        <rect x="12" y="37" width="34" height="5" rx="2.5" fill="#fff" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={6 + i * 21.3} y="52" width="18" height="16" rx="3" fill="#fff" stroke={line} />
        ))}
        <rect x="6" y="73" width="148" height="12" rx="3" fill={soft} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={6 + i * 25} y="89" width="21" height="16" rx="3" fill="#fff" stroke={line} />
        ))}
      </svg>
    );
  }
  if (kind === "fresh") {
    return (
      <svg viewBox="0 0 160 110" className="template-thumb" aria-hidden="true">
        <rect width="160" height="110" rx="6" fill="#fff" />
        <rect x="6" y="6" width="148" height="34" rx="4" fill={soft} />
        <rect x="12" y="13" width="56" height="6" rx="2" fill={green} />
        <rect x="12" y="23" width="40" height="4" rx="2" fill={line} />
        <rect x="12" y="30" width="22" height="5" rx="2.5" fill={green} />
        <circle cx="128" cy="23" r="13" fill="#f59e0b" opacity="0.7" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={6 + i * 25} y="46" width="21" height="18" rx="4" fill={["#fde2e2", "#dcfce7", "#e0f2fe", "#ede9fe", "#fef3c7", "#dcfce7"][i]} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={6 + i * 30} y="70" width="26" height="16" rx="3" fill="#fff" stroke={line} />
        ))}
        <rect x="6" y="91" width="148" height="13" rx="3" fill={green} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 110" className="template-thumb" aria-hidden="true">
      <rect width="160" height="110" rx="6" fill="#fff" />
      <rect x="6" y="6" width="148" height="34" rx="4" fill={soft} />
      <rect x="12" y="14" width="60" height="7" rx="2" fill={green} />
      <rect x="12" y="25" width="44" height="4" rx="2" fill={line} />
      <rect x="96" y="10" width="52" height="26" rx="4" fill="#a5d6a7" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={6 + i * 21.3} y="46" width="18" height="16" rx="3" fill="#fff" stroke={line} />
      ))}
      <rect x="6" y="67" width="148" height="14" rx="3" fill={soft} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={6 + i * 25} y="86" width="21" height="18" rx="3" fill="#fff" stroke={line} />
      ))}
    </svg>
  );
}
