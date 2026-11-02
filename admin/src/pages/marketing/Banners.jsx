import Select from "../../components/Select";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import { FormSection, Segmented } from "../../components/FormKit";
import {
  Banner as Notice, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table, useConfirm,
} from "../../components/ui";

const PLACEMENT_LABEL = {
  home_hero: "Home — hero",
  home_strip: "Home — strip",
  category_top: "Category — top",
  cart: "Cart",
  app_launch: "App launch",
};

const SWATCHES = ["#E8F6ED", "#FFF4DB", "#FDE8E8", "#E6EEFB", "#F1E8FB", "#14803F", "#8B4513", "#1E3A8A"];
const TARGETS = [
  { value: "none", label: "Nothing" },
  { value: "category", label: "A category", field: "Category", placeholder: "e.g. fresh-fruits" },
  { value: "product", label: "A product", field: "Product", placeholder: "e.g. alphonso-mango" },
  { value: "offer", label: "An offer", field: "Offer", placeholder: "e.g. FIRST30" },
  { value: "search", label: "A search", field: "Search words", placeholder: "e.g. mango" },
  { value: "url", label: "A URL", field: "Web address", placeholder: "https://…" },
];

export default function Banners() {
  const [confirm, confirmDialog] = useConfirm();
  const { can } = useAuth();
  const canManage = can("marketing.manage");

  const [data, setData] = useState({ items: [], meta: null, placements: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [slot, setSlot] = useState("");
  const [statusTab, setStatusTab] = useState("");

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
    if (!(await confirm({ title: "Delete banner?", message: `Delete the banner "${banner.title}"? This can't be undone — pause it instead to just take it off the site.`, confirmLabel: "Yes, delete" }))) return;
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
    <div className="page products-page banners-page">
      {confirmDialog}
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

      <div className="toolbar products-filters">
        <div className="chip-row banner-tabs" role="tablist" aria-label="Placement">
          <button type="button" role="tab" aria-selected={slot === ""} className={`cat-chip${slot === "" ? " on" : ""}`} onClick={() => setSlot("")}>All places</button>
          {Object.entries(PLACEMENT_LABEL).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={slot === key} className={`cat-chip${slot === key ? " on" : ""}`} onClick={() => setSlot(key)}>
              {label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div className="chip-row banner-tabs" role="tablist" aria-label="Status">
          {[["", "Any status"], ["active", "Active"], ["draft", "Draft"], ["paused", "Paused"]].map(([value, label]) => (
            <button key={label} type="button" role="tab" aria-selected={statusTab === value} className={`cat-chip small${statusTab === value ? " on" : ""}`} onClick={() => setStatusTab(value)}>
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
              title="Banners"
              columns={[
                {
                  key: "title",
                  label: "Banner",
                  render: (row) => (
                    <div className="inline" style={{ gap: 14, flexWrap: "nowrap" }}>
                      <div
                        className="banner-thumb"
                        style={{
                          background: row.backgroundColor || "var(--surface-2)",
                          backgroundImage: row.image ? `url(${row.image})` : undefined,
                          backgroundPosition: `${row.focalX ?? 50}% ${row.focalY ?? 50}%`,
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
                  render: (row) => <span className="reward-pill">{PLACEMENT_LABEL[row.placement] || row.placement}</span>,
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
                    <div className="stack" style={{ alignItems: "flex-end" }}>
                      <span><strong>{row.clicks}</strong> clicks</span>
                      <span className="row-sub">
                        {row.impressions} views
                        {row.impressions ? ` · ${Math.round((row.clicks / row.impressions) * 100)}% tapped` : ""}
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
                              type="button"
                              className="icon-edit"
                              title={`Edit ${row.title}`}
                              aria-label={`Edit ${row.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/marketing/banners/${row.id}`);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" /></svg>
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
                              type="button"
                              className="icon-delete"
                              disabled={busyId === row.id}
                              title={`Delete ${row.title}`}
                              aria-label={`Delete ${row.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBanner(row);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
                            </button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              rows={data.items.filter((b) => (!slot || b.placement === slot) && (!statusTab || b.status === statusTab))}
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
// own page. There is no single-banner endpoint, so the list (which also
// carries the placement options) is read and the one banner picked out.
export function BannerFormPage() {
  return (
    <FormRoute
      backTo="/marketing/banners"
      backLabel="Banners"
      load={async (id) => {
        const data = await api.get("/banners", { limit: 100 });
        const banner = id ? data.items.find((b) => b.id === id) : {};
        return banner ? { banner, placements: data.placements } : null;
      }}
      render={({ banner, placements }, back) => (
        <BannerModal banner={banner} placements={placements} onClose={back} onSaved={back} />
      )}
    />
  );
}

function BannerModal({ banner, placements, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: banner.title || "",
    subtitle: banner.subtitle || "",
    image: banner.image || "",
    focalX: banner.focalX ?? 50,
    focalY: banner.focalY ?? 50,
    backgroundColor: banner.backgroundColor || "",
    placement: banner.placement || "home_hero",
    target: banner.target || { kind: "none", value: "" },
    status: banner.status || "draft",
    seq: banner.seq || 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const validHex = /^#[0-9a-fA-F]{6}$/.test(form.backgroundColor);
  const FOCAL_POINTS = [
    [0, 0], [50, 0], [100, 0],
    [0, 50], [50, 50], [100, 50],
    [0, 100], [50, 100], [100, 100],
  ];

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (banner.id) await api.patch(`/banners/${banner.id}`, form);
      else await api.post("/banners", form);
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

      <div className="offer-layout">
        <div className="offer-main">
          <FormSection step="1" title="The message">
            <div className="grid cols-2">
              <Field label="Title">
                <input type="text" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fresh from the market" />
              </Field>
              <Field label="Subtitle">
                <input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="e.g. Delivered before 9 am" />
              </Field>
            </div>
          </FormSection>

          <FormSection step="2" title="The look">
            <Field label="Image">
              <div className="offer-image-row">
                {form.image ? (
                  <div className="media-thumb wide">
                    <img src={form.image} alt="" style={{ objectPosition: `${form.focalX}% ${form.focalY}%` }} />
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
                ) : (
                  <span className="offer-image-empty wide" aria-hidden="true">No photo</span>
                )}
                <div className="inline" style={{ gap: 10, alignItems: "center" }}>
                  <label className="btn sm" style={{ cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}>
                    {uploading ? "Uploading…" : form.image ? "Change photo" : "Upload photo"}
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
                  {form.image ? (
                    <button type="button" className="btn sm" onClick={() => setForm((f) => ({ ...f, image: "" }))}>Remove</button>
                  ) : null}
                </div>
              </div>
              {uploadError ? <span className="field-error" style={{ color: "var(--danger)", fontSize: 12 }}>{uploadError}</span> : null}
            </Field>

            <Field label="Background colour">
              <div className="color-row">
                <input
                  type="color"
                  className="color-well"
                  value={validHex ? form.backgroundColor : "#e8f6ed"}
                  onChange={(e) => setForm({ ...form, backgroundColor: e.target.value.toUpperCase() })}
                  aria-label="Pick a colour"
                />
                <input type="text" className="mono color-hex" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} placeholder="#E8F6ED" />
                <div className="swatches">
                  {SWATCHES.map((c) => (
                    <button key={c} type="button" className={`swatch${form.backgroundColor.toUpperCase() === c ? " on" : ""}`} style={{ background: c }} aria-label={`Use ${c}`} onClick={() => setForm({ ...form, backgroundColor: c })} />
                  ))}
                </div>
              </div>
            </Field>
          </FormSection>

          <FormSection step="3" title="Where it shows & what a tap does">
            <Field label="Placement">
              <div className="pick-list plain">
                {(placements || Object.keys(PLACEMENT_LABEL)).map((key) => (
                  <button key={key} type="button" aria-pressed={form.placement === key} className={`pick-chip${form.placement === key ? " on" : ""}`} onClick={() => setForm({ ...form, placement: key })}>
                    {PLACEMENT_LABEL[key] || key}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Tapping it opens">
              <div className="pick-list plain">
                {TARGETS.map((t) => (
                  <button key={t.value} type="button" aria-pressed={form.target.kind === t.value} className={`pick-chip${form.target.kind === t.value ? " on" : ""}`} onClick={() => setForm({ ...form, target: { ...form.target, kind: t.value } })}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
            {form.target.kind !== "none" ? (
              <Field label={TARGETS.find((t) => t.value === form.target.kind)?.field || "Value"}>
                <input
                  type="text"
                  value={form.target.value}
                  onChange={(e) => setForm({ ...form, target: { ...form.target, value: e.target.value } })}
                  placeholder={TARGETS.find((t) => t.value === form.target.kind)?.placeholder}
                />
              </Field>
            ) : null}
          </FormSection>

          <FormSection step="4" title="Publication">
            <Field label="Status">
              <Segmented
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                ]}
              />
            </Field>
            <Field label="Order within its slot">
              <input type="number" value={form.seq} onChange={(e) => setForm({ ...form, seq: Number(e.target.value) })} />
            </Field>
          </FormSection>
        </div>

        <aside className="offer-preview" aria-label="Preview">
          <span className="newcat-preview-label">Preview</span>
          <div
            className="banner-preview"
            style={{
              background: validHex ? form.backgroundColor : "var(--accent-soft)",
              backgroundImage: form.image ? `url(${form.image})` : undefined,
              backgroundPosition: `${form.focalX}% ${form.focalY}%`,
            }}
          >
            <div className={`banner-preview-text${form.image ? " on-image" : ""}`}>
              <strong>{form.title.trim() || "Banner title"}</strong>
              {form.subtitle.trim() ? <span>{form.subtitle}</span> : null}
            </div>
          </div>
          <ul className="offer-facts">
            <li><span>Shows in</span><b>{PLACEMENT_LABEL[form.placement] || form.placement}</b></li>
            <li><span>Tap opens</span><b>{form.target.kind === "none" ? "nothing" : `${form.target.kind}${form.target.value ? `: ${form.target.value}` : ""}`}</b></li>
            <li><span>Status</span><b>{form.status}</b></li>
          </ul>
        </aside>
      </div>
    </Modal>
  );
}
