import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Banner, Card, Empty, Loading, Pagination, Table, rupees, useConfirm } from "../../components/ui";
import { computeBill, printInvoice } from "./billing";

// Bills put on hold at the till, and bills already rung up — each on its own
// page (they used to be pop-ups on the POS screen).

const HELD_KEY = "pos.held";
const HEADER_KEY = "pos.header";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const money = (p) => rupees(p, { decimals: true });
const at = (v) =>
  new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Head({ title, sub }) {
  return (
    <div className="page-head">
      <div>
        <Link to="/pos" className="btn sm ghost" style={{ marginBottom: 8 }}>← POS Billing</Link>
        <h1>{title}</h1>
        {sub ? <p className="muted" style={{ margin: "4px 0 0" }}>{sub}</p> : null}
      </div>
    </div>
  );
}

export function HoldBills() {
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const [held, setHeld] = useState(() => read(HELD_KEY, []));
  const save = (list) => {
    setHeld(list);
    try { localStorage.setItem(HELD_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
  };

  const rows = held.map((h, i) => {
    const bill = computeBill(h.lines || [], Math.round((Number(h.discount) || 0) * 100));
    return { ...h, no: i + 1, items: (h.lines || []).length, qty: (h.lines || []).reduce((n, l) => n + (Number(l.qty) || 0), 0), total: bill.total };
  });

  return (
    <div className="page">
      <Head title="Hold bills" sub="Bills put on hold at the till. Resume one to carry on billing it." />
      <Card tight>
        <Table
          title="Hold bills"
          rows={rows}
          keyOf={(r) => r.id}
          columns={[
            { key: "no", label: "#", width: 50 },
            { key: "at", label: "Held at", render: (r) => at(r.at), exportValue: (r) => at(r.at) },
            { key: "customer", label: "Customer", render: (r) => r.customer?.name || r.customer?.phone || "Walk-in", exportValue: (r) => r.customer?.name || r.customer?.phone || "Walk-in" },
            { key: "itemNames", label: "Products", sortable: false, render: (r) => (r.lines || []).map((l) => l.name).filter(Boolean).slice(0, 3).join(", ") + (r.items > 3 ? ` +${r.items - 3} more` : ""), exportValue: (r) => (r.lines || []).map((l) => l.name).join(", ") },
            { key: "items", label: "Items", align: "right" },
            { key: "qty", label: "Qty", align: "right" },
            { key: "total", label: "Total", align: "right", render: (r) => <strong>{money(r.total)}</strong>, exportValue: (r) => (r.total / 100).toFixed(2) },
            {
              key: "actions",
              label: "",
              sortable: false,
              render: (r) => (
                <span style={{ display: "inline-flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn sm primary" onClick={() => navigate("/pos", { state: { resume: r.id } })}>Resume</button>
                  <button
                    className="btn sm danger"
                    onClick={async () => {
                      if (!(await confirm({ title: "Delete this hold bill?", message: `${r.items} item(s) · ${money(r.total)}`, confirmLabel: "Delete" }))) return;
                      save(held.filter((x) => x.id !== r.id));
                    }}
                  >
                    Delete
                  </button>
                </span>
              ),
            },
          ]}
          empty={<Empty title="No hold bills" hint="Press Hold Bill (F3) on the POS screen to park a bill here." />}
        />
      </Card>
      {confirmDialog}
    </div>
  );
}

export function PastBills() {
  const header = read(HEADER_KEY, null);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let live = true;
    setError("");
    api
      .get("/pos/sales", { page, limit, ...(term ? { q: term } : {}) })
      .then((res) => live && setData(res))
      .catch((e) => { if (live) { setError(e.message); setData({ items: [], meta: null }); } });
    return () => { live = false; };
  }, [page, limit, term]);

  const payLabel = (o) => {
    const list = o.payment?.splits?.length ? o.payment.splits.map((s) => s.method) : [o.payment?.method];
    return list.filter(Boolean).map((m) => String(m).toUpperCase()).join(" + ") || "—";
  };

  return (
    <div className="page">
      <Head title="Past bills" sub="Every bill rung up at the till, newest first. Reprint any of them." />
      <Banner tone="error">{error}</Banner>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <span className="search-field" style={{ maxWidth: 360 }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice no, customer phone or name, cashier…" aria-label="Search past bills" />
        </span>
      </div>
      <Card tight>
        {!data ? (
          <Loading />
        ) : (
          <>
            <Table
              title="Past bills"
              search={false}
              rows={data.items}
              keyOf={(o) => o.id}
              columns={[
                { key: "invoiceNo", label: "Invoice no", render: (o) => <span className="mono">{o.invoiceNo || o.code}</span>, exportValue: (o) => o.invoiceNo || o.code },
                { key: "placedAt", label: "Date & time", render: (o) => at(o.placedAt), exportValue: (o) => at(o.placedAt) },
                { key: "customer", label: "Customer", render: (o) => o.customerSnapshot?.name || o.customerSnapshot?.phone || "Walk-in", exportValue: (o) => o.customerSnapshot?.name || o.customerSnapshot?.phone || "Walk-in" },
                { key: "cashierName", label: "Cashier", render: (o) => o.cashierName || "—" },
                { key: "items", label: "Items", align: "right", render: (o) => (o.items || []).length, exportValue: (o) => (o.items || []).length },
                { key: "payment", label: "Payment", render: payLabel, exportValue: payLabel },
                { key: "total", label: "Total", align: "right", render: (o) => <strong>{money(o.pricing?.total)}</strong>, exportValue: (o) => ((o.pricing?.total || 0) / 100).toFixed(2) },
                {
                  key: "actions",
                  label: "",
                  sortable: false,
                  render: (o) => (
                    <button className="btn sm" onClick={(e) => { e.stopPropagation(); printInvoice(o, header); }}>
                      Reprint
                    </button>
                  ),
                },
              ]}
              empty={<Empty title={term ? `No bills match “${term}”` : "No bills yet"} />}
            />
            <Pagination meta={data.meta} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} />
          </>
        )}
      </Card>
    </div>
  );
}
