"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { when } from "@/lib/format";

const STATUS = {
  open: "Open",
  in_progress: "In progress",
  waiting_customer: "Reply needed",
  resolved: "Resolved",
  closed: "Closed",
};

// Support requests on the Help page: the customer's tickets, a form to raise
// one (tied to an order when opened from it — ?order=&code=), and each
// conversation with a reply box. Same endpoints as the app.
export default function SupportDesk() {
  const params = useSearchParams();
  const order = params.get("order") ? { id: params.get("order"), code: params.get("code") || "" } : null;
  const { ready, signedIn } = useAuth();

  const [tickets, setTickets] = useState(null);
  const [categories, setCategories] = useState([]);
  const [composing, setComposing] = useState(Boolean(order));
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ category: "", subject: "", message: "" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/support/mine", { limit: 50 });
      setTickets(data.items);
    } catch (err) {
      setError(err.message);
      setTickets((t) => t || []);
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    load();
    api.get("/support/categories").then((d) => setCategories(d.categories)).catch(() => {});
  }, [signedIn, load]);

  async function raise(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { ticket } = await api.post("/support", { ...form, order: order?.id });
      setForm({ category: "", subject: "", message: "" });
      setComposing(false);
      await load();
      setOpenId(ticket.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { ticket } = await api.post(`/support/${openId}/messages`, { body: reply.trim() });
      setTickets((list) => list.map((t) => (t.id === ticket.id ? ticket : t)));
      setReply("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (!signedIn) {
    return (
      <section className="panel help-card">
        <h2>Your support requests</h2>
        <p>Sign in to raise a request about an order and follow our replies.</p>
        <Link href="/login?next=/help" className="btn sm">
          Sign in
        </Link>
      </section>
    );
  }

  const open = tickets?.find((t) => t.id === openId);

  return (
    <section className="panel support-desk">
      <div className="panel-head">
        <h2>Your support requests</h2>
        {!composing ? (
          <button className="btn sm primary" onClick={() => setComposing(true)}>
            + New request
          </button>
        ) : null}
      </div>

      {error ? <p className="notice error">{error}</p> : null}

      {composing ? (
        <form onSubmit={raise} className="support-form">
          {order ? <p className="notice save">About order {order.code}</p> : null}
          <div className="field">
            <label htmlFor="sd-category">What is it about?</label>
            <select id="sd-category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} required>
              <option value="">Choose a topic</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sd-subject">Subject</label>
            <input id="sd-subject" type="text" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required />
          </div>
          <div className="field">
            <label htmlFor="sd-message">Tell us what happened</label>
            <textarea id="sd-message" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} required />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn primary" disabled={busy || !form.category || !form.subject.trim() || !form.message.trim()}>
              {busy ? "Sending…" : "Send request"}
            </button>
            <button type="button" className="btn" onClick={() => setComposing(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : tickets === null ? (
        <p className="muted-line">Loading…</p>
      ) : !tickets.length ? (
        <p className="muted-line">You haven&apos;t raised any requests.</p>
      ) : (
        <div className="list-rows">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              className={`list-row support-row${ticket.id === openId ? " on" : ""}`}
              onClick={() => setOpenId(ticket.id === openId ? null : ticket.id)}
              aria-expanded={ticket.id === openId}
            >
              <span className="list-row-main">
                <strong>{ticket.subject}</strong>
                <span>
                  {ticket.code}
                  {ticket.orderCode ? ` · ${ticket.orderCode}` : ""} · {when(ticket.createdAt)}
                </span>
              </span>
              <span className={`pill${ticket.status === "waiting_customer" ? " accent" : ""}`}>{STATUS[ticket.status] || ticket.status}</span>
            </button>
          ))}
        </div>
      )}

      {open && !composing ? (
        <div className="support-thread">
          {open.messages.map((m, i) => (
            <div key={m._id || i} className={`support-msg${m.authorRole === "customer" ? " mine" : ""}`}>
              <span className="support-msg-who">{m.authorRole === "customer" ? "You" : m.authorName || "Support"}</span>
              <p>{m.body}</p>
              <span className="support-msg-when">{when(m.at)}</span>
            </div>
          ))}
          {["resolved", "closed"].includes(open.status) ? (
            <p className="muted-line">This request is {STATUS[open.status].toLowerCase()}. Raise a new one if you still need help.</p>
          ) : (
            <form onSubmit={send} className="support-reply">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply" aria-label="Reply" />
              <button className="btn primary" disabled={busy || !reply.trim()}>
                {busy ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </section>
  );
}
