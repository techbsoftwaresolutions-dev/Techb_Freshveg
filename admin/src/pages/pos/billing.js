import { DEFAULT_POS_TEMPLATE, posBillHtml } from "./posBill";
import { printReceipt } from "../../lib/printFit";
import { api, ApiError } from "../../api/client";

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

// ---- Bill printing ----

// Prints the POS bill in the format chosen in Settings -> Print -> POS bill
// (header.posTemplate; manual A5 bill by default). `order` is the server
// order, or a provisional one built on the till while offline.
export function printInvoice(order, header, { provisional = false, win = null } = {}) {
  const template = header?.posTemplate || DEFAULT_POS_TEMPLATE;
  const html = posBillHtml(order, header, template, { provisional });
  // Thermal receipts: cut to the bill's exact length (80mm / 58mm wide).
  // A5/A4 bills: that sheet. Both from their own window, which closes after
  // printing — Chrome ignores the page size of a bill printed inside the page.
  const width = template === "pos_thermal_58" ? 58 : template === "pos_thermal" ? 80 : null;
  return printReceipt(html, width, { win });
}
