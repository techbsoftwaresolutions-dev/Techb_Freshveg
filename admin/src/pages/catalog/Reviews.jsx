import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Banner, Card, Empty, Loading, Modal, Pill, Table, when } from "../../components/ui";

const TABS = [
  { key: "pending", label: "Awaiting approval" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
];
const RATING_FILTERS = ["", "5", "4", "3", "2", "1"];
const TONES = ["green", "blue", "amber", "violet", "pink", "indigo"];
const toneFor = (name = "") => TONES[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TONES.length];

function Stars({ value = 0, size = 16 }) {
  return (
    <span className="stars" style={{ fontSize: size }} role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? "on" : ""}>★</span>
      ))}
    </span>
  );
}

const VerifiedTick = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" role="img" aria-label="Verified purchase" style={{ flex: "0 0 auto" }}>
    <title>Verified purchase</title>
    <circle cx="12" cy="12" r="11" fill="#1f9a52" />
    <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function ReviewCard({ review, canModerate, busy, onPublish, onReject, onRestore, onZoom }) {
  const [open, setOpen] = useState(false);
  const name = review.customer?.name || review.customerName || "Customer";
  const photo = review.product?.media?.[0]?.url;
  const comment = review.comment || "";
  const long = comment.length > 180;
  const secondary = [
    review.deliveryRating ? ["Delivery", review.deliveryRating] : null,
    review.packagingRating ? ["Packaging", review.packagingRating] : null,
  ].filter(Boolean);

  return (
    <article className={`review-card ${review.status}`}>
      <header className="review-card-head">
        <span className="review-product-photo" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
          {photo ? null : (review.product?.name || "?").charAt(0).toUpperCase()}
        </span>
        <div className="review-product">
          <strong>{review.product?.name || "Product removed"}</strong>
          <span className="mono">{review.orderCode || "—"}</span>
        </div>
        <div className="review-score">
          {review.productRating ? (
            <>
              <Stars value={review.productRating} />
              <b>{Number(review.productRating).toFixed(1)}</b>
            </>
          ) : (
            <span className="faint">No product rating</span>
          )}
        </div>
      </header>

      <div className="review-body">
        {review.title ? <h3>{review.title}</h3> : null}
        {comment ? (
          <p className={long && !open ? "clamp" : ""}>{comment}</p>
        ) : (
          <p className="faint"><em>No written comment</em></p>
        )}
        {long ? (
          <button type="button" className="review-more" onClick={() => setOpen((v) => !v)}>
            {open ? "Show less" : "Read full review"}
          </button>
        ) : null}

        {review.images?.length ? (
          <div className="review-images">
            {review.images.map((src) => (
              <button key={src} type="button" onClick={() => onZoom(src)} aria-label="View photo">
                <img src={src} alt="Review photo" loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}

        {secondary.length ? (
          <div className="review-extras">
            {secondary.map(([label, value]) => (
              <span key={label} className="review-extra">
                {label} <Stars value={value} size={12} /> <b>{value}/5</b>
              </span>
            ))}
          </div>
        ) : null}

        {review.status !== "pending" && (review.moderationNote || review.moderatedAt) ? (
          <div className="review-note">
            {review.status === "published" ? "Published" : "Rejected"} {review.moderatedAt ? when(review.moderatedAt) : ""}
            {review.moderationNote ? <> — {review.moderationNote}</> : null}
          </div>
        ) : null}
      </div>

      <footer className="review-card-foot">
        <span className="review-who">
          <span className={`cat-avatar letter ${toneFor(name)}`} style={{ width: 32, height: 32, borderRadius: 10 }}>
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="review-who-text">
            <span className="review-who-name">
              {name}
              {review.verifiedPurchase ? <VerifiedTick /> : null}
            </span>
            <span className="faint">
              {when(review.createdAt)}
              {review.helpfulCount ? ` · ${review.helpfulCount} found helpful` : ""}
            </span>
          </span>
        </span>

        {canModerate ? (
          <span className="review-actions">
            {review.status !== "published" ? (
              <button className="btn sm primary" disabled={busy} onClick={() => onPublish(review)}>
                {review.status === "rejected" ? "Publish instead" : "Publish"}
              </button>
            ) : null}
            {review.status !== "rejected" ? (
              <button className="btn sm danger" disabled={busy} onClick={() => onReject(review)}>
                {review.status === "published" ? "Unpublish & reject" : "Reject"}
              </button>
            ) : null}
            {review.status !== "pending" ? (
              <button className="btn sm ghost" disabled={busy} onClick={() => onRestore(review)}>
                Back to queue
              </button>
            ) : null}
          </span>
        ) : null}
      </footer>
    </article>
  );
}

const PAGE_LIMIT = 12;

// Previous / Next that stays on screen even when everything fits on one page.
function Pager({ meta, onPage }) {
  const total = meta?.total ?? 0;
  const page = meta?.page ?? 1;
  const pages = Math.max(1, meta?.pages ?? 1);
  const first = total ? (page - 1) * PAGE_LIMIT + 1 : 0;
  const last = Math.min(total, page * PAGE_LIMIT);
  return (
    <div className="dash-pager review-pager">
      <button type="button" className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹ Previous
      </button>
      <span className="faint">
        {first}–{last} of {total}
      </span>
      <button type="button" className="btn sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next ›
      </button>
    </div>
  );
}

const STATUS_TONE = { pending: "warn", published: "ok", rejected: "danger" };
const STATUS_LABEL = { pending: "Awaiting approval", published: "Published", rejected: "Rejected" };

// The same moderation actions as the card, as compact buttons for a table row.
function RowActions({ review, busy, onPublish, onReject, onRestore }) {
  return (
    <span className="review-actions" onClick={(e) => e.stopPropagation()}>
      {review.status !== "published" ? (
        <button className="btn sm primary" disabled={busy} onClick={() => onPublish(review)}>
          {review.status === "rejected" ? "Publish instead" : "Publish"}
        </button>
      ) : null}
      {review.status !== "rejected" ? (
        <button className="btn sm danger" disabled={busy} onClick={() => onReject(review)}>
          {review.status === "published" ? "Unpublish & reject" : "Reject"}
        </button>
      ) : null}
      {review.status !== "pending" ? (
        <button className="btn sm ghost" disabled={busy} onClick={() => onRestore(review)}>
          Back to queue
        </button>
      ) : null}
    </span>
  );
}

function ReviewTable({ rows, meta, onPage, canModerate, busyId, onPublish, onReject, onRestore, onZoom }) {
  const columns = [
    {
      key: "productName",
      label: "Product",
      render: (r) => {
        const photo = r.product?.media?.[0]?.url;
        return (
          <span className="person-cell">
            <span className="review-product-photo sm" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
              {photo ? null : (r.product?.name || "?").charAt(0).toUpperCase()}
            </span>
            <span className="stack">
              <span className="row-title">{r.product?.name || "Product removed"}</span>
              <span className="row-sub mono">{r.orderCode || "—"}</span>
            </span>
          </span>
        );
      },
    },
    {
      key: "productRating",
      label: "Rating",
      render: (r) =>
        r.productRating ? (
          <span className="review-rate-cell">
            <Stars value={r.productRating} size={14} />
            <b>{Number(r.productRating).toFixed(1)}</b>
          </span>
        ) : (
          <span className="faint">—</span>
        ),
    },
    {
      key: "comment",
      label: "Review",
      render: (r) => (
        <span className="review-text-cell">
          {r.title ? <strong>{r.title}</strong> : null}
          {r.comment ? <span className="review-text-clamp">{r.comment}</span> : <em className="faint">No written comment</em>}
          {r.images?.length ? (
            <span className="review-thumbs" onClick={(e) => e.stopPropagation()}>
              {r.images.slice(0, 3).map((src) => (
                <button key={src} type="button" onClick={() => onZoom(src)} aria-label="View photo">
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      render: (r) => {
        const name = r.customer?.name || r.customerName || "Customer";
        return (
          <span className="person-cell">
            <span className={`cat-avatar letter ${toneFor(name)}`} style={{ width: 30, height: 30, borderRadius: 10 }}>
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="stack">
              <span className="row-title review-who-name">
                {name}
                {r.verifiedPurchase ? <VerifiedTick /> : null}
              </span>
            </span>
          </span>
        );
      },
    },
    { key: "createdAt", label: "Date", render: (r) => <span className="muted">{when(r.createdAt)}</span> },
    {
      key: "status",
      label: "Status",
      render: (r) => <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status] || r.status}</Pill>,
    },
  ];
  if (canModerate) {
    columns.push({
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (r) => (
        <RowActions review={r} busy={busyId === r.id} onPublish={onPublish} onReject={onReject} onRestore={onRestore} />
      ),
    });
  }
  return (
    <Card tight>
      <Table title="Product reviews" columns={columns} rows={rows} keyOf={(r) => r.id} />
      <Pager meta={meta} onPage={onPage} />
    </Card>
  );
}

// Moderation queue. The point of the screen is the pending tab — everything
// else is history.
export default function Reviews() {
  const { can } = useAuth();
  const canModerate = can("catalog.manage");

  const [status, setStatus] = useState("pending");
  const [rating, setRating] = useState("");
  const [data, setData] = useState({ items: [], meta: null });
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [zoom, setZoom] = useState("");
  // Cards or a table — remembered for next time.
  const [view, setViewState] = useState(() => {
    try {
      return localStorage.getItem("commerce.admin.reviewView") === "table" ? "table" : "cards";
    } catch {
      return "cards";
    }
  });
  const setView = (next) => {
    setViewState(next);
    try {
      localStorage.setItem("commerce.admin.reviewView", next);
    } catch {
      // storage unavailable — the choice still applies for this visit
    }
  };

  const loadCounts = useCallback(() => {
    Promise.all(TABS.map((t) => api.get("/reviews", { status: t.key, limit: 1 }).then((r) => [t.key, r.meta?.total ?? 0])))
      .then((pairs) => setCounts(Object.fromEntries(pairs)))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/reviews", { status, page, limit: PAGE_LIMIT, ...(rating ? { rating } : {}) })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, page, rating]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  async function moderate(review, decision, note) {
    setBusy(review.id);
    setError("");
    try {
      await api.post(`/reviews/${review.id}/moderate`, { status: decision, note });
      setNotice(
        decision === "published"
          ? "Published — it's live on the product page and counts towards the rating."
          : decision === "rejected"
            ? "Rejected. It stays on record but is not public."
            : "Moved back to the approval queue."
      );
      setRejecting(null);
      load();
      loadCounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const total = Object.values(counts).reduce((n, c) => n + c, 0);

  return (
    <div className="page products-page reviews-page">
      <div className="page-head">
        <div>
          <h1>Product reviews</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{notice}</Banner>

      <div className="toolbar products-filters">
        <div className="chip-row review-tabs" role="tablist" aria-label="Status">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={status === tab.key}
              className={`cat-chip${status === tab.key ? " on" : ""}`}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
            >
              {tab.label}
              {counts[tab.key] !== undefined ? <span className="chip-count">{counts[tab.key]}</span> : null}
            </button>
          ))}
        </div>
        <div className="chip-row review-rating-filter" role="group" aria-label="Rating">
          {RATING_FILTERS.map((value) => (
            <button
              key={value || "all"}
              type="button"
              className={`cat-chip small${rating === value ? " on" : ""}`}
              onClick={() => {
                setRating(value);
                setPage(1);
              }}
            >
              {value ? `${value} ★` : "All ratings"}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div className="view-toggle" role="group" aria-label="View">
          <button type="button" className={view === "cards" ? "on" : ""} onClick={() => setView("cards")} title="Cards" aria-label="Card view" aria-pressed={view === "cards"}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          </button>
          <button type="button" className={view === "table" ? "on" : ""} onClick={() => setView("table")} title="Table" aria-label="Table view" aria-pressed={view === "table"}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <Card>
          <Loading />
        </Card>
      ) : data.items.length ? (
        <>
          {view === "table" ? (
            <ReviewTable
              rows={data.items}
              meta={data.meta}
              onPage={setPage}
              canModerate={canModerate}
              busyId={busy}
              onPublish={(r) => moderate(r, "published")}
              onReject={setRejecting}
              onRestore={(r) => moderate(r, "pending")}
              onZoom={setZoom}
            />
          ) : (
          <div className="review-grid">
            {data.items.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                canModerate={canModerate}
                busy={busy === review.id}
                onPublish={(r) => moderate(r, "published")}
                onReject={setRejecting}
                onRestore={(r) => moderate(r, "pending")}
                onZoom={setZoom}
              />
            ))}
          </div>
          )}
          {view === "cards" ? (
            <Card tight>
              <Pager meta={data.meta} onPage={setPage} />
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <Empty
            title={status === "pending" ? "Nothing waiting for approval" : `No ${status} reviews`}
            hint={rating ? "Try a different rating." : "Customers can review an order once it has been delivered."}
          />
        </Card>
      )}

      {rejecting ? (
        <RejectModal
          review={rejecting}
          busy={busy === rejecting.id}
          onClose={() => setRejecting(null)}
          onReject={(note) => moderate(rejecting, "rejected", note)}
        />
      ) : null}

      {zoom ? (
        <div className="review-lightbox" role="dialog" aria-label="Review photo" onClick={() => setZoom("")}>
          <img src={zoom} alt="Review photo" />
        </div>
      ) : null}
    </div>
  );
}

function RejectModal({ review, busy, onClose, onReject }) {
  const [note, setNote] = useState("");

  return (
    <Modal
      title="Reject this review"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={busy} onClick={() => onReject(note)}>
            {busy ? "Rejecting…" : "Reject review"}
          </button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Rejecting keeps the review on record but hides it from the product page and removes it from
        the rating. The note is for your team, not the customer.
      </p>
      <blockquote
        style={{
          margin: "0 0 14px",
          padding: "10px 14px",
          borderLeft: "3px solid var(--border-strong)",
          color: "var(--text-muted)",
          fontSize: 13.5,
        }}
      >
        {review.comment || <em>No written comment</em>}
      </blockquote>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why is this being rejected? e.g. abusive language, not about the product"
      />
    </Modal>
  );
}
