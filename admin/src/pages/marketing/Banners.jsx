import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, confirmDialog } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import {
  Banner as Notice, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table,
} from "../../components/ui";

const PLACEMENT_LABEL = {
  home_hero: "Home — hero",
  home_story: "Home — Banner 1 (from our farms)",
  home_strip: "Home — Banner 2 (promo)",
  category_top: "Category — top",
  cart: "Cart",
  app_launch: "App launch",
};

// What the banner form offers: the home page's Banner 1 and Banner 2. The
// hero is set up in its own section; a banner already in another slot keeps
// that slot when edited, it just can't be moved into one.
const FORM_PLACEMENTS = ["home_story", "home_strip"];

export default function Banners() {
  const { can } = useAuth();
  const canManage = can("marketing.manage");

  const [data, setData] = useState({ items: [], meta: null, placements: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  // Live on the site, or off it — without opening the form.
  async function toggleStatus(banner) {
    const next = banner.status === "active" ? "paused" : "active";
    setBusyId(banner.id);
    setError("");
    try {
      await api.patch(`/banners/${banner.id}`, { status: next });
      setData((d) => ({
        ...d,
        items: d.items.map((b) => (b.id === banner.id ? { ...b, status: next } : b)),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeBanner(banner) {
    const ok = await confirmDialog({
      title: "Delete banner?",
      message: `Delete the banner "${banner.title}"? This can't be undone — pause it instead to just take it off the site.`,
      confirmText: "Delete banner",
      danger: true,
    });
    if (!ok) return;
    setBusyId(banner.id);
    setError("");
    try {
      await api.delete(`/banners/${banner.id}`);
      setData((d) => ({ ...d, items: d.items.filter((b) => b.id !== banner.id) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/banners", { page, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Banners</h1>
        </div>
        {canManage ? (
          <button className="btn primary" onClick={() => navigate("/marketing/banners/new")}>+ New banner</button>
        ) : null}
      </div>

      <Notice tone="error">{error}</Notice>

      {/* Say why there is nothing to click, rather than leave a list that
          silently ignores every tap. */}
      {!canManage ? (
        <Notice tone="info">
          You can view banners, but adding, editing or deleting them needs the “Create and edit offers,
          coupons and banners” permission. Ask an admin to grant it, or sign in as an admin.
        </Notice>
      ) : null}

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Banners"
              columns={[
                {
                  key: "title",
                  label: "Banner",
                  render: (row) => (
                    <div className="inline">
                      <div
                        style={{
                          width: 44, height: 30, borderRadius: 6,
                          background: row.backgroundColor || "var(--surface-2)",
                          border: "1px solid var(--border)",
                          backgroundImage: row.image ? `url(${row.image})` : undefined,
                          backgroundSize: "cover",
                        }}
                      />
                      <div className="stack">
                        <span className="row-title">{row.title}</span>
                        <span className="row-sub">{row.subtitle}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "placement",
                  label: "Where",
                  render: (row) => <span className="muted">{PLACEMENT_LABEL[row.placement] || row.placement}</span>,
                },
                {
                  key: "target",
                  label: "Goes to",
                  render: (row) =>
                    row.target?.kind && row.target.kind !== "none" ? (
                      <span className="muted">{row.target.kind}: {row.target.value}</span>
                    ) : (
                      <span className="faint">nothing</span>
                    ),
                },
                {
                  key: "engagement",
                  label: "Engagement",
                  align: "right",
                  render: (row) => (
                    <div className="stack">
                      <span>{row.clicks} clicks</span>
                      <span className="row-sub">
                        {row.impressions} views
                        {row.impressions ? ` · ${Math.round((row.clicks / row.impressions) * 100)}%` : ""}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <Pill tone={row.status === "active" ? "ok" : row.status === "draft" ? "warn" : undefined}>
                      {row.status}
                    </Pill>
                  ),
                },
                ...(canManage
                  ? [
                      {
                        key: "actions",
                        label: "",
                        align: "right",
                        render: (row) => (
                          // stopPropagation: the row itself also opens the
                          // editor, and these must not do that as well.
                          <div className="inline" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                            <button
                              className="btn sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/marketing/banners/${row.id}`);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn sm"
                              disabled={busyId === row.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStatus(row);
                              }}
                            >
                              {row.status === "active" ? "Pause" : "Activate"}
                            </button>
                            <button
                              className="btn sm danger"
                              disabled={busyId === row.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBanner(row);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              rows={data.items}
              onRowClick={canManage ? (row) => navigate(`/marketing/banners/${row.id}`) : undefined}
              empty={
                <Empty
                  title="No banners yet"
                  hint="The home screen falls back to its built-in hero until you add one."
                />
              }
            />
            <Pagination meta={data.meta} onPage={setPage} />
          </>
        )}
      </Card>

    </div>
  );
}

// /marketing/banners/new and /marketing/banners/:id — the banner form as its
// own page. There is no single-banner endpoint, so the list is read and the
// one banner picked out.
export function BannerFormPage() {
  return (
    <FormRoute
      backTo="/marketing/banners"
      backLabel="Banners"
      load={async (id) => {
        const data = await api.get("/banners", { limit: 100 });
        const banner = id ? data.items.find((b) => b.id === id) : {};
        return banner ? { banner } : null;
      }}
      render={({ banner }, back) => <BannerModal banner={banner} onClose={back} onSaved={back} />}
    />
  );
}

function BannerModal({ banner, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: banner.title || "",
    subtitle: banner.subtitle || "",
    image: banner.image || "",
    // A new banner's photo starts on the right, clear of the words.
    focalX: banner.focalX ?? 100,
    focalY: banner.focalY ?? 50,
    imageScale: banner.imageScale ?? 100,
    fade: banner.fade ?? 45,
    fadeOpacity: banner.fadeOpacity ?? 100,
    height: banner.height ?? null,
    backgroundColor: banner.backgroundColor || "",
    fadeColor: banner.fadeColor || "",
    points: [0, 1, 2].map((i) => banner.points?.[i] || ""),
    placement: banner.placement || "home_story",
    target: banner.target || { kind: "none", value: "" },
    status: banner.status || "draft",
    seq: banner.seq || 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const isStory = form.placement === "home_story";
  const isHomeBanner = isStory || form.placement === "home_strip";

  const FOCAL_POINTS = [
    [0, 0], [50, 0], [100, 0],
    [0, 50], [50, 50], [100, 50],
    [0, 100], [50, 100], [100, 100],
  ];

  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = { ...form, points: form.points.map((p) => p.trim()).filter(Boolean) };
      if (banner.id) await api.patch(`/banners/${banner.id}`, body);
      else await api.post("/banners", body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={banner.id ? banner.title : "New banner"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !form.title} onClick={save}>
            {busy ? "Saving…" : "Save banner"}
          </button>
        </>
      }
    >
      <Notice tone="error">{error}</Notice>
      {isHomeBanner && !form.image ? (
        <Notice tone="info">This banner only shows on the home page once it has both a title and an image.</Notice>
      ) : null}

      {isHomeBanner ? (
        <>
          <div className="section-label" style={{ marginTop: 0 }}>
            Preview <span className="faint">— how it looks on the home page</span>
          </div>
          <BannerPreview form={form} />
        </>
      ) : null}

      <div className="grid cols-2">
        <Field label="Title"><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label={isStory ? "Eyebrow (small text above the title)" : "Subtitle"}><input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></Field>
      </div>

      <div className="grid cols-2">
        {/* Left: the photo and how it's framed. Right: the wash, the height
            and the background colour. */}
        <div className="stack">
        <Field label="Image">
          {/* Banner 1 / 2 are framed with the sliders and seen in the
              preview above; the crop grid is for the other slots. */}
          {form.image && !isHomeBanner ? (
            <div className="media-thumb wide" style={{ marginBottom: 10 }}>
              <img
                src={form.image}
                alt=""
                style={{ objectPosition: `${form.focalX}% ${form.focalY}%` }}
              />
              <span className="media-focal-hint">Crop focus</span>
              <div className="media-focal-grid">
                {FOCAL_POINTS.map(([fx, fy]) => (
                  <button
                    key={`${fx}-${fy}`}
                    type="button"
                    className={form.focalX === fx && form.focalY === fy ? "active" : ""}
                    aria-label={`Crop focus: ${fy === 0 ? "top" : fy === 100 ? "bottom" : "middle"} ${fx === 0 ? "left" : fx === 100 ? "right" : "center"}`}
                    onClick={() => setForm((f) => ({ ...f, focalX: fx, focalY: fy }))}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="inline" style={{ gap: 10, alignItems: "center" }}>
            <label className="btn sm" style={{ cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}>
              {uploading ? "Uploading…" : form.image ? "Replace photo" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploading(true);
                  setUploadError("");
                  try {
                    const result = await api.upload(file, "banners");
                    setForm((f) => ({ ...f, image: result.url }));
                  } catch (err) {
                    setUploadError(err.message);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          </div>
          {uploadError ? <span className="field-error" style={{ color: "var(--danger)", fontSize: 12 }}>{uploadError}</span> : null}
        </Field>
          {isHomeBanner ? (
            <>
              <Field
                label={`Zoom — ${form.imageScale}%${form.imageScale === 100 ? " (whole photo)" : ""}`}
                help="100% shows the whole photo, nothing cut off. Zoom in, then use the two sliders below to pick which part stays in view."
              >
                <input
                  type="range"
                  min="100"
                  max="300"
                  step="5"
                  value={form.imageScale}
                  onChange={(e) => setForm({ ...form, imageScale: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Left ↔ right — ${form.focalX}%`}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form.focalX}
                  aria-label="Photo position, left to right"
                  onChange={(e) => setForm({ ...form, focalX: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Top ↕ bottom — ${form.focalY}%`}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form.focalY}
                  aria-label="Photo position, top to bottom"
                  onChange={(e) => setForm({ ...form, focalY: Number(e.target.value) })}
                />
              </Field>
            </>
          ) : null}
        </div>
        <div className="stack">
          {isHomeBanner ? (
            <>
              <Field
                label={`Fade — covers ${form.fade}% of the banner`}
                help="How far across, from the left, the colour wash covers the photo. 100% covers all of it; 50% the left half, then softens out."
              >
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.fade}
                  onChange={(e) => setForm({ ...form, fade: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Fade opacity — ${form.fadeOpacity}%`} help="How strong the wash is: 100% solid, 0% none.">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.fadeOpacity}
                  onChange={(e) => setForm({ ...form, fadeOpacity: Number(e.target.value) })}
                />
              </Field>
              <ColorField
                label="Fade colour"
                value={form.fadeColor}
                fallback={SITE_COLORS[form.placement].fade}
                onChange={(fadeColor) => setForm({ ...form, fadeColor })}
              />
              <Field
                label={`Banner height — ${form.height ?? SITE_HEIGHT[form.placement]}px${form.height ? "" : " (site default)"}`}
                help="How tall the banner is on computers and tablets. Phones keep their own size."
              >
                <div className="inline" style={{ gap: 8, flexWrap: "nowrap" }}>
                  <input
                    type="range"
                    min="120"
                    max="600"
                    step="10"
                    value={form.height ?? SITE_HEIGHT[form.placement]}
                    onChange={(e) => setForm({ ...form, height: Number(e.target.value) })}
                  />
                  {form.height ? (
                    <button type="button" className="btn ghost sm" onClick={() => setForm({ ...form, height: null })}>
                      Reset
                    </button>
                  ) : null}
                </div>
              </Field>
            </>
          ) : null}
        <ColorField
          label="Background colour"
          value={form.backgroundColor}
          fallback={SITE_COLORS[form.placement]?.background || "#e8f6ed"}
          onChange={(backgroundColor) => setForm({ ...form, backgroundColor })}
        />
        </div>
      </div>

      <div className="grid cols-3">
        <Field label="Placement">
          <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
            {(banner.placement && !FORM_PLACEMENTS.includes(banner.placement)
              ? [...FORM_PLACEMENTS, banner.placement]
              : FORM_PLACEMENTS
            ).map((key) => (
              <option key={key} value={key}>{PLACEMENT_LABEL[key] || key}</option>
            ))}
          </select>
        </Field>
        {isStory ? null : (<>
        <Field label="Tapping it opens">
          <select
            value={form.target.kind}
            onChange={(e) => setForm({ ...form, target: { ...form.target, kind: e.target.value } })}
          >
            <option value="none">Nothing</option>
            <option value="category">A category</option>
            <option value="product">A product</option>
            <option value="offer">An offer</option>
            <option value="search">A search</option>
            <option value="url">A URL</option>
          </select>
        </Field>
        <Field label="Value" help="A slug, an id, or a search term.">
          <input
            type="text"
            value={form.target.value}
            onChange={(e) => setForm({ ...form, target: { ...form.target, value: e.target.value } })}
            disabled={form.target.kind === "none"}
          />
        </Field>
        </>)}
      </div>

      {isStory ? (
        <div className="grid cols-3">
          {form.points.map((point, i) => (
            <Field key={i} label={`Point ${i + 1}`} help={i === 0 ? "Line breaks are kept. Leave empty to drop it." : undefined}>
              <textarea
                rows={2}
                value={point}
                onChange={(e) => setForm({ ...form, points: form.points.map((p, j) => (j === i ? e.target.value : p)) })}
              />
            </Field>
          ))}
        </div>
      ) : null}

      <div className="grid cols-2">
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </Field>
        <Field label="Order within its slot">
          <input type="number" value={form.seq} onChange={(e) => setForm({ ...form, seq: Number(e.target.value) })} />
        </Field>
      </div>
    </Modal>
  );
}

// The storefront's full content width (website: --max 1240px less the 20px
// gutters) — the preview is built at this size, then scaled to fit the form.
const SITE_WIDTH = 1200;
// Each banner's height on the site when none is set (globals.css: .story
// min-height, .promo-carousel at full desktop width).
const SITE_HEIGHT = { home_story: 210, home_strip: 320 };
// And their colours when none is set (globals.css: --brand-mist / --brand-deep).
const SITE_COLORS = {
  home_story: { background: "#f2f9f3", fade: "#f2f9f3" },
  home_strip: { background: "#0f4a23", fade: "#0f4a23" },
};

// A colour picker plus its hex code. Empty means the site's own colour
// (`fallback`, shown in the picker); Reset goes back to it.
function ColorField({ label, value, fallback, onChange }) {
  const shown = value || fallback;
  return (
    <Field label={label}>
      <div className="inline" style={{ gap: 8, flexWrap: "nowrap", alignItems: "center" }}>
        <input type="color" value={shown} aria-label={label} onChange={(e) => onChange(e.target.value)} />
        <code style={{ fontSize: 12.5 }}>{shown.toUpperCase()}</code>
        {value ? (
          <button type="button" className="btn ghost sm" onClick={() => onChange("")}>
            Reset
          </button>
        ) : (
          <span className="faint" style={{ fontSize: 12 }}>site default</span>
        )}
      </div>
    </Field>
  );
}

// Banner 1 and Banner 2 with the storefront's own markup and desktop styles
// (website/app/page.jsx, components/BannerCarousel.jsx, lib/format.js), so
// zoom, position, fade and height look here exactly as they will there.
function BannerPreview({ form }) {
  const focus = `${form.focalX}% ${form.focalY}%`;
  const vars = {
    "--fade-to": `${form.fade}%`,
    "--fade-opacity": form.fadeOpacity / 100,
    ...(form.backgroundColor ? { "--banner-bg": form.backgroundColor } : {}),
    ...(form.fadeColor ? { "--fade-color": form.fadeColor } : {}),
    ...(form.height ? { "--banner-h": `${form.height}px` } : {}),
  };
  const photo = form.image ? (
    <img
      className="sb-photo"
      src={form.image}
      alt=""
      style={{ objectFit: "contain", objectPosition: focus, transformOrigin: focus, scale: String(form.imageScale / 100) }}
    />
  ) : null;

  if (form.placement === "home_story") {
    const points = form.points.map((p) => p.trim()).filter(Boolean);
    return (
      <ScaledToFit>
        <section className="sb-story" style={vars}>
          {photo}
          <div className="sb-story-copy">
            {form.subtitle ? <span className="sb-eyebrow">{form.subtitle}</span> : null}
            <h2 className="sb-story-title">{form.title || "Banner title"}</h2>
            {points.length ? (
              <ul className="sb-features">
                {points.slice(0, 3).map((point, i) => (
                  <li key={i}>
                    {STORY_ICONS[i]}
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      </ScaledToFit>
    );
  }

  // Same split as the storefront: after the first comma (or ?!:) the rest of
  // the title takes the light-green accent.
  const title = form.title || "Banner title";
  const match = title.match(/^(.+?[,?!:])\s+(.+)$/);
  const [lead, accent] = match ? [match[1], match[2]] : [title, ""];
  return (
    <ScaledToFit>
      <div className="sb-strip" style={vars}>
        {photo}
        <span className="sb-shade" aria-hidden="true" />
        <div className="sb-strip-copy">
          <h2 className="sb-strip-title">
            {lead}
            {accent ? <span>{accent}</span> : null}
          </h2>
          {form.subtitle ? <p>{form.subtitle}</p> : null}
          {form.target.kind !== "none" ? (
            <span className="sb-cue">
              Shop Now
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          ) : null}
        </div>
      </div>
    </ScaledToFit>
  );
}

// Draws its child at SITE_WIDTH and scales it down to the available width,
// so every size inside stays in the site's proportions.
function ScaledToFit({ children }) {
  const frame = useRef(null);
  const stage = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const scale = frame.current.clientWidth / SITE_WIDTH;
      setFit({ scale, height: stage.current.offsetHeight * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame.current);
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sb-frame" ref={frame} style={{ height: fit.height }}>
      <div className="sb-stage" ref={stage} style={{ transform: `scale(${fit.scale})` }}>
        {children}
      </div>
    </div>
  );
}

// Banner 1's point icons, as on the storefront (website/app/page.jsx).
const iconProps = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round", strokeLinejoin: "round", width: 24, height: 24, "aria-hidden": true,
};
const STORY_ICONS = [
  <svg key="leaf" {...iconProps}><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" /><path d="M5 19c3-4 6-7 10-9" /></svg>,
  <svg key="award" {...iconProps}><circle cx="12" cy="9" r="5.5" /><path d="m9.5 13.8-1.5 6.7 4-2.2 4 2.2-1.5-6.7" /></svg>,
  <svg key="box" {...iconProps}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>,
];
