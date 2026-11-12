import { api, ApiError } from "../../api/client";
import { rupees } from "../../components/ui";

// ---- Bill maths (mirrors backend/src/modules/pos; the server stays the authority) ----

export function computeBill(lines, discount = 0) {
  const gross = lines.reduce((s, l) => s + Math.round(l.price * l.qty), 0);
  const d = Math.min(Math.max(0, Math.round(discount)), gross);
  let left = d;
  let exact = 0;
  let tax = 0;
  lines.forEach((l, i) => {
    const lt = Math.round(l.price * l.qty);
    const share = i === lines.length - 1 ? left : Math.round((d * lt) / (gross || 1));
    left -= share;
    const net = lt - share;
    const r = l.taxRatePct || 0;
    const t = l.taxInclusive ? Math.round((net * r) / (100 + r)) : Math.round((net * r) / 100);
    tax += t;
    exact += l.taxInclusive ? net : net + t;
  });
  const total = Math.round(exact / 100) * 100;
  return { gross, discount: d, tax, total, roundOff: total - exact };
}

// ---- Offline: catalogue copy + queue of unsent bills (localStorage) ----

const CAT_KEY = "pos.catalogue";
const Q_KEY = "pos.queue";
const FAIL_KEY = "pos.failed";

const read = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
};

export const loadCatalogue = () => read(CAT_KEY, []);
export const saveCatalogue = (items) => write(CAT_KEY, items);
export const queued = () => read(Q_KEY, []);
export const failed = () => read(FAIL_KEY, []);
export const clearFailed = () => write(FAIL_KEY, []);

export function enqueue(sale) {
  write(Q_KEY, [...queued(), sale]);
}

// A thrown ApiError means the server answered (and said no); anything else is the network.
export const isOffline = (err) => !(err instanceof ApiError);

// Sends queued bills oldest-first. Stops at the first network failure; a bill the
// server rejects moves to the "failed" list so it never blocks the ones behind it.
export async function flushQueue() {
  let sent = 0;
  for (;;) {
    const [next, ...rest] = queued();
    if (!next) return sent;
    try {
      await api.post("/pos/sales", next);
      write(Q_KEY, rest);
      sent += 1;
    } catch (err) {
      if (isOffline(err)) return sent;
      write(Q_KEY, rest);
      write(FAIL_KEY, [...failed(), { sale: next, error: err.message }]);
    }
  }
}

// ---- Invoice printing ----

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (p) => rupees(p, { decimals: true });

// 80mm thermal-friendly receipt. `order` is the server order, or a provisional
// one built on the till while offline (provisional = true).
export function printInvoice(order, header, { provisional = false } = {}) {
  const w = window.open("", "_blank", "width=380,height=700");
  if (!w) return false;
  const when = new Date(order.placedAt || Date.now()).toLocaleString("en-IN");
  const rows = order.items
    .map(
      (i) => `<tr><td>${esc(i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ""}<br><small>${i.quantity} x ${money(i.unitPrice)}${i.taxRatePct ? ` &middot; GST ${i.taxRatePct}%` : ""}</small></td><td class="r">${money(i.lineTotal)}</td></tr>`
    )
    .join("");
  const p = order.pricing;
  const gst = (p.taxBreakup || [])
    .filter((b) => b.rate)
    .map((b) => {
      const half = b.tax / 2;
      return `<tr><td>${b.rate}% on ${money(b.taxableValue)}</td><td class="r">CGST ${money(half)} + SGST ${money(b.tax - half)}</td></tr>`;
    })
    .join("");
  w.document.write(`<!doctype html><title>${esc(order.invoiceNo || "Invoice")}</title>
<style>
body{font:12px/1.4 monospace;width:72mm;margin:0 auto;padding:6px}
h1{font-size:15px;text-align:center;margin:0}.c{text-align:center}.r{text-align:right}
table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
hr{border:0;border-top:1px dashed #000;margin:6px 0}.b{font-weight:bold;font-size:14px}
@media print{@page{margin:0}}
</style>
<h1>${esc(header?.name)}</h1>
<div class="c">${esc(header?.address)}<br>${header?.phone ? `Ph: ${esc(header.phone)}<br>` : ""}${header?.gstin ? `GSTIN: ${esc(header.gstin)}` : ""}</div>
<hr><div class="c"><b>TAX INVOICE</b></div>
<div>${provisional ? "Invoice no: assigned on sync" : `Invoice: ${esc(order.invoiceNo)}`}<br>Date: ${when}<br>Cashier: ${esc(order.cashierName)}${order.customerSnapshot?.phone ? `<br>Customer: ${esc(order.customerSnapshot.phone)}` : ""}</div>
<hr><table>${rows}</table><hr>
<table>
<tr><td>Subtotal</td><td class="r">${money(p.subtotal)}</td></tr>
${p.offerDiscount ? `<tr><td>Discount</td><td class="r">-${money(p.offerDiscount)}</td></tr>` : ""}
${gst}
${p.roundOff ? `<tr><td>Round off</td><td class="r">${money(p.roundOff)}</td></tr>` : ""}
<tr class="b"><td>TOTAL</td><td class="r">${money(p.total)}</td></tr>
</table><hr>
<div>${(order.posPayments || []).map((x) => `${esc(x.method.toUpperCase())}: ${money(x.amount)}`).join("<br>")}</div>
<hr><div class="c">${provisional ? "PROVISIONAL - recorded offline<br>" : ""}Thank you! Visit again.</div>
<script>window.onload=()=>{window.print()}</script>`);
  w.document.close();
  return true;
}
