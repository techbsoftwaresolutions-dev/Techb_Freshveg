import DatePicker from "../../components/DatePicker";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Select from "../../components/Select";
import { api } from "../../api/client";
import { useApi } from "../../api/useApi";
import FormRoute from "../../components/FormRoute";
import { useAuth } from "../../context/AuthContext";
import { Banner as Notice, Card, Loading, Pagination, Pill, Table, useConfirm, when } from "../../components/ui";
import "./blog-editor.css";

const SITE = (import.meta.env.VITE_SITE_URL || "https://hosurbasket.com").replace(/\/+$/, "");

// Published, but its publish time is still ahead: it goes live by itself at that time.
const stateOf = (post) =>
  post.status !== "published" ? "draft" : new Date(post.publishedAt) > new Date() ? "scheduled" : "published";
const STATE_LABEL = { draft: "Draft", scheduled: "Scheduled", published: "Published" };
const STATE_TONE = { draft: "warn", scheduled: "info", published: "ok" };

// ---- The list ----------------------------------------------------------------

export default function Posts() {
  const [confirm, confirmDialog] = useConfirm();
  const { can } = useAuth();
  const canManage = can("marketing.manage");
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ q: "", status: "", page: 1 });
  const [term, setTerm] = useState(""); // the search box waits 250 ms before asking the server
  useEffect(() => {
    const timer = setTimeout(() => setTerm(filters.q), filters.q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const list = useApi("/blog", { q: term, status: filters.status, page: filters.page, limit: 20 });
  const data = list.data || { items: [], meta: null };
  const [error, setError] = useState("");

  async function remove(post) {
    const ok = await confirm({
      title: "Delete this post?",
      message: `"${post.title}" will be removed from the website for good. A draft you may want later is better left as a draft.`,
      confirmLabel: "Delete post",
    });
    if (!ok) return;
    try {
      await api.delete(`/blog/${post.id}`);
      list.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page products-page">
      {confirmDialog}
      <div className="page-head">
        <div>
          <h1>Blog</h1>
        </div>
        {canManage ? <button className="btn primary" onClick={() => navigate("/blog/new")}>+ New post</button> : null}
      </div>

      <Notice tone="error">{error || (list.error && !list.data ? list.error.message : "")}</Notice>

      <div className="toolbar products-filters">
        <input
          type="search"
          placeholder="Search posts by title…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })}
          style={{ minWidth: 240 }}
        />
        <span className="spacer" />
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">All posts</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </Select>
      </div>

      <Card tight>
        {list.loading ? (
          <Loading />
        ) : (
          <>
        <Table
          title="Blog posts"
          search={false /* the search box above asks the server, so it finds posts on every page */}
          keyOf={(row) => row.id}
          rows={data.items}
          onRowClick={canManage ? (row) => navigate(`/blog/${row.id}`) : undefined}
          empty="No posts yet. Write your first one with “+ New post”."
          columns={[
            {
              key: "title",
              label: "Post",
              render: (row) => (
                <div className="inline" style={{ gap: 12, flexWrap: "nowrap" }}>
                  {row.coverImage ? (
                    <img src={row.coverImage} alt="" style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 6, flex: "none" }} />
                  ) : (
                    <span style={{ width: 56, height: 40, borderRadius: 6, background: "var(--surface-2)", flex: "none" }} />
                  )}
                  <div className="stack">
                    <span className="row-title">{row.title}</span>
                    <span className="row-sub">/blog/{row.slug}</span>
                  </div>
                </div>
              ),
            },
            { key: "category", label: "Category", render: (row) => row.category || "—" },
            { key: "status", label: "Status", render: (row) => <Pill tone={STATE_TONE[stateOf(row)]}>{STATE_LABEL[stateOf(row)]}</Pill> },
            { key: "lang", label: "Language", render: (row) => (row.lang === "ta" ? "Tamil" : "English") },
            { key: "publishedAt", label: "Publish date", render: (row) => (row.publishedAt ? when(row.publishedAt) : "—") },
            { key: "readingMinutes", label: "Read", render: (row) => `${row.readingMinutes} min` },
            ...(canManage
              ? [
                  {
                    key: "actions",
                    label: "",
                    align: "right",
                    render: (row) => (
                      <div className="inline" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); navigate(`/blog/${row.id}`); }}>Edit</button>
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); remove(row); }}>Delete</button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <Pagination meta={data.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </Card>
    </div>
  );
}

// ---- The editor ----------------------------------------------------------------

export function PostFormPage() {
  return (
    <FormRoute
      backTo="/blog"
      backLabel="Blog"
      load={async (id) => (id ? (await api.get(`/blog/${id}`)).post : {})}
      render={(post, back) => <PostEditor post={post} onClose={back} onSaved={back} />}
    />
  );
}

// Small inline icons (the shared set has none for an editor toolbar).
const PATHS = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  tag: "M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9.5h.01",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3",
  ul: "M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01",
  ol: "M10 6h11M10 12h11M10 18h11M3.5 5h1.5v4M3 14h2.5L3 17h2.5",
  quote: "M5 17c0-4 1-7 4-9M13 17c0-4 1-7 4-9M5 17h4v-4H5zM13 17h4v-4h-4z",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  check: "M5 12l5 5 9-10",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
};
const Ic = ({ n, size = 18, sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[n]} />
  </svg>
);

const slugify = (s) =>
  String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

// "yyyy-MM-ddTHH:mm" in local time, what a datetime-local box wants.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const ago = (time) => {
  if (!time) return "";
  const s = Math.max(0, (Date.now() - new Date(time).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  return `${Math.round(s / 86400)} days ago`;
};

function PostEditor({ post, onSaved, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const categoriesQ = useApi("/blog/categories");
  const categories = categoriesQ.data?.categories || [];

  const [form, setForm] = useState({
    title: post.title || "",
    slug: post.slug || "",
    excerpt: post.excerpt || "",
    body: post.body || "",
    coverImage: post.coverImage || "",
    coverAlt: post.coverAlt || "",
    category: post.category || "",
    tags: post.tags || [],
    lang: post.lang || "en",
    authorName: post.authorName || "",
    // draft | scheduled | published: how this post should be when saved with Publish
    state: post.id ? stateOf(post) : "draft",
    publishedAt: toLocalInput(post.publishedAt),
    seo: { title: post.seo?.title || "", description: post.seo?.description || "" },
  });
  const [tagText, setTagText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState(false); // preview inside the editor
  const [overlay, setOverlay] = useState(false); // full preview from the bottom bar
  const [full, setFull] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [savedAt, setSavedAt] = useState(location.state?.savedAt || (post.id ? post.updatedAt : null));
  const [, tick] = useState(0);
  const boxRef = useRef(null);
  const fileRef = useRef(null);
  const topRef = useRef(null);
  const seoRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // "Last saved 2 min ago" keeps counting.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const isLive = Boolean(post.id) && post.status === "published";
  const missing = [
    !form.title.trim() && "a title",
    !form.excerpt.trim() && "a summary",
    !form.category && "a category",
    !form.body.trim() && "some content",
  ].filter(Boolean);

  // ---- toolbar: Markdown around the selection, or on the selected lines ----
  const selection = () => {
    const box = boxRef.current;
    return box ? [box.selectionStart, box.selectionEnd] : [form.body.length, form.body.length];
  };
  function replaceRange(start, end, text, selStart, selEnd) {
    set({ body: form.body.slice(0, start) + text + form.body.slice(end) });
    requestAnimationFrame(() => {
      boxRef.current?.focus();
      boxRef.current?.setSelectionRange(selStart, selEnd);
    });
  }
  function wrap(before, after, placeholder) {
    const [s, e] = selection();
    const chosen = form.body.slice(s, e) || placeholder;
    replaceRange(s, e, before + chosen + after, s + before.length, s + before.length + chosen.length);
  }
  function onLines(fn) {
    const [s, e] = selection();
    const from = form.body.lastIndexOf("\n", s - 1) + 1;
    let to = form.body.indexOf("\n", e);
    if (to < 0) to = form.body.length;
    const block = form.body.slice(from, to).split("\n").map(fn).join("\n");
    replaceRange(from, to, block, from, from + block.length);
  }
  const setBlock = (kind) => onLines((l) => `${kind === "h2" ? "## " : kind === "h3" ? "### " : ""}${l.replace(/^#{1,6}\s+/, "")}`);
  const toggleBullet = () => onLines((l) => (l.startsWith("- ") ? l.slice(2) : `- ${l}`));
  const toggleNumber = () => onLines((l, i) => (/^\d+\.\s/.test(l) ? l.replace(/^\d+\.\s/, "") : `${i + 1}. ${l}`));
  const toggleQuote = () => onLines((l) => (l.startsWith("> ") ? l.slice(2) : `> ${l}`));
  function addLink() {
    const [s, e] = selection();
    const text = form.body.slice(s, e) || "link text";
    const out = `[${text}](https://)`;
    const urlStart = s + text.length + 3;
    replaceRange(s, e, out, urlStart, urlStart + 8);
  }
  function addTable() {
    const [s, e] = selection();
    const t = "\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n";
    replaceRange(s, e, t, s + t.length, s + t.length);
  }

  async function upload(file, then) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError("Please choose a JPG, PNG or WebP picture.");
    if (file.size > 5 * 1024 * 1024) return setError("That picture is over 5 MB. Please choose a smaller one.");
    setUploading(true);
    setError("");
    try {
      then((await api.upload(file, "blog")).url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }
  const pickCover = (file) => upload(file, (url) => set({ coverImage: url }));
  const pickInline = (file) =>
    upload(file, (url) => {
      const [s, e] = selection();
      const t = `\n![describe the picture](${url})\n`;
      replaceRange(s, e, t, s + 3, s + 3 + "describe the picture".length);
    });

  // Draft / Scheduled / Published pills. Scheduling needs a future time (tomorrow if none chosen).
  function chooseState(key) {
    if (key === "scheduled") {
      const keep = form.publishedAt && new Date(form.publishedAt) > new Date();
      return set({ state: key, publishedAt: keep ? form.publishedAt : toLocalInput(new Date(Date.now() + 86400000).toISOString()) });
    }
    if (key === "published") return set({ state: key, publishedAt: isLive ? form.publishedAt : "" });
    return set({ state: key });
  }

  // ---- tags ----
  function addTags(text) {
    const next = text.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (next.length) set({ tags: [...new Set([...form.tags, ...next])].slice(0, 10) });
  }

  // ---- saving ----
  async function save(mode) {
    // mode: "draft" saves as a draft and stays here; "publish" publishes (or schedules) and returns to the list.
    if (mode === "publish") {
      setAttempted(true);
      if (missing.length) {
        setError(`To publish, add ${missing.join(", ")}.`);
        topRef.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    } else if (!form.title.trim()) {
      setAttempted(true);
      setError("Give the post a title before saving.");
      return;
    }
    setBusy(true);
    setError("");
    const scheduled = form.state === "scheduled" && form.publishedAt;
    const body = {
      title: form.title,
      slug: form.slug || undefined,
      excerpt: form.excerpt,
      body: form.body,
      coverImage: form.coverImage,
      coverAlt: form.coverAlt,
      category: form.category,
      tags: form.tags,
      lang: form.lang,
      authorName: form.authorName,
      seo: form.seo,
      status: mode === "publish" ? "published" : "draft",
      // Publishing now leaves the date empty (the server stamps it); a schedule keeps the chosen time.
      publishedAt: mode === "publish" ? (scheduled ? new Date(form.publishedAt).toISOString() : post.publishedAt && isLive ? post.publishedAt : null) : form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
    };
    try {
      if (post.id) {
        await api.patch(`/blog/${post.id}`, body);
        if (mode === "publish") return onSaved();
        setSavedAt(new Date().toISOString());
      } else {
        const created = (await api.post("/blog", body)).post;
        if (mode === "publish") return onSaved();
        // Stay on this post (now saved), under its own address, so the next save updates it.
        navigate(`/blog/${created.id}`, { replace: true, state: { savedAt: new Date().toISOString() } });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  const slugShown = form.slug || slugify(form.title) || "your-blog-url";
  const step1Done = Boolean(form.title.trim() && form.excerpt.trim() && form.body.trim());
  const step2Done = Boolean(form.category);
  const activeStep = !step1Done ? 1 : !step2Done ? 2 : 3;
  const bad = (cond) => (attempted && cond ? "bad" : "");
  const publishLabel = isLive ? "Save changes" : form.state === "scheduled" ? "Schedule" : "Publish";

  const steps = [
    { n: 1, title: "Write & Design", sub: "Create your blog post", done: step1Done, go: () => topRef.current?.scrollIntoView({ behavior: "smooth" }) },
    { n: 2, title: "SEO & Settings", sub: "Optimize for search", done: step2Done, go: () => seoRef.current?.scrollIntoView({ behavior: "smooth" }) },
    { n: 3, title: "Preview & Publish", sub: "Review and go live", done: false, go: () => setOverlay(true) },
  ];

  return (
    <div className="be">
      <nav className="be-crumbs" aria-label="Breadcrumb">
        <Link to="/"><Ic n="home" size={16} /></Link>
        <span>›</span>
        <Link to="/blog">Blog</Link>
        <span>›</span>
        <span>{post.id ? "Edit post" : "New post"}</span>
      </nav>

      <div className="page-head">
        <div>
          <h1>{post.id ? "Edit blog post" : "New blog post"}</h1>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="be-grid">
        <main className="be-card be-main" ref={topRef}>
          <ol className="be-steps">
            {steps.map((s, i) => (
              <li key={s.n} style={{ display: "contents" }}>
                <button type="button" className={`be-step${activeStep === s.n ? " on" : ""}${s.done ? " done" : ""}`} onClick={s.go}>
                  <span className="be-step-num">{s.done ? <Ic n="check" size={18} sw={2.4} /> : s.n}</span>
                  <span><b>{s.title}</b><small>{s.sub}</small></span>
                </button>
                {i < steps.length - 1 ? <span className="be-step-line" /> : null}
              </li>
            ))}
          </ol>

          <div>
            <label className="be-label" htmlFor="be-title">Title <span className="req">*</span></label>
            <input id="be-title" type="text" className={bad(!form.title.trim())} maxLength={150} placeholder="Enter a compelling blog title…" value={form.title} onChange={(e) => set({ title: e.target.value })} />
            <div className="be-count">{form.title.length} / 150</div>
          </div>

          <div>
            <label className="be-label" htmlFor="be-excerpt">Summary (Excerpt) <span className="req">*</span></label>
            <textarea id="be-excerpt" rows={3} className={bad(!form.excerpt.trim())} maxLength={300} placeholder="Write a short summary that tells readers what this blog is about…" value={form.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
            <div className="be-count">{form.excerpt.length} / 300</div>
          </div>

          <div>
            <span className="be-label">Featured Image (Cover Photo)</span>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pickCover(f); }} />
            <div className="be-media">
              <div
                className={`be-drop${over ? " over" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); pickCover(e.dataTransfer.files?.[0]); }}
              >
                <Ic n="image" size={34} />
                <b>{uploading ? "Uploading…" : "Drag & drop an image here, or click to upload"}</b>
                <small>JPG, PNG, WebP • Max 5 MB • Recommended: 1200 × 630 px</small>
              </div>
              <div>
                <div className="be-sublabel">Image Preview</div>
                <div className="be-previewbox">
                  {form.coverImage ? (
                    <>
                      <img src={form.coverImage} alt={form.coverAlt || "Cover preview"} />
                      <div className="be-img-actions">
                        <button type="button" className="be-icon-btn" aria-label="Replace image" onClick={() => fileRef.current?.click()}><Ic n="edit" size={16} /></button>
                        <button type="button" className="be-icon-btn" aria-label="Remove image" onClick={() => set({ coverImage: "", coverAlt: "" })}><Ic n="trash" size={16} /></button>
                      </div>
                    </>
                  ) : (
                    <span>No image yet</span>
                  )}
                </div>
              </div>
            </div>
            {form.coverImage ? (
              <div className="be-field" style={{ marginTop: 12 }}>
                <label className="be-label" htmlFor="be-alt">Image description</label>
                <input id="be-alt" type="text" placeholder="What the photo shows, in a few words (helps Google Images)" value={form.coverAlt} onChange={(e) => set({ coverAlt: e.target.value })} />
              </div>
            ) : null}
          </div>

          <div>
            <span className="be-label">Content <span className="req">*</span></span>
            <div className={`be-editor${full ? " full" : ""}`}>
              <div className="be-toolbar" role="toolbar" aria-label="Formatting">
                <select aria-label="Paragraph style" disabled={preview} defaultValue="p" onChange={(e) => { setBlock(e.target.value); e.target.value = "p"; }}>
                  <option value="p">Paragraph</option>
                  <option value="h2">Heading</option>
                  <option value="h3">Sub-heading</option>
                </select>
                <span className="be-sep" />
                <button type="button" className="be-tool" title="Bold" aria-label="Bold" disabled={preview} onClick={() => wrap("**", "**", "bold text")}><b>B</b></button>
                <button type="button" className="be-tool" title="Italic" aria-label="Italic" disabled={preview} onClick={() => wrap("*", "*", "italic text")}><i>I</i></button>
                <button type="button" className="be-tool" title="Strikethrough" aria-label="Strikethrough" disabled={preview} onClick={() => wrap("~~", "~~", "text")}><s>S</s></button>
                <span className="be-sep" />
                <button type="button" className="be-tool" title="Bulleted list" aria-label="Bulleted list" disabled={preview} onClick={toggleBullet}><Ic n="ul" /></button>
                <button type="button" className="be-tool" title="Numbered list" aria-label="Numbered list" disabled={preview} onClick={toggleNumber}><Ic n="ol" /></button>
                <button type="button" className="be-tool" title="Quote" aria-label="Quote" disabled={preview} onClick={toggleQuote}><Ic n="quote" /></button>
                <span className="be-sep" />
                <button type="button" className="be-tool" title="Link" aria-label="Link" disabled={preview} onClick={addLink}><Ic n="link" /></button>
                <label className="be-tool" title="Insert picture" style={{ cursor: preview ? "not-allowed" : "pointer", opacity: preview ? 0.4 : 1 }}>
                  <Ic n="image" />
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={preview || uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pickInline(f); }} />
                </label>
                <button type="button" className="be-tool" title="Table" aria-label="Table" disabled={preview} onClick={addTable}><Ic n="table" /></button>
                <span className="spacer" />
                <button type="button" className={`be-tool${preview ? " on" : ""}`} title="Preview" aria-label="Preview" aria-pressed={preview} onClick={() => setPreview((v) => !v)}><Ic n="eye" /></button>
                <button type="button" className={`be-tool${full ? " on" : ""}`} title="Full screen" aria-label="Full screen" aria-pressed={full} onClick={() => setFull((v) => !v)}><Ic n="expand" /></button>
              </div>
              {preview ? (
                <div className="be-rendered be-prose">
                  {form.body.trim() ? <Markdown remarkPlugins={[remarkGfm]}>{form.body}</Markdown> : <p style={{ color: "var(--text-muted)" }}>Nothing written yet.</p>}
                </div>
              ) : (
                <textarea
                  ref={boxRef}
                  className={bad(!form.body.trim())}
                  rows={14}
                  value={form.body}
                  onChange={(e) => set({ body: e.target.value })}
                  placeholder={"Start writing your blog content here…\n\nA blank line starts a new paragraph."}
                />
              )}
            </div>
          </div>
        </main>

        <aside className="be-side">
          <section className="be-card">
            <h2><Ic n="send" /> Publishing</h2>
            <div className="be-field">
              <span className="be-label">Status</span>
              <div className="be-pills" role="radiogroup" aria-label="Status">
                {[["draft", "Draft"], ["scheduled", "Scheduled"], ["published", "Published"]].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={form.state === key}
                    className={`be-pill${form.state === key ? " on" : ""}`}
                    onClick={() => chooseState(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="be-field">
              <span className="be-label">Language</span>
              <div className="be-pills" role="radiogroup" aria-label="Language">
                {[["en", "English"], ["ta", "தமிழ் (Tamil)"]].map(([key, label]) => (
                  <button key={key} type="button" role="radio" aria-checked={form.lang === key} className={`be-pill${form.lang === key ? " on" : ""}`} onClick={() => set({ lang: key })}>{label}</button>
                ))}
              </div>
            </div>
            <div className="be-field">
              <label className="be-label" htmlFor="be-date"><Ic n="cal" size={15} /> Publish date</label>
              <DatePicker id="be-date" withTime value={form.publishedAt} onChange={(v) => set({ publishedAt: v, state: v && new Date(v) > new Date() && form.state !== "draft" ? "scheduled" : form.state })} />
            </div>
            <div className="be-field">
              <label className="be-label" htmlFor="be-author">Author name</label>
              <input id="be-author" type="text" placeholder="Defaults to you" value={form.authorName} onChange={(e) => set({ authorName: e.target.value })} />
            </div>
          </section>

          <section className="be-card">
            <h2><Ic n="tag" /> Categories &amp; Tags</h2>
            <div className="be-field">
              <label className="be-label" htmlFor="be-cat">Category <span className="req">*</span></label>
              <select id="be-cat" className={bad(!form.category)} value={form.category} onChange={(e) => set({ category: e.target.value })}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="be-field">
              <label className="be-label" htmlFor="be-tags">Tags</label>
              <div className="be-chips">
                {form.tags.map((t) => (
                  <span className="be-chip" key={t}>{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => set({ tags: form.tags.filter((x) => x !== t) })}>×</button></span>
                ))}
                <input
                  id="be-tags"
                  type="text"
                  value={tagText}
                  placeholder={form.tags.length ? "" : "Add tags (e.g. grocery, tips, offers)"}
                  onChange={(e) => {
                    if (e.target.value.includes(",")) { addTags(e.target.value); setTagText(""); } else setTagText(e.target.value);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTags(tagText); setTagText(""); } if (e.key === "Backspace" && !tagText && form.tags.length) set({ tags: form.tags.slice(0, -1) }); }}
                  onBlur={() => { addTags(tagText); setTagText(""); }}
                />
              </div>
            </div>
          </section>

          <section className="be-card" ref={seoRef}>
            <h2><Ic n="search" /> SEO (Google Search)</h2>
            <div className="be-field">
              <label className="be-label" htmlFor="be-slug">Web address (slug)</label>
              <input id="be-slug" type="text" placeholder="your-blog-url" value={form.slug} onChange={(e) => set({ slug: e.target.value })} />
              <div className="be-url">{SITE}/blog/<b>{slugShown}</b></div>
            </div>
            <div className="be-field">
              <label className="be-label" htmlFor="be-st">Google search title <span style={{ float: "right", fontWeight: 400, color: "var(--text-muted)" }}>{form.seo.title.length} / 60</span></label>
              <input id="be-st" type="text" maxLength={70} placeholder="Enter SEO title…" value={form.seo.title} onChange={(e) => set({ seo: { ...form.seo, title: e.target.value } })} />
            </div>
            <div className="be-field">
              <label className="be-label" htmlFor="be-sd">Google search description <span style={{ float: "right", fontWeight: 400, color: "var(--text-muted)" }}>{form.seo.description.length} / 160</span></label>
              <textarea id="be-sd" rows={3} maxLength={200} placeholder="Enter meta description…" value={form.seo.description} onChange={(e) => set({ seo: { ...form.seo, description: e.target.value } })} />
            </div>
          </section>
        </aside>
      </div>

      <div className="be-bar">
        <button type="button" className="be-btn" onClick={() => setOverlay(true)}><Ic n="eye" size={17} /> Preview</button>
        <span className="spacer" />
        {savedAt ? <span className="be-saved"><Ic n="check" size={16} sw={2.4} /> Last saved {ago(savedAt)}</span> : null}
        <button type="button" className="be-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="be-btn" onClick={() => save("draft")} disabled={busy}>{isLive ? "Revert to draft" : "Save as Draft"}</button>
        <button type="button" className="be-btn primary" onClick={() => save("publish")} disabled={busy || uploading}><Ic n="send" size={16} /> {busy ? "Saving…" : publishLabel}</button>
      </div>

      {overlay ? (
        <div className="be-overlay" role="dialog" aria-modal="true" aria-label="Preview" onClick={() => setOverlay(false)}>
          <div className="be-overlay-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="be-btn" style={{ position: "absolute", right: 16, top: 16 }} onClick={() => setOverlay(false)}>Close</button>
            {form.category ? <span className="be-chip" style={{ padding: "3px 10px" }}>{form.category}</span> : null}
            <h1 style={{ margin: "8px 0", maxWidth: "85%" }}>{form.title || "Untitled post"}</h1>
            <div className="be-hint">{form.authorName || "You"} · {form.lang === "ta" ? "Tamil" : "English"}</div>
            {form.coverImage ? <img className="be-cover" src={form.coverImage} alt={form.coverAlt || ""} /> : null}
            {form.excerpt ? <p style={{ color: "var(--text-muted)" }}>{form.excerpt}</p> : null}
            <div className="be-prose">
              {form.body.trim() ? <Markdown remarkPlugins={[remarkGfm]}>{form.body}</Markdown> : <p style={{ color: "var(--text-muted)" }}>Nothing written yet.</p>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
