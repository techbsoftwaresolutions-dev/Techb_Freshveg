"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";

const CATEGORIES = [
  ["order_issue", "Order issue"],
  ["missing_product", "Missing product"],
  ["wrong_product", "Wrong product"],
  ["damaged_product", "Damaged product"],
  ["late_delivery", "Late delivery"],
  ["payment_issue", "Payment issue"],
  ["refund", "Refund"],
  ["account_issue", "Account issue"],
  ["other", "Other"],
];

const STATUS = {
  open: ["Open", "warn"],
  in_progress: ["In progress", "info"],
  waiting_customer: ["Reply needed", "accent"],
  resolved: ["Resolved", "ok"],
  closed: ["Closed", "ok"],
};

const when = (v) =>
  v ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "";

function SupportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, signedIn } = useAuth();

  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState(params.get("category") || "order_issue");
  const [orderId, setOrderId] = useState(params.get("order") || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const [openId, setOpenId] = useState("");
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/support");
  }, [ready, signedIn, router]);

  const loadTickets = useCallback(() => {
    return api
      .get("/support/mine", { limit: 30 })
      .then((data) => setTickets(data.items || []))
      .catch(() => setTickets([]));
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    Promise.all([
      api.get("/orders/mine", { limit: 20 }).then((d) => setOrders(d.items || [])).catch(() => setOrders([])),
      loadTickets(),
    ]).finally(() => setLoading(false));
  }, [signedIn, loadTickets]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setDone("");
    if (!subject.trim()) return setError("Add a short subject so we know what this is about.");
    if (!message.trim()) return setError("Tell us what went wrong.");
    setSending(true);
    try {
      const { ticket } = await api.post("/support", {
        category,
        subject: subject.trim(),
        message: message.trim(),
        ...(orderId ? { order: orderId } : {}),
      });
      setDone(`Ticket ${ticket.code} raised. We will reply here.`);
      setSubject("");
      setMessage("");
      setOrderId("");
      await loadTickets();
      setOpenId(ticket.id);
    } catch (err) {
      setError(err.message || "Could not raise the ticket. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function sendReply(ticket) {
    if (!reply.trim()) return;
    setReplying(true);
    try {
      await api.post(`/support/${ticket.id}/messages`, { body: reply.trim() });
      setReply("");
      await loadTickets();
    } catch (err) {
      setError(err.message || "Could not send your reply.");
    } finally {
      setReplying(false);
    }
  }

  if (!ready || !signedIn) return <div className="wrap support-page" />;

  return (
    <div className="wrap support-page">
      <div className="cat-mobile-head">
        <Link href="/help" aria-label="Back" className="cat-mobile-btn">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="cat-mobile-title">Raise a ticket</h1>
      </div>

      <header className="page-title">
        <h1>Raise a ticket</h1>
        <p>Something wrong with an order? Tell us and we will sort it out.</p>
      </header>

      <form className="panel support-form" onSubmit={submit}>
        <div className="field">
          <label>What is this about?</label>
          <div className="support-chips">
            {CATEGORIES.map(([key, label]) => (
              <button type="button" key={key} className={`chip${category === key ? " on" : ""}`} onClick={() => setCategory(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="sp-order">Which order? (optional)</label>
          <select id="sp-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">Not about a specific order</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sp-subject">Subject<b className="req"> *</b></label>
          <input id="sp-subject" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Tomatoes were damaged" />
        </div>

        <div className="field">
          <label htmlFor="sp-msg">Tell us what happened<b className="req"> *</b></label>
          <textarea id="sp-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {error ? <p className="support-msg err" role="alert">{error}</p> : null}
        {done ? <p className="support-msg ok" role="status">{done}</p> : null}

        <button className="btn primary" type="submit" disabled={sending}>
          {sending ? "Sending…" : "Raise ticket"}
        </button>
      </form>

      <h2 className="support-sub">Your tickets</h2>
      {loading ? null : !tickets.length ? (
        <p className="support-empty">You have not raised any tickets yet.</p>
      ) : (
        <div className="support-list">
          {tickets.map((t) => {
            const [label, tone] = STATUS[t.status] || [t.status, ""];
            const open = openId === t.id;
            const closed = ["resolved", "closed"].includes(t.status);
            return (
              <section key={t.id} className="panel support-ticket">
                <button type="button" className="support-ticket-head" onClick={() => setOpenId(open ? "" : t.id)} aria-expanded={open}>
                  <span className="support-ticket-main">
                    <strong>{t.subject}</strong>
                    <small>{t.code}{t.orderCode ? ` · ${t.orderCode}` : ""} · {when(t.createdAt)}</small>
                  </span>
                  <span className={`support-pill ${tone}`}>{label}</span>
                </button>
                {open ? (
                  <div className="support-thread">
                    {(t.messages || []).map((m) => (
                      <div key={m.id || m._id || m.at} className={`support-bubble ${m.authorRole === "customer" ? "me" : "them"}`}>
                        <small>{m.authorRole === "customer" ? "You" : "Hosur Basket"} · {when(m.at)}</small>
                        <p>{m.body}</p>
                      </div>
                    ))}
                    {closed ? (
                      <p className="support-empty">This ticket is closed. Raise a new one if you still need help.</p>
                    ) : (
                      <div className="support-reply">
                        <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
                        <button className="btn sm primary" type="button" disabled={replying || !reply.trim()} onClick={() => sendReply(t)}>
                          {replying ? "Sending…" : "Send"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="wrap support-page" />}>
      <SupportInner />
    </Suspense>
  );
}
