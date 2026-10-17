import Select from "../../components/Select";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import {
  Banner as Notice, Card, Empty, Field, Loading, Modal, Pagination, Pill, Table,
} from "../../components/ui";

const PLACEMENT_LABEL = {
  home_hero: "Home — hero",
  home_strip: "Home — strip",
  category_top: "Category — top",
  cart: "Cart",
  app_launch: "App launch",
};

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
    if (!window.confirm(`Delete the banner "${banner.title}"? This can't be undone — pause it instead to just take it off the site.`)) return;
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

      <div className="grid cols-2">
        <Field label="Title"><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Subtitle"><input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></Field>
      </div>

      <div className="grid cols-2">
        <Field
          label="Image"
          help="Upload a photo, or paste an image URL directly. Hover the preview to set which part of it stays visible when the slot crops it (the hero banner in particular stretches this very wide)."
        >
          {form.image ? (
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
              {uploading ? "Uploading…" : "Upload photo"}
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
          <input
            type="text"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            placeholder="Or paste an image URL"
            style={{ marginTop: 8 }}
          />
        </Field>
        <Field label="Background colour">
          <input type="text" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} placeholder="#E8F6ED" />
        </Field>
      </div>

      <div className="grid cols-3">
        <Field label="Placement">
          <Select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
            {(placements || Object.keys(PLACEMENT_LABEL)).map((key) => (
              <option key={key} value={key}>{PLACEMENT_LABEL[key] || key}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tapping it opens">
          <Select
            value={form.target.kind}
            onChange={(e) => setForm({ ...form, target: { ...form.target, kind: e.target.value } })}
          >
            <option value="none">Nothing</option>
            <option value="category">A category</option>
            <option value="product">A product</option>
            <option value="offer">An offer</option>
            <option value="search">A search</option>
            <option value="url">A URL</option>
          </Select>
        </Field>
        <Field label="Value" help="A slug, an id, or a search term.">
          <input
            type="text"
            value={form.target.value}
            onChange={(e) => setForm({ ...form, target: { ...form.target, value: e.target.value } })}
            disabled={form.target.kind === "none"}
          />
        </Field>
      </div>

      <div className="grid cols-2">
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </Select>
        </Field>
        <Field label="Order within its slot">
          <input type="number" value={form.seq} onChange={(e) => setForm({ ...form, seq: Number(e.target.value) })} />
        </Field>
      </div>
    </Modal>
  );
}
