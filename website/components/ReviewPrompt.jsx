"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/client-api";
import { useAuth } from "./Providers";

// After a delivery, asks the customer to rate what they got.
//
// The list comes from GET /reviews/pending — delivered items with no review
// yet — so the server decides what is still owed. The browser only remembers
// what the customer chose to put off: closing the prompt (either way) hides the
// orders that were waiting for a day, while an order delivered after that still
// prompts straight away. The track page fires "reviews:check" the moment its
// order turns DELIVERED, so the prompt can open without a navigation.

const SNOOZE_KEY = "commerce.web.reviewSnooze";
const DAY = 24 * 60 * 60 * 1000;

function readSnooze() {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
  } catch {
    return {};
  }
}

function snooze(orderIds) {
  const now = Date.now();
  // Expired entries are dropped so the map never grows past the live ones.
  const kept = Object.fromEntries(Object.entries(readSnooze()).filter(([, until]) => until > now));
  for (const id of orderIds) kept[id] = now + DAY;
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(kept));
  } catch {
    // Storage refused (private mode): the prompt simply returns next visit.
  }
}

function Stars({ value, onChange, name }) {
  return (
    <div className="review-stars" role="radiogroup" aria-label={`Rate ${name}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={n <= value ? "on" : ""}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewPrompt() {
  const { signedIn } = useAuth();
  const pathname = usePathname();

  const [waiting, setWaiting] = useState([]); // every pending order when the prompt opened
  const [ratings, setRatings] = useState({}); // product -> { stars, comment }
  const [state, setState] = useState({ submitting: false, error: "", thanks: "" });

  const order = waiting[0] || null;

  const check = useCallback(async () => {
    if (!signedIn || order) return;
    try {
      const { pending } = await api.get("/reviews/pending");
      const now = Date.now();
      const skip = readSnooze();
      const due = (pending || [])
        .filter((p) => !(skip[p.order.id] > now))
        // A review is per product, so two sizes of one product are one row.
        .map((p) => ({ ...p, items: [...new Map(p.items.map((i) => [String(i.product), i])).values()] }));
      if (due.length) {
        setRatings({});
        setState({ submitting: false, error: "", thanks: "" });
        setWaiting(due);
      }
    } catch {
      // A prompt is never worth an error on screen.
    }
  }, [signedIn, order]);

  useEffect(() => {
    check();
  }, [check, pathname]);

  useEffect(() => {
    window.addEventListener("reviews:check", check);
    return () => window.removeEventListener("reviews:check", check);
  }, [check]);

  const close = useCallback(() => {
    snooze(waiting.map((p) => p.order.id));
    setWaiting([]);
  }, [waiting]);

  // Escape means "later"; the page behind does not scroll while it is open.
  useEffect(() => {
    if (!order) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [order, close]);

  if (!order) return null;

  const rated = order.items.filter((item) => ratings[item.product]?.stars);
  const set = (product, patch) =>
    setRatings((r) => ({ ...r, [product]: { ...r[product], ...patch } }));

  async function submit() {
    setState({ submitting: true, error: "", thanks: "" });
    const results = await Promise.allSettled(
      rated.map((item) =>
        api.post("/reviews", {
          order: order.order.id,
          product: item.product,
          variant: item.variant,
          productRating: ratings[item.product].stars,
          comment: (ratings[item.product].comment || "").trim(),
        })
      )
    );
    // 409 means this item was already reviewed (say, from another tab) — done either way.
    const failed = results.filter((r) => r.status === "rejected" && r.reason?.status !== 409);
    if (failed.length) {
      setState({ submitting: false, error: failed[0].reason?.message || "Could not save your review", thanks: "" });
      return;
    }
    const moderated = results.some((r) => r.value?.review?.status === "pending");
    setState({
      submitting: false,
      error: "",
      thanks: moderated ? "Thanks! Your review will appear once it has been checked." : "Thanks for your review!",
    });
  }

  return (
    <div className="review-prompt-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="review-prompt" role="dialog" aria-modal="true" aria-labelledby="review-prompt-title">
        <button type="button" className="review-prompt-close" aria-label="Close — remind me later" onClick={close}>
          ×
        </button>

        {state.thanks ? (
          <div className="review-prompt-thanks">
            <div className="review-prompt-check" aria-hidden="true">✓</div>
            <h2 id="review-prompt-title">{state.thanks}</h2>
            <button type="button" className="btn primary block" onClick={close} autoFocus>
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 id="review-prompt-title">How was your order?</h2>
            <p className="review-prompt-sub">
              Order {order.order.code} was delivered
              {order.order.deliveredAt
                ? ` on ${new Date(order.order.deliveredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                : ""}
              . Rate what you got — it helps other shoppers.
            </p>

            <ul className="review-prompt-items">
              {order.items.map((item) => (
                <li key={item.product}>
                  <div className="review-prompt-item">
                    <span className="order-thumb">
                      {item.image ? <img src={item.image} alt="" /> : item.name?.[0]}
                    </span>
                    <div className="review-prompt-name">
                      <strong>{item.name}</strong>
                      {item.variantName ? <span>{item.variantName}</span> : null}
                    </div>
                    <Stars
                      name={item.name}
                      value={ratings[item.product]?.stars || 0}
                      onChange={(stars) => set(item.product, { stars })}
                    />
                  </div>
                  {ratings[item.product]?.stars ? (
                    <textarea
                      rows={2}
                      maxLength={1000}
                      placeholder="What did you like or dislike? (optional)"
                      value={ratings[item.product]?.comment || ""}
                      onChange={(e) => set(item.product, { comment: e.target.value })}
                    />
                  ) : null}
                </li>
              ))}
            </ul>

            {state.error ? <p className="notice error">{state.error}</p> : null}

            <div className="review-prompt-actions">
              <button type="button" className="btn" onClick={close}>
                Do it later
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!rated.length || state.submitting}
                onClick={submit}
              >
                {state.submitting ? "Submitting…" : rated.length > 1 ? `Submit ${rated.length} reviews` : "Submit review"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
