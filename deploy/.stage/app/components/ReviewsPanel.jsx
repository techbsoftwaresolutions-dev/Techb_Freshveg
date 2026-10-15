"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

// Real reviews only — nothing here is invented. A product with none yet says
// so plainly instead of showing a placeholder rating or a sample review.
export default function ReviewsPanel({ productId, rating }) {
  const [state, setState] = useState({ loading: true, items: [], breakdown: [], error: false });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, items: [], breakdown: [], error: false });
    api
      .get(`/reviews/product/${productId}`, { limit: 10 })
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, items: data.items || [], breakdown: data.breakdown || [], error: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ loading: false, items: [], breakdown: [], error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (state.loading) return <p style={{ color: "var(--text-faint)" }}>Loading reviews…</p>;
  if (state.error) return <p style={{ color: "var(--text-faint)" }}>Couldn't load reviews right now.</p>;

  if (!rating?.count) {
    return (
      <p style={{ color: "var(--text-faint)" }}>
        No reviews yet — be the first to review this product after your order is delivered.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 28, fontWeight: 800 }}>{Number(rating.average).toFixed(1)}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          out of 5 · {rating.count} review{rating.count === 1 ? "" : "s"}
        </span>
      </div>

      {state.breakdown.length ? (
        <div style={{ display: "grid", gap: 4, marginBottom: 18, maxWidth: 260 }}>
          {state.breakdown.map((row) => (
            <div key={row.stars} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 38, color: "var(--text-muted)" }}>{row.stars} star</span>
              <span
                style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--bg-alt)", overflow: "hidden" }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: rating.count ? `${(row.count / rating.count) * 100}%` : "0%",
                    background: "var(--brand)",
                  }}
                />
              </span>
              <span style={{ width: 20, textAlign: "right", color: "var(--text-faint)" }}>{row.count}</span>
            </div>
          ))}
        </div>
      ) : null}

      {state.items.length ? (
        <div style={{ display: "grid", gap: 16 }}>
          {state.items.map((review) => (
            <div key={review.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="rating-stars" style={{ "--rating": review.productRating }} aria-hidden="true" />
                {review.title ? <strong style={{ fontSize: 14 }}>{review.title}</strong> : null}
              </div>
              {review.comment ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13.5, margin: "4px 0" }}>{review.comment}</p>
              ) : null}
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                {review.customerName || "Verified buyer"}
                {review.verifiedPurchase ? " · Verified purchase" : ""}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
