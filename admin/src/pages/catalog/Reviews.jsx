import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  Banner, Card, Empty, Loading, Modal, Pagination, Rating, Table, Tabs, when,
} from "../../components/ui";

// Moderation queue. The point of the screen is the pending tab — everything
// else is history.
export default function Reviews() {
  const { can } = useAuth();
  const canModerate = can("catalog.manage");

  const [status, setStatus] = useState("pending");
  const [data, setData] = useState({ items: [], meta: null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejecting, setRejecting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/reviews", { status, page, limit: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(review, decision, note) {
    setBusy(review.id);
    setError("");
    try {
      await api.post(`/reviews/${review.id}/moderate`, { status: decision, note });
      setNotice(
        decision === "published"
          ? "Published — it's live on the product page and counts towards the rating."
          : "Rejected. It stays on record but is not public."
      );
      setRejecting(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Product reviews</h1>
        </div>
      </div>

      <Banner tone="error">{error}</Banner>
      <Banner tone="ok">{notice}</Banner>

      <Tabs
        tabs={[
          { key: "pending", label: "Awaiting approval" },
          { key: "published", label: "Published" },
          { key: "rejected", label: "Rejected" },
        ]}
        active={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
      />

      <Card tight>
        {loading ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Product reviews"
              columns={[
                {
                  key: "product",
                  label: "Product",
                  render: (row) => (
                    <div className="stack">
                      <span className="row-title">{row.product?.name || "—"}</span>
                      <span className="row-sub mono">{row.orderCode}</span>
                    </div>
                  ),
                },
                {
                  key: "ratings",
                  label: "Ratings",
                  render: (row) => (
                    <div className="stack" style={{ gap: 2 }}>
                      {row.productRating ? (
                        <span><Rating value={row.productRating} /> <span className="faint">product</span></span>
                      ) : null}
                      {row.deliveryRating ? (
                        <span className="row-sub">Delivery {row.deliveryRating}/5 · Packaging {row.packagingRating || "—"}/5</span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "comment",
                  label: "Review",
                  render: (row) => (
                    <div className="stack" style={{ maxWidth: 360 }}>
                      {row.title ? <span className="row-title">{row.title}</span> : null}
                      <span className="row-sub">{row.comment || <em>No written comment</em>}</span>
                    </div>
                  ),
                },
                {
                  key: "customer",
                  label: "Customer",
                  render: (row) => (
                    <div className="stack">
                      <span className="inline" style={{ gap: 6 }}>
                        {row.customerName || "—"}
                        {row.verifiedPurchase ? (
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            role="img"
                            aria-label="Verified purchase"
                            style={{ flex: "0 0 auto" }}
                          >
                            <title>Verified purchase</title>
                            <circle cx="12" cy="12" r="11" fill="#1f9a52" />
                            <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </span>
                      <span className="row-sub">{when(row.createdAt)}</span>
                    </div>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: (row) =>
                    canModerate ? (
                      <div className="inline" style={{ justifyContent: "flex-end", gap: 6 }}>
                        {row.status !== "published" ? (
                          <button
                            className="btn sm primary"
                            disabled={busy === row.id}
                            onClick={() => moderate(row, "published")}
                          >
                            Publish
                          </button>
                        ) : null}
                        {row.status !== "rejected" ? (
                          <button
                            className="btn sm danger"
                            disabled={busy === row.id}
                            onClick={() => setRejecting(row)}
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
                    ) : null,
                },
              ]}
              rows={data.items}
              empty={
                <Empty
                  title={
                    status === "pending"
                      ? "Nothing waiting for approval"
                      : `No ${status} reviews`
                  }
                  hint="Customers can review an order once it has been delivered."
                />
              }
            />
            <Pagination meta={data.meta} onPage={setPage} />
          </>
        )}
      </Card>

      {rejecting ? (
        <RejectModal
          review={rejecting}
          busy={busy === rejecting.id}
          onClose={() => setRejecting(null)}
          onReject={(note) => moderate(rejecting, "rejected", note)}
        />
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
