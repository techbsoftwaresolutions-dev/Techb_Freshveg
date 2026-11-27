import { DEFAULT_POS_TEMPLATE, posBillHtml, posBillPage, posBillText } from "./posBill";
import { whatsappUrl } from "../orders/invoice";
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
// duplicate: a reprint of a bill already generated - prints "DUPLICATE COPY".
export function printInvoice(order, header, { provisional = false, win = null, duplicate = 0 } = {}) {
  const template = header?.posTemplate || DEFAULT_POS_TEMPLATE;
  const html = posBillHtml(order, header, template, { provisional, duplicate });
  // Thermal receipts: cut to the bill's exact length (80mm / 58mm wide).
  // A5/A4 bills: that sheet. Both from their own window, which closes after
  // printing — Chrome ignores the page size of a bill printed inside the page.
  const page = posBillPage(template);
  const width = page === "58mm" ? 58 : page === "80mm" ? 80 : null;
  return printReceipt(html, width, { win });
}

// ---- Sending the bill to the customer ----

// Settings -> General -> POS -> "Send bill to customer": any of
// "whatsapp", "sms", "email" (none ticked = don't send).
export const sendMode = (header) => {
  if (Array.isArray(header?.sendBillVia)) return header.sendBillVia;
  return { off: [], sms: ["sms"], both: ["whatsapp", "sms"] }[header?.sendBill] || ["whatsapp"];
};
export const wantsWhatsApp = (via) => (via || []).includes("whatsapp");
export const customerPhone = (order) => {
  const digits = String(order?.customerSnapshot?.phone || "").replace(/\D/g, "").slice(-10);
  return /^\d{10}$/.test(digits) && digits !== "0000000000" ? digits : "";
};
export const customerEmail = (order) => {
  const e = String(order?.customerSnapshot?.email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
};

// Opens the computer's mail app with the bill typed in.
function openMail(to, subject, body) {
  const a = document.createElement("a");
  a.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  a.click();
}

// Sends a saved bill by every channel ticked in the setting. WhatsApp opens a
// chat with the message filled in (the cashier presses Send) - `waWin` is a
// tab opened straight from the click so the browser does not block it. SMS
// and email go out from the server; email falls back to the mail app while
// no email service is set up. Returns a short line saying what happened.
export async function sendBill(order, header, { waWin = null, api, mode = sendMode(header) } = {}) {
  const via = Array.isArray(mode) ? mode : sendMode({ sendBill: mode });
  if (!via.length) {
    waWin?.close();
    return "";
  }
  const phone = customerPhone(order);
  const email = customerEmail(order);
  const text = posBillText(order, header);
  const subject = `${header?.name || "Hosur Basket"} - Bill ${order.invoiceNo || ""}`.trim();
  const done = [];

  if (via.includes("whatsapp")) {
    if (phone) {
      const url = whatsappUrl(phone, text);
      if (waWin && !waWin.closed) waWin.location.href = url;
      else window.open(url, "_blank");
      done.push("WhatsApp opened");
    } else {
      waWin?.close();
      done.push("WhatsApp: no customer mobile");
    }
  } else waWin?.close();

  if (via.includes("sms")) {
    if (!phone) done.push("SMS: no customer mobile");
    else if (api) {
      try {
        const r = await api.post(`/pos/sales/${order.id}/sms`, { phone });
        done.push(r.status === "sent" ? "SMS sent" : r.status === "skipped" ? `SMS not sent (${r.reason || "not set up"})` : `SMS failed (${r.error || "error"})`);
      } catch (err) {
        done.push(`SMS failed (${err.message})`);
      }
    }
  }

  if (via.includes("email")) {
    if (!email) done.push("Email: no customer email");
    else {
      let sent = false;
      if (api) {
        try {
          const r = await api.post(`/pos/sales/${order.id}/email`, { email, text });
          sent = r.status === "sent";
        } catch {
          // fall back to the mail app below
        }
      }
      if (sent) done.push("Email sent");
      else {
        openMail(email, subject, text.replace(/\*/g, ""));
        done.push("Mail app opened");
      }
    }
  }
  return done.join(" · ");
}
