// Order invoice — one data shape, rendered from the same layout in:
//   * PDF (jsPDF, drawn on an A4 grid),
//   * HTML (used for Print, the Word download and the Settings preview),
//   * Excel (plain rows for accounting).
// The look comes from one of five templates picked in Settings -> Print, so a
// printed invoice, its PDF and its Word copy always match.
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { api } from "../../api/client";

const BRAND = "HosurBasket";
const INK = [30, 30, 30];
const GREY = [110, 110, 110];
const RED = [185, 28, 28];
const LOGO_PATH = `${import.meta.env.BASE_URL}logo-horizontal.png`;
const LOGO_RATIO = 278 / 900; // height / width of logo-horizontal.png
const CLOSED = ["CANCELLED", "REJECTED", "REFUNDED"];

// ---- Templates -------------------------------------------------------------
// Each template is its own kind of document:
//   title:   the heading printed on it ("INVOICE", "TAX INVOICE", "BILL")
//   logo:    true = brand logo; false = the store name set in type instead
//   receipt: true = narrow 80mm till bill instead of an A4 page
// and a set of A4 layout switches read by both renderers:
//   header:  split (brand left, title right) | band (coloured top band) | center
//   boxes:   filled | outline | none          (Sold by / Bill to)
//   head:    solid | tint | line              (items table header)
//   total:   band | line                      (grand total row)
export const INVOICE_TEMPLATES = {
  classic: {
    label: "Classic Invoice",
    description: "A4 invoice with the logo, green title, shaded address boxes and a solid green table.",
    title: "INVOICE", logo: true,
    accent: [22, 101, 52], font: "helvetica", header: "split", boxes: "filled", head: "solid", total: "band", stripes: true, scale: 1, logoW: 74,
  },
  modern: {
    label: "Modern Tax Invoice",
    description: "A4 tax invoice with a full-width coloured band carrying the logo, and striped rows.",
    title: "TAX INVOICE", logo: true,
    accent: [15, 118, 110], font: "helvetica", header: "band", boxes: "filled", head: "solid", total: "band", stripes: true, scale: 1, logoW: 58,
  },
  elegant: {
    label: "Elegant Invoice",
    description: "A4 letterhead style: logo centred, serif type and double rules.",
    title: "INVOICE", logo: true,
    accent: [20, 83, 45], font: "times", header: "center", boxes: "outline", head: "tint", total: "line", stripes: false, scale: 1, logoW: 72,
  },
  minimal: {
    label: "Plain Bill",
    description: "A4 bill with no logo — store name as text, black and white, saves printer ink.",
    title: "BILL", logo: false,
    accent: [24, 24, 27], font: "helvetica", header: "split", boxes: "none", head: "line", total: "line", stripes: false, scale: 1, logoW: 0,
  },
  receipt: {
    label: "Counter Bill (80mm)",
    description: "Narrow till-style bill for thermal printers. No logo, just the bill.",
    title: "BILL", logo: false, receipt: true,
    accent: [17, 17, 17], font: "courier", scale: 1, logoW: 0,
  },
};
export const DEFAULT_TEMPLATE = "classic";
// "compact" was an earlier template name; it now prints as Classic.
const themeOf = (key) => INVOICE_TEMPLATES[key] || INVOICE_TEMPLATES[DEFAULT_TEMPLATE];
const isBill = (t) => t.title === "BILL";
const docWord = (t) => (isBill(t) ? "bill" : "invoice");

const tint = (rgb, amt) => rgb.map((v) => Math.round(v + (255 - v) * amt));
const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

// Prices are integer paise. jsPDF's built-in fonts have no ₹ glyph, so every
// format uses "Rs." to stay identical.
const amount = (paise) =>
  ((Number(paise) || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (paise) => `Rs. ${amount(paise)}`;

const dateText = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "";

// ---- Amount in words (Indian numbering) ------------------------------------

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const three = (n) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
};
function indian(n) {
  if (!n) return "";
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor(n / 1e5) % 100;
  const thousand = Math.floor(n / 1000) % 100;
  return [
    crore ? `${indian(crore)} Crore` : "",
    lakh ? `${two(lakh)} Lakh` : "",
    thousand ? `${two(thousand)} Thousand` : "",
    three(n % 1000),
  ]
    .filter(Boolean)
    .join(" ");
}
export function amountInWords(paise) {
  const total = Math.round(Math.abs(Number(paise) || 0));
  const r = Math.floor(total / 100);
  const p = total % 100;
  return `Rupees ${indian(r) || "Zero"}${p ? ` and ${two(p)} Paise` : ""} Only`;
}

// ---- Data ------------------------------------------------------------------

// The store letterhead (POS header endpoint, when this user may read it) and
// the invoice template chosen in Settings -> Print. Both fall back gracefully
// so an invoice can always be produced.
export async function loadInvoiceSetup(store) {
  const [pos, pub] = await Promise.all([
    api.get("/pos/invoice-header", store ? { store } : undefined).catch(() => null),
    api.get("/settings/public").catch(() => null),
  ]);
  const company = pub?.settings?.company || {};
  const header = pos?.header?.name ? pos.header : { name: company.name || BRAND, phone: company.supportPhone || "" };
  return { header, template: pub?.settings?.print?.invoiceTemplate || DEFAULT_TEMPLATE };
}

export function buildInvoice(order, header, { packLabel = (i) => i.variantName || "", statusLabel, template } = {}) {
  const p = order.pricing || {};
  const a = order.delivery?.address || {};
  const lines = order.items.map((item, index) => ({
    no: index + 1,
    name: item.name,
    sku: item.sku || "",
    pack: packLabel(item),
    qty: item.quantity,
    rate: item.unitPrice,
    gst: item.taxRatePct || 0,
    amount: item.payable ?? item.lineTotal,
  }));

  const summary = [["Subtotal", p.subtotal]];
  if (p.catalogueSavings > 0) summary.push(["Catalogue savings", -p.catalogueSavings]);
  if (p.offerDiscount > 0) summary.push(["Offer discount", -p.offerDiscount]);
  summary.push(["Delivery charge", p.deliveryFree ? 0 : p.deliveryCharge, p.deliveryFree ? "Free" : null]);
  if (p.packagingCharge > 0) summary.push(["Packaging", p.packagingCharge]);
  for (const b of (p.taxBreakup || []).filter((x) => x.rate)) {
    const half = b.tax / 2;
    summary.push([`CGST @ ${b.rate / 2}%`, half, null, true]);
    summary.push([`SGST @ ${b.rate / 2}%`, b.tax - half, null, true]);
  }
  if (p.walletApplied > 0) summary.push(["Wallet", -p.walletApplied]);
  if (p.loyaltyApplied > 0) summary.push([`Loyalty (${p.loyaltyPointsUsed} pts)`, -p.loyaltyApplied]);
  if (p.roundOff) summary.push(["Round off", p.roundOff]);

  return {
    template: INVOICE_TEMPLATES[template] ? template : DEFAULT_TEMPLATE,
    number: order.invoiceNo || order.code,
    orderCode: order.code,
    date: dateText(order.placedAt),
    status: statusLabel || order.status,
    closed: CLOSED.includes(order.status),
    seller: {
      name: header?.name || BRAND,
      address: header?.address || "",
      phone: header?.phone || "",
      gstin: header?.gstin || "",
    },
    customer: {
      name: order.customerSnapshot?.name || "",
      phone: order.customerSnapshot?.phone || "",
      address: [a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : "", [a.city, a.pincode].filter(Boolean).join(" - ")]
        .filter(Boolean)
        .join(", "),
    },
    payment: {
      method: (order.payment?.method || "cod").toUpperCase(),
      status: order.payment?.status || "pending",
      txn: order.payment?.transactionId || "",
    },
    lines,
    // `included` marks tax rows: already inside the line prices, shown for
    // the GST record rather than added on top.
    summary: summary.map(([label, value, text, included]) => ({
      label,
      value,
      included: Boolean(included),
      text: text || (value < 0 ? `- ${rs(-value)}` : rs(value)),
    })),
    total: p.total,
    words: amountInWords(p.total),
    logoUrl: new URL(LOGO_PATH, window.location.href).href,
  };
}

// A believable order for the Settings preview.
export function sampleInvoice(template) {
  return buildInvoice(
    {
      code: "ORD-000123",
      status: "DELIVERED",
      placedAt: new Date().toISOString(),
      customerSnapshot: { name: "Priya Raman", phone: "9876543210" },
      delivery: { address: { line1: "12, Gandhi Road", line2: "Rayakottai Hudco", city: "Hosur", pincode: "635109" } },
      payment: { method: "upi", status: "paid", transactionId: "UPI2611120931" },
      items: [
        { name: "Fresh Green Peas", sku: "FRESHGREENPEAS-1", variantName: "500 g", quantity: 2, unitPrice: 3500, payable: 7000 },
        { name: "Whole Wheat Atta", sku: "ATTA-5KG", variantName: "5 kg", quantity: 1, unitPrice: 27500, payable: 27500, taxRatePct: 5 },
        { name: "Amul Butter", sku: "AMUL-100", variantName: "100 g", quantity: 3, unitPrice: 5600, payable: 16800, taxRatePct: 12 },
      ],
      pricing: {
        subtotal: 51300, catalogueSavings: 1000, deliveryCharge: 0, deliveryFree: true, roundOff: 0, total: 50300,
        taxBreakup: [{ rate: 5, taxableValue: 26190, tax: 1310 }, { rate: 12, taxableValue: 15000, tax: 1800 }],
      },
    },
    { name: BRAND, address: "Bagalur Road, Hosur, Tamil Nadu 635109", phone: "9876543210", gstin: "33ABCDE1234F1Z5" },
    { statusLabel: "Delivered", template }
  );
}

const fileBase = (inv) => `${isBill(themeOf(inv.template)) ? "Bill" : "Invoice"}-${inv.number}`.replace(/[^\w.-]+/g, "_");

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function logoDataUrl(url) {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const detailRows = (inv) => [
  [isBill(themeOf(inv.template)) ? "Bill No" : "Invoice No", inv.number],
  [isBill(themeOf(inv.template)) ? "Bill Date" : "Invoice Date", inv.date],
  ["Order No", inv.orderCode],
  ["Status", inv.status],
];

// ---- PDF -------------------------------------------------------------------

export async function invoicePdf(inv) {
  const t = themeOf(inv.template);
  if (t.receipt) return receiptPdf(inv);
  const A = t.accent;
  const TINT = tint(A, 0.92);
  const s = t.scale;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 15;
  const R = 195;
  const W = R - M; // 180mm content width
  const logo = await logoDataUrl(inv.logoUrl);
  const font = (style, size, color = INK) => doc.setFont(t.font, style).setFontSize(size * s).setTextColor(...color);
  const logoH = t.logoW * LOGO_RATIO;
  const putLogo = (x, y, w) => {
    if (logo) doc.addImage(logo, "PNG", x, y, w, w * LOGO_RATIO);
    else font("bold", 18, A).text(inv.seller.name, x, y + 8);
  };
  const sellerInfo = [inv.seller.address, inv.seller.phone ? `Phone: ${inv.seller.phone}` : "", inv.seller.gstin ? `GSTIN: ${inv.seller.gstin}` : ""].filter(Boolean);
  // No-logo templates: the store name set in type, with its details under it.
  const brandBlock = (x, y) => {
    font("bold", 20, A).text(inv.seller.name, x, y + 7);
    font("normal", 9, GREY);
    const rows = sellerInfo.flatMap((l) => doc.splitTextToSize(l, 105));
    doc.text(rows, x, y + 13, { lineHeightFactor: 1.35 });
    return 13 + rows.length * 4.4;
  };

  // Invoice no / date / order / status in four equal columns.
  const detailStrip = (y, filled) => {
    const cw = W / 4;
    if (filled) doc.setFillColor(...TINT).roundedRect(M, y, W, 15, 2, 2, "F");
    else doc.setDrawColor(...tint(A, 0.6)).setLineWidth(0.3).line(M, y, R, y).line(M, y + 15, R, y + 15);
    detailRows(inv).forEach(([label, value], i) => {
      const x = M + 4 + i * cw;
      font("bold", 7.5, GREY).text(label.toUpperCase(), x, y + 5.5);
      font("bold", 9.5, label === "Status" && inv.closed ? RED : INK).text(String(value), x, y + 11);
    });
    return y + 15;
  };

  let y;
  if (t.header === "band") {
    doc.setFillColor(...A).rect(0, 0, 210, 38, "F");
    doc.setFillColor(255, 255, 255).roundedRect(M - 3, 19 - logoH / 2 - 3, t.logoW + 6, logoH + 6, 3, 3, "F");
    putLogo(M, 19 - logoH / 2, t.logoW);
    font("bold", 26, [255, 255, 255]).text(t.title, R, 20, { align: "right" });
    font("normal", 10, tint(A, 0.8)).text(`# ${inv.number}`, R, 27, { align: "right" });
    y = detailStrip(45, true) + 8;
  } else if (t.header === "center") {
    putLogo(105 - t.logoW / 2, 9, t.logoW);
    y = 9 + logoH + 8;
    font("bold", 18, A).text(t.title, 105, y, { align: "center", charSpace: 2 });
    y += 4;
    doc.setDrawColor(...A).setLineWidth(0.5).line(M, y, R, y).setLineWidth(0.2).line(M, y + 1.2, R, y + 1.2);
    y = detailStrip(y + 5, false) + 8;
  } else {
    const brandH = t.logo ? (putLogo(M - 2, 10, t.logoW), logoH) : brandBlock(M, 10);
    font("bold", 26, A).text(t.title, R, 20, { align: "right" });
    let dy = 28 * (s < 1 ? 0.95 : 1);
    for (const [label, value] of detailRows(inv)) {
      font("normal", 9, GREY).text(label, 138, dy);
      font("bold", 9, label === "Status" && inv.closed ? RED : INK).text(String(value), R, dy, { align: "right" });
      dy += 5 * s;
    }
    y = Math.max(dy, 10 + brandH) + 3;
    doc.setDrawColor(...A).setLineWidth(t.head === "line" ? 0.4 : 0.8).line(M, y, R, y);
    y += 7 * s;
  }

  // Sold by / Bill to, equal width and height.
  const boxW = (W - 6) / 2;
  font("normal", 9);
  const sellerLines = [
    ...(inv.seller.address ? doc.splitTextToSize(inv.seller.address, boxW - 8) : []),
    inv.seller.phone ? `Phone: ${inv.seller.phone}` : "",
    inv.seller.gstin ? `GSTIN: ${inv.seller.gstin}` : "",
  ].filter(Boolean);
  const buyerLines = [
    inv.customer.phone ? `Phone: ${inv.customer.phone}` : "",
    ...(inv.customer.address ? doc.splitTextToSize(inv.customer.address, boxW - 8) : []),
  ].filter(Boolean);
  const pad = t.boxes === "none" ? 0 : 4;
  const boxH = (13 + Math.max(t.logo ? sellerLines.length : 0, buyerLines.length, 1) * 4.4) * s + pad;
  const box = (x, title, name, rows) => {
    if (t.boxes === "filled") doc.setFillColor(...TINT).setDrawColor(...tint(A, 0.8)).setLineWidth(0.2).roundedRect(x, y, boxW, boxH, 2, 2, "FD");
    if (t.boxes === "outline") doc.setDrawColor(...tint(A, 0.6)).setLineWidth(0.3).roundedRect(x, y, boxW, boxH, 2, 2, "S");
    font("bold", 8, A).text(title, x + pad, y + 2 + 4 * s);
    font("bold", 10.5).text(name || "-", x + pad, y + 2 + 9.5 * s);
    font("normal", 9, [80, 80, 80]).text(rows, x + pad, y + 2 + 14.5 * s, { lineHeightFactor: 1.35 });
  };
  // Without a logo the store details are already in the header.
  if (t.logo) box(M, "SOLD BY", inv.seller.name, sellerLines);
  box(t.logo ? M + boxW + 6 : M, "BILL TO", inv.customer.name, buyerLines);
  y += boxH + 8 * s;

  // Items table on a fixed column grid (widths add up to 180mm).
  const cols = [
    { title: "#", w: 10, align: "center" },
    { title: "Item description", w: 80, align: "left" },
    { title: "Qty", w: 16, align: "center" },
    { title: "Rate (Rs.)", w: 26, align: "right" },
    { title: "GST", w: 16, align: "center" },
    { title: "Amount (Rs.)", w: 32, align: "right" },
  ];
  let cx = M;
  for (const c of cols) {
    c.x = cx;
    cx += c.w;
  }
  const at = (c) => (c.align === "right" ? c.x + c.w - 3 : c.align === "center" ? c.x + c.w / 2 : c.x + 3);
  const headH = 9 * s;

  const tableHead = () => {
    if (t.head === "solid") {
      doc.setFillColor(...A).rect(M, y, W, headH, "F");
      font("bold", 9, [255, 255, 255]);
    } else if (t.head === "tint") {
      doc.setFillColor(...TINT).rect(M, y, W, headH, "F");
      doc.setDrawColor(...A).setLineWidth(0.4).line(M, y + headH, R, y + headH);
      font("bold", 9, A);
    } else {
      doc.setDrawColor(...A).setLineWidth(0.6).line(M, y, R, y).line(M, y + headH, R, y + headH);
      font("bold", 9, INK);
    }
    cols.forEach((c) => doc.text(c.title, at(c), y + headH * 0.66, { align: c.align }));
    y += headH;
  };
  tableHead();

  const lh = 4.3 * s;
  inv.lines.forEach((line, i) => {
    font("bold", 9.5);
    const nameLines = doc.splitTextToSize(line.name, cols[1].w - 6);
    const sub = [line.pack, line.sku].filter(Boolean).join("  |  ");
    const h = 6 * s + nameLines.length * lh + (sub ? 4 * s : 0);
    if (y + h > 262) {
      doc.addPage();
      y = 18;
      tableHead();
    }
    if (t.stripes && i % 2) doc.setFillColor(...tint(A, 0.96)).rect(M, y, W, h, "F");
    const base = y + 5.5 * s;
    font("bold", 9.5).text(nameLines, at(cols[1]), base);
    if (sub) font("normal", 8, [120, 120, 120]).text(sub, at(cols[1]), base + nameLines.length * lh);
    font("normal", 9.5);
    doc.text(String(line.no), at(cols[0]), base, { align: "center" });
    doc.text(String(line.qty), at(cols[2]), base, { align: "center" });
    doc.text(amount(line.rate), at(cols[3]), base, { align: "right" });
    doc.text(line.gst ? `${line.gst}%` : "-", at(cols[4]), base, { align: "center" });
    font("bold", 9.5).text(amount(line.amount), at(cols[5]), base, { align: "right" });
    y += h;
    doc.setDrawColor(228, 232, 230).setLineWidth(0.2).line(M, y, R, y);
  });

  // Totals (right) and amount in words + payment (left), side by side.
  const rowH = 6.5 * s;
  if (y + inv.summary.length * rowH + 24 > 272) {
    doc.addPage();
    y = 18;
  }
  y += 6 * s;
  const sx = 110;
  let sy = y;
  for (const row of inv.summary) {
    font("normal", 9.5, [90, 90, 90]).text(row.label + (row.included ? " (incl.)" : ""), sx + 3, sy + 4 * s);
    font("normal", 9.5, row.value < 0 ? [21, 128, 61] : INK).text(row.text, R - 3, sy + 4 * s, { align: "right" });
    sy += rowH;
  }
  const totH = 11 * s;
  if (t.total === "band") {
    doc.setFillColor(...A).roundedRect(sx, sy + 1, R - sx, totH, 1.5, 1.5, "F");
    font("bold", 11.5, [255, 255, 255]);
  } else {
    doc.setDrawColor(...A).setLineWidth(0.5).line(sx, sy + 1, R, sy + 1).setLineWidth(0.2).line(sx, sy + 2.2, R, sy + 2.2);
    doc.setLineWidth(0.5).line(sx, sy + 1 + totH, R, sy + 1 + totH);
    font("bold", 11.5, A);
  }
  doc.text("Grand Total", sx + 3, sy + 1 + totH * 0.66);
  doc.text(rs(inv.total), R - 3, sy + 1 + totH * 0.66, { align: "right" });

  const lw = sx - M - 8;
  font("bold", 8, A).text("AMOUNT IN WORDS", M, y + 4 * s);
  font("normal", 9.5);
  const wordLines = doc.splitTextToSize(inv.words, lw);
  doc.text(wordLines, M, y + 9 * s);
  const ly = y + 9 * s + wordLines.length * 4.4 * s + 4 * s;
  font("bold", 8, A).text("PAYMENT DETAILS", M, ly);
  const pay = [`Method: ${inv.payment.method}`, `Status: ${inv.payment.status}`, inv.payment.txn ? `Txn ID: ${inv.payment.txn}` : ""].filter(Boolean);
  font("normal", 9.5, [60, 60, 60]).text(pay, M, ly + 5 * s, { lineHeightFactor: 1.35 });

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 226, 222).setLineWidth(0.3).line(M, 279, R, 279);
    font("bold", 9.5, A).text(`Thank you for shopping with ${inv.seller.name}!`, 105, 284.5, { align: "center" });
    font("normal", 7.5, [130, 130, 130]).text(`This is a computer-generated ${docWord(t)} and does not require a signature.`, 105, 289, { align: "center" });
    doc.text(`Page ${i} of ${pages}`, R, 289, { align: "right" });
  }
  return doc;
}

export async function downloadPdf(inv) {
  (await invoicePdf(inv)).save(`${fileBase(inv)}.pdf`);
}

// ---- HTML (Print, Word, preview) --------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Table-based layout on purpose: Word's HTML import ignores flex/grid.
export function invoiceHtml(inv, { forWord = false } = {}) {
  const t = themeOf(inv.template);
  if (t.receipt) return receiptHtml(inv);
  const a = hex(t.accent);
  const tnt = hex(tint(t.accent, 0.92));
  const soft = hex(tint(t.accent, 0.6));
  const fs = (pt) => `${(pt * t.scale).toFixed(1)}pt`;
  const family = t.font === "times" ? 'Georgia, "Times New Roman", serif' : '"Segoe UI", Calibri, Arial, sans-serif';
  const logoPx = Math.round(t.logoW * 3.4);
  const sellerInfo = [esc(inv.seller.address), inv.seller.phone ? `Phone: ${esc(inv.seller.phone)}` : "", inv.seller.gstin ? `GSTIN: ${esc(inv.seller.gstin)}` : ""].filter(Boolean).join("<br>");
  const logo = !t.logo
    ? `<div class="brand">${esc(inv.seller.name)}</div><div class="muted brand-info">${sellerInfo}</div>`
    : `<img src="${esc(inv.logoUrl)}" alt="${esc(inv.seller.name)}" width="${logoPx}" style="width:${logoPx}px;height:auto;display:block${t.header === "center" ? ";margin:0 auto" : ""}">`;
  const statusCls = (k) => (k === "Status" && inv.closed ? " bad" : "");

  const strip = (filled) =>
    `<table class="strip${filled ? " filled" : ""}"><tr>${detailRows(inv)
      .map(([k, v]) => `<td><div class="k">${k.toUpperCase()}</div><div class="v${statusCls(k)}">${esc(v)}</div></td>`)
      .join("")}</tr></table>`;

  let header;
  if (t.header === "band") {
    header = `<table class="band"><tr><td><span class="logo-card">${logo}</span></td>
<td class="r"><div class="title light">${t.title}</div><div class="band-no"># ${esc(inv.number)}</div></td></tr></table>${strip(true)}`;
  } else if (t.header === "center") {
    header = `<div class="c">${logo}<div class="title center">${t.title}</div></div><hr class="double">${strip(false)}`;
  } else {
    header = `<table><tr><td style="width:55%;padding:0">${logo}</td><td style="padding:0"><div class="title">${t.title}</div>
<table class="details">${detailRows(inv)
      .map(([k, v]) => `<tr><td class="muted">${k}</td><td class="r${statusCls(k)}"><b>${esc(v)}</b></td></tr>`)
      .join("")}</table></td></tr></table><hr class="rule">`;
  }

  const items = inv.lines
    .map(
      (l, i) => `<tr class="${t.stripes && i % 2 ? "alt" : ""}">
<td class="c">${l.no}</td>
<td><b>${esc(l.name)}</b>${l.pack || l.sku ? `<br><span class="sub">${esc([l.pack, l.sku].filter(Boolean).join("  |  "))}</span>` : ""}</td>
<td class="c">${l.qty}</td><td class="r">${amount(l.rate)}</td><td class="c">${l.gst ? `${l.gst}%` : "-"}</td><td class="r"><b>${amount(l.amount)}</b></td></tr>`
    )
    .join("");
  const sums = inv.summary
    .map(
      (r) => `<tr><td class="muted">${esc(r.label)}${r.included ? " (incl.)" : ""}</td><td class="r${r.value < 0 ? " save" : ""}">${esc(r.text)}</td></tr>`
    )
    .join("");

  const headCss = {
    solid: `background:${a};color:#fff;`,
    tint: `background:${tnt};color:${a};border-bottom:1.5px solid ${a};`,
    line: `background:none;color:#1e1e1e;border-top:2px solid ${a};border-bottom:2px solid ${a};`,
  }[t.head];
  const boxCss = {
    filled: `background:${tnt};border:1px solid ${hex(tint(t.accent, 0.8))};padding:10px 12px;`,
    outline: `background:#fff;border:1px solid ${soft};padding:10px 12px;`,
    none: "padding:0;",
  }[t.boxes];
  const totalCss =
    t.total === "band"
      ? `background:${a};color:#fff;`
      : `background:none;color:${a};border-top:3px double ${a};border-bottom:1.5px solid ${a};`;

  return `<!doctype html><html${forWord ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"' : ""}>
<head><meta charset="utf-8"><title>Invoice ${esc(inv.number)}</title>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; font-family: ${family}; font-size: ${fs(10)}; color: #1e1e1e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { max-width: 780px; margin: 0 auto; padding: 24px 0; }
table { border-collapse: collapse; width: 100%; }
td, th { padding: ${Math.round(6 * t.scale)}px 8px; vertical-align: top; }
.r { text-align: right; } .c { text-align: center; }
.muted { color: #6b6b6b; } .sub { color: #7a7a7a; font-size: ${fs(8.5)}; }
.save { color: #15803d; } .bad { color: #b91c1c !important; }
.brand { color: ${a}; font-size: ${fs(22)}; font-weight: 800; }
.brand-info { font-size: ${fs(9)}; margin-top: 4px; line-height: 1.45; }
.title { color: ${a}; font-size: ${fs(28)}; font-weight: 800; letter-spacing: 2px; margin: 0 0 6px; text-align: right; }
.title.center { text-align: center; font-size: ${fs(20)}; letter-spacing: 5px; margin: 14px 0 6px; }
.title.light { color: #fff; margin: 0; }
.details { width: auto; margin-left: auto; }
.details td { padding: 2px 0 2px 24px; font-size: ${fs(9.5)}; }
.rule { border: 0; border-top: ${t.head === "line" ? 1 : 3}px solid ${a}; margin: 12px 0 16px; }
.double { border: 0; border-top: 4px double ${a}; margin: 0 0 12px; }
.band { background: ${a}; }
.band td { padding: 18px 20px; vertical-align: middle; }
.logo-card { display: inline-block; background: #fff; border-radius: 10px; padding: 8px 10px; }
.band-no { color: ${hex(tint(t.accent, 0.8))}; font-size: ${fs(10)}; margin-top: 4px; }
.strip { margin: 14px 0 18px; ${t.header === "center" ? `border-bottom: 1px solid ${soft};` : ""} }
.strip.filled { background: ${tnt}; }
.strip td { width: 25%; padding: 8px 12px; }
.strip .k { color: #6b6b6b; font-size: ${fs(7.5)}; font-weight: 700; letter-spacing: .5px; }
.strip .v { font-weight: 700; font-size: ${fs(9.5)}; margin-top: 2px; }
.party { width: 49%; ${boxCss} }
.label { color: ${a}; font-size: ${fs(8)}; font-weight: 700; letter-spacing: 1px; }
.party .name { font-size: ${fs(11.5)}; font-weight: 700; margin: 3px 0 2px; }
.items { margin-top: ${Math.round(18 * t.scale)}px; }
.items th { ${headCss} font-size: ${fs(9)}; font-weight: 700; padding: ${Math.round(8 * t.scale)}px 8px; }
.items td { border-bottom: 1px solid #e4e8e6; }
.items tr.alt td { background: ${hex(tint(t.accent, 0.96))}; }
.sum td { padding: ${Math.round(4 * t.scale)}px 8px; }
.grand td { ${totalCss} font-size: ${fs(12.5)}; font-weight: 700; padding: ${Math.round(9 * t.scale)}px 8px; }
.foot { margin-top: 36px; border-top: 1px solid #dce2de; padding-top: 10px; text-align: center; }
.foot b { color: ${a}; }
</style></head>
<body><div class="sheet">
${header}
<table><tr>
${t.logo ? `<td class="party"><div class="label">SOLD BY</div><div class="name">${esc(inv.seller.name)}</div>
<div class="muted">${sellerInfo}</div></td>
<td style="width:2%"></td>` : ""}
<td class="party"><div class="label">BILL TO</div><div class="name">${esc(inv.customer.name || "-")}</div>
<div class="muted">${[inv.customer.phone ? `Phone: ${esc(inv.customer.phone)}` : "", esc(inv.customer.address)].filter(Boolean).join("<br>")}</div></td>
</tr></table>
<table class="items">
<thead><tr><th class="c" style="width:6%">#</th><th style="text-align:left">Item description</th><th class="c" style="width:9%">Qty</th><th class="r" style="width:14%">Rate (Rs.)</th><th class="c" style="width:9%">GST</th><th class="r" style="width:17%">Amount (Rs.)</th></tr></thead>
<tbody>${items}</tbody></table>
<table style="margin-top:16px"><tr>
<td style="width:52%;padding:4px 16px 0 0">
<div class="label">AMOUNT IN WORDS</div><div style="margin:3px 0 12px">${esc(inv.words)}</div>
<div class="label">PAYMENT DETAILS</div>
<div class="muted" style="margin-top:3px">Method: ${esc(inv.payment.method)}<br>Status: ${esc(inv.payment.status)}${inv.payment.txn ? `<br>Txn ID: ${esc(inv.payment.txn)}` : ""}</div>
</td>
<td style="padding:0"><table class="sum">${sums}<tr class="grand"><td>Grand Total</td><td class="r">${rs(inv.total)}</td></tr></table></td>
</tr></table>
<div class="foot"><b>Thank you for shopping with ${esc(inv.seller.name)}!</b><br>
<span class="muted" style="font-size:8pt">This is a computer-generated ${docWord(t)} and does not require a signature.</span></div>
</div></body></html>`;
}

// Prints the invoice (not the admin screen) through a hidden frame.
export function printInvoice(inv) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  frame.onload = () => {
    const win = frame.contentWindow;
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  };
  frame.srcdoc = invoiceHtml(inv);
}

// Word opens HTML saved with the msword type as a normal editable document.
export function downloadWord(inv) {
  saveBlob(new Blob(["﻿", invoiceHtml(inv, { forWord: true })], { type: "application/msword" }), `${fileBase(inv)}.doc`);
}

// ---- Counter bill (80mm thermal) --------------------------------------------

// Drawn twice: once on a tall scratch page to measure, then on a page cut to
// exactly that length, so a thermal printer doesn't feed blank paper.
function drawReceipt(doc, inv) {
  const t = themeOf(inv.template);
  const M = 5;
  const R = 75;
  const C = 40;
  const CW = R - M;
  let y = 8;
  const f = (style, size) => doc.setFont("courier", style).setFontSize(size).setTextColor(17, 17, 17);
  const center = (text, style, size, gap) => {
    f(style, size);
    const rows = doc.splitTextToSize(text, CW);
    doc.text(rows, C, y, { align: "center" });
    y += rows.length * gap;
  };
  const dash = () => {
    y -= 1;
    doc.setLineDashPattern([0.8, 0.8], 0).setDrawColor(60).setLineWidth(0.2).line(M, y, R, y);
    doc.setLineDashPattern([], 0);
    y += 4;
  };
  const lr = (left, right, style = "normal", size = 8) => {
    f(style, size);
    doc.text(left, M, y);
    doc.text(right, R, y, { align: "right" });
    y += size * 0.47;
  };

  center(inv.seller.name.toUpperCase(), "bold", 13, 5.5);
  if (inv.seller.address) center(inv.seller.address, "normal", 8, 3.6);
  if (inv.seller.phone) center(`Ph: ${inv.seller.phone}`, "normal", 8, 3.6);
  if (inv.seller.gstin) center(`GSTIN: ${inv.seller.gstin}`, "normal", 8, 3.6);
  y += 1.5;
  dash();
  center(t.title, "bold", 11, 5.5);
  lr("Bill No", inv.number);
  lr("Date", inv.date);
  lr("Order", inv.orderCode);
  lr("Status", inv.status);
  if (inv.customer.name) lr("Customer", inv.customer.name);
  if (inv.customer.phone) lr("Phone", inv.customer.phone);
  y += 1;
  dash();
  f("bold", 8);
  doc.text("ITEM", M, y);
  doc.text("AMOUNT", R, y, { align: "right" });
  y += 3;
  dash();
  for (const l of inv.lines) {
    f("bold", 9);
    const rows = doc.splitTextToSize(`${l.name}${l.pack ? ` (${l.pack})` : ""}`, CW);
    doc.text(rows, M, y);
    y += rows.length * 3.8;
    lr(`  ${l.qty} x ${amount(l.rate)}${l.gst ? `  GST ${l.gst}%` : ""}`, amount(l.amount));
    y += 1.2;
  }
  dash();
  for (const r of inv.summary) lr(r.label + (r.included ? " (incl.)" : ""), r.text);
  y += 1;
  dash();
  y += 1;
  lr("TOTAL", rs(inv.total), "bold", 12);
  dash();
  f("normal", 7.5);
  const words = doc.splitTextToSize(inv.words, CW);
  doc.text(words, M, y);
  y += words.length * 3.4 + 1;
  lr("Paid by", `${inv.payment.method} (${inv.payment.status})`);
  y += 1;
  dash();
  center("Thank you! Visit again.", "bold", 9, 4);
  center("Computer-generated bill", "normal", 7, 3);
  return y + 4;
}

function receiptPdf(inv) {
  const scratch = new jsPDF({ unit: "mm", format: [80, 1000] });
  const height = drawReceipt(scratch, inv);
  const doc = new jsPDF({ unit: "mm", format: [80, Math.max(height, 80)] });
  drawReceipt(doc, inv);
  return doc;
}

function receiptHtml(inv) {
  const t = themeOf(inv.template);
  const row = (l, r, cls = "") => `<tr class="${cls}"><td>${l}</td><td class="r">${r}</td></tr>`;
  const items = inv.lines
    .map(
      (l) => `<tr><td colspan="2"><b>${esc(l.name)}${l.pack ? ` (${esc(l.pack)})` : ""}</b></td></tr>
${row(`&nbsp;&nbsp;${l.qty} x ${amount(l.rate)}${l.gst ? ` &nbsp;GST ${l.gst}%` : ""}`, amount(l.amount))}`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bill ${esc(inv.number)}</title>
<style>
@page { size: 80mm auto; margin: 3mm; }
body { margin: 0; background: #fff; color: #111; font: 12px/1.45 "Courier New", Courier, monospace; }
.rc { width: 72mm; margin: 0 auto; padding: 14px 0; }
@media screen { .rc { width: 340px; } }
.c { text-align: center; } .r { text-align: right; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
hr { border: 0; border-top: 1px dashed #333; margin: 6px 0; }
.shop { font-size: 17px; font-weight: bold; text-transform: uppercase; }
.title { font-size: 15px; font-weight: bold; letter-spacing: 3px; margin: 2px 0 4px; }
.tot td { font-size: 16px; font-weight: bold; padding: 3px 0; }
.small { font-size: 10px; }
</style></head><body><div class="rc">
<div class="c"><div class="shop">${esc(inv.seller.name)}</div>
<div class="small">${[esc(inv.seller.address), inv.seller.phone ? `Ph: ${esc(inv.seller.phone)}` : "", inv.seller.gstin ? `GSTIN: ${esc(inv.seller.gstin)}` : ""].filter(Boolean).join("<br>")}</div></div>
<hr><div class="c title">${t.title}</div>
<table>${row("Bill No", esc(inv.number))}${row("Date", esc(inv.date))}${row("Order", esc(inv.orderCode))}${row("Status", esc(inv.status))}
${inv.customer.name ? row("Customer", esc(inv.customer.name)) : ""}${inv.customer.phone ? row("Phone", esc(inv.customer.phone)) : ""}</table>
<hr><table>${row("<b>ITEM</b>", "<b>AMOUNT</b>")}</table><hr>
<table>${items}</table><hr>
<table>${inv.summary.map((r) => row(esc(r.label) + (r.included ? " (incl.)" : ""), esc(r.text))).join("")}</table>
<hr><table>${row("TOTAL", rs(inv.total), "tot")}</table><hr>
<div class="small">${esc(inv.words)}</div>
<table>${row("Paid by", `${esc(inv.payment.method)} (${esc(inv.payment.status)})`)}</table>
<hr><div class="c"><b>Thank you! Visit again.</b><br><span class="small">Computer-generated bill</span></div>
</div></body></html>`;
}

// ---- Excel -----------------------------------------------------------------

export function downloadExcel(inv) {
  const [[noLabel], [dateLabel]] = detailRows(inv);
  const rows = [
    [inv.seller.name, "", "", "", "", "", themeOf(inv.template).title],
    inv.seller.address ? [inv.seller.address] : null,
    inv.seller.gstin ? [`GSTIN: ${inv.seller.gstin}`] : null,
    [],
    [noLabel, inv.number, "", "", "", "Bill to", inv.customer.name],
    [dateLabel, inv.date, "", "", "", "Phone", inv.customer.phone],
    ["Order No", inv.orderCode, "", "", "", "Address", inv.customer.address],
    ["Status", inv.status, "", "", "", "Payment", `${inv.payment.method} (${inv.payment.status})`],
    [],
    ["#", "Item description", "Pack", "SKU", "Qty", "Rate (Rs.)", "GST %", "Amount (Rs.)"],
    ...inv.lines.map((l) => [l.no, l.name, l.pack, l.sku, l.qty, l.rate / 100, l.gst, l.amount / 100]),
    [],
    ...inv.summary.map((r) => ["", "", "", "", "", "", r.label + (r.included ? " (incl.)" : ""), (r.value || 0) / 100]),
    ["", "", "", "", "", "", "Grand Total", (inv.total || 0) / 100],
    [],
    ["Amount in words", inv.words],
  ].filter(Boolean);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 14 }, { wch: 36 }, { wch: 10 }, { wch: 18 }, { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 14 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, isBill(themeOf(inv.template)) ? "Bill" : "Invoice");
  XLSX.writeFile(book, `${fileBase(inv)}.xlsx`);
}

// ---- Share -----------------------------------------------------------------

export function invoiceText(inv, link) {
  return [
    `*${inv.seller.name} — ${isBill(themeOf(inv.template)) ? "Bill" : "Invoice"} ${inv.number}*`,
    `Order ${inv.orderCode} · ${inv.date}`,
    "",
    ...inv.lines.map((l) => `${l.no}. ${l.name}${l.pack ? ` (${l.pack})` : ""} × ${l.qty} — ${rs(l.amount)}`),
    "",
    ...inv.summary.filter((r) => !r.included).map((r) => `${r.label}: ${r.text}`),
    `*Grand Total: ${rs(inv.total)}*`,
    `Payment: ${inv.payment.method} (${inv.payment.status})`,
    link ? `\n${link}` : "",
  ]
    .join("\n")
    .trim();
}

// wa.me needs the number with country code and no symbols; Indian 10-digit
// numbers get 91 in front. Without a number WhatsApp lets you pick a chat.
export function whatsappUrl(phone, text) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
