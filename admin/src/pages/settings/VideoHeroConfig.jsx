import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Banner, Field, Modal } from "../../components/ui";

export const DEFAULT_HERO_TEXT = "100% source traceable natural harvest from 800+ farms across South India.";

// A Cloudinary video's first frame as a still (the storefront's
// lib/format.js videoPoster does the same for the live hero).
const poster = (url, width = 480) =>
  url.replace("/video/upload/", `/video/upload/so_0,q_auto,w_${width},c_limit/`).replace(/\.\w+$/, ".jpg");

const duration = (seconds) =>
  seconds ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}` : null;
const megabytes = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : null);
const uploaded = (date) => (date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

// What a playlist entry keeps in settings.website.videoHero.videos.
const entry = ({ url, publicId, name, duration: length, bytes, width, height }) => ({
  url, publicId, name, duration: length, bytes, width, height,
});

// "Configure Video Hero": pick videos from the Cloudinary library (or upload
// new ones into it), order them, and set the words and CTA. Works on a local
// copy — nothing is saved until "Save configuration" succeeds, so Cancel
// leaves the live playlist exactly as it was.
export default function VideoHeroConfig({ initial, onCancel, onSave }) {
  const [playlist, setPlaylist] = useState(() => (initial?.videos || []).map(entry));
  const [text, setText] = useState(initial?.text ?? DEFAULT_HERO_TEXT);
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? "Shop Now");
  const [library, setLibrary] = useState(null);
  const [libraryError, setLibraryError] = useState("");
  const [query, setQuery] = useState("");
  const [upload, setUpload] = useState(null); // { name, progress, status, message }
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/uploads/videos")
      .then((data) => setLibrary(data.videos))
      .catch((err) => {
        setLibrary([]);
        setLibraryError(err.message);
      });
  }, []);

  const inPlaylist = (url) => playlist.findIndex((video) => video.url === url);
  const toggle = (video) =>
    setPlaylist((list) =>
      list.some((item) => item.url === video.url) ? list.filter((item) => item.url !== video.url) : [...list, entry(video)]
    );
  const move = (from, to) =>
    setPlaylist((list) => {
      if (to < 0 || to >= list.length || from === to) return list;
      const next = [...list];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // the same file can be picked again after a failure
    if (!file) return;
    setUpload({ name: file.name, progress: 0, status: "uploading" });
    try {
      const video = await api.uploadVideo(file, (progress) => setUpload((u) => ({ ...u, progress })));
      // Into the library straight away, and onto the end of the playlist.
      setLibrary((list) => [video, ...(list || []).filter((item) => item.url !== video.url)]);
      setPlaylist((list) => (list.some((item) => item.url === video.url) ? list : [...list, entry(video)]));
      setUpload({ name: file.name, progress: 1, status: "done" });
    } catch (err) {
      setUpload({ name: file.name, progress: 0, status: "error", message: err.message });
    }
  }

  const uploading = upload?.status === "uploading";
  const problem = !playlist.length
    ? "Select at least one video for the playlist."
    : !text.trim()
      ? "Add the hero text."
      : null;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave({ text: text.trim(), ctaLabel: ctaLabel.trim(), videos: playlist });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const shown = (library || []).filter((video) => video.name.toLowerCase().includes(query.trim().toLowerCase()));
  const previewing = previewUrl || playlist[0]?.url;

  return (
    <Modal
      title="Configure Video Hero"
      onClose={onCancel}
      wide
      footer={
        <>
          {problem ? <span className="faint vh-foot-hint">{problem}</span> : null}
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" disabled={saving || uploading || Boolean(problem)} onClick={save}>
            {saving ? "Saving…" : "Save configuration"}
          </button>
        </>
      }
    >
      <Banner tone="error">{error}</Banner>

      {/* Live preview: the hero as the storefront draws it. */}
      <div className="vh-preview">
        {previewing ? (
          <video key={previewing} src={previewing} poster={poster(previewing, 960)} autoPlay muted loop playsInline />
        ) : (
          <div className="vh-preview-empty">Pick a video below to preview the hero</div>
        )}
        <span className="vh-preview-shade" aria-hidden="true" />
        <div className="vh-preview-copy">
          <p>{text || DEFAULT_HERO_TEXT}</p>
          {ctaLabel.trim() ? (
            <span className="vh-preview-cta">
              {ctaLabel}
              <span aria-hidden="true">›</span>
            </span>
          ) : null}
        </div>
        {previewUrl && inPlaylist(previewUrl) < 0 ? (
          <button type="button" className="btn sm vh-preview-tag" onClick={() => setPreviewUrl(null)}>
            Previewing a library video · back to playlist
          </button>
        ) : null}
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Field label="Hero text" help="Line breaks are kept.">
          <textarea value={text} maxLength={300} rows={3} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label="Button label" help="Opens the shop, like the Classic hero's button. Leave empty to hide it.">
          <input type="text" value={ctaLabel} maxLength={30} onChange={(e) => setCtaLabel(e.target.value)} />
        </Field>
      </div>

      <div className="section-label">
        Playlist <span className="faint">— plays in this order, then starts again</span>
      </div>
      {playlist.length ? (
        <ol className="vh-playlist">
          {playlist.map((video, index) => (
            <li
              key={video.url}
              draggable
              className={dragFrom === index ? "dragging" : undefined}
              onDragStart={() => setDragFrom(index)}
              onDragEnd={() => setDragFrom(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null) move(dragFrom, index);
                setDragFrom(null);
              }}
            >
              <span className="vh-grip" aria-hidden="true">⋮⋮</span>
              <span className="vh-order">{index + 1}</span>
              <img src={poster(video.url, 160)} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              <span className="vh-playlist-name">
                {video.name}
                <span className="faint">{[duration(video.duration), megabytes(video.bytes)].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="inline" style={{ gap: 4 }}>
                <button type="button" className="btn ghost sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${video.name} up`}>↑</button>
                <button type="button" className="btn ghost sm" disabled={index === playlist.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${video.name} down`}>↓</button>
                <button type="button" className="btn ghost sm" onClick={() => toggle(video)} aria-label={`Remove ${video.name} from the playlist`}>Remove</button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>Nothing selected yet — choose videos from the library below.</p>
      )}

      <div className="vh-library-head">
        <div className="section-label" style={{ margin: 0 }}>Video library</div>
        <input type="search" placeholder="Search videos" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the video library" />
        <label className={`btn${uploading ? " disabled" : ""}`} aria-disabled={uploading}>
          Upload video
          <input type="file" accept="video/mp4,video/webm" hidden disabled={uploading} onChange={onFile} />
        </label>
      </div>
      <p className="faint" style={{ margin: "6px 0 10px", fontSize: 12 }}>
        MP4 (H.264) plays on every browser; WebM is smaller but older iPhones cannot play it. Up to 100 MB.
      </p>

      {upload ? (
        <div className={`vh-upload ${upload.status}`} role="status">
          <span className="vh-upload-name">{upload.name}</span>
          {upload.status === "uploading" ? (
            <>
              <span className="vh-upload-bar"><span style={{ width: `${Math.round(upload.progress * 100)}%` }} /></span>
              <span>{Math.round(upload.progress * 100)}%</span>
            </>
          ) : upload.status === "done" ? (
            <span>Uploaded and added to the playlist</span>
          ) : (
            <span>{upload.message}</span>
          )}
        </div>
      ) : null}

      <Banner tone="error">{libraryError}</Banner>
      {library === null ? (
        <p className="muted">Loading the library…</p>
      ) : shown.length ? (
        <div className="vh-library">
          {shown.map((video) => {
            const position = inPlaylist(video.url);
            return (
              <div key={video.url} className={`vh-card${position >= 0 ? " selected" : ""}`}>
                <button type="button" className="vh-card-pick" aria-pressed={position >= 0} onClick={() => toggle(video)}>
                  <span className="vh-card-media">
                    <img src={poster(video.url)} alt="" loading="lazy" />
                    {position >= 0 ? <span className="vh-card-badge">{position + 1}</span> : null}
                  </span>
                  <span className="vh-card-name">{video.name}</span>
                  <span className="vh-card-meta">
                    {[duration(video.duration), megabytes(video.bytes), uploaded(video.createdAt)].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <button type="button" className="btn ghost sm" onClick={() => setPreviewUrl(video.url)}>
                  Preview
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">{query ? "No videos match that search." : "No videos uploaded yet — upload the first one above."}</p>
      )}
    </Modal>
  );
}
