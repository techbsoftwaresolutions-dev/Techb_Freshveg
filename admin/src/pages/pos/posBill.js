// The POS (walk-in, manual) bill — its own formats, chosen in Settings ->
// Print -> POS bill. Separate from the online-order invoice templates
// (pages/orders/invoice.js), which this file does not touch.
//
// `order` is the server's POS order (or the provisional one the till builds
// while offline): items[], pricing{}, posPayments[], invoiceNo, placedAt,
// cashierName, customerSnapshot. `header` is the shop: name, address, phone,
// gstin, store.
import { INVOICE_TEMPLATES, buildInvoice, invoiceHtml, invoiceText, receiptScale, unitText } from "../orders/invoice";
import { rupees } from "../../components/ui";
import { fitSheetCss } from "../../lib/printFit";
import { amountInWords } from "../orders/invoice";

export const POS_TEMPLATES = {
  pos_manual: {
    label: "Manual Bill (A5)",
    description: "Cash-memo style: ruled item table with S.No, Qty, Rate and Amount, total in words, signature lines.",
    accent: [27, 122, 58],
    page: "A5",
  },
  pos_manual_a4: {
    label: "Manual Bill with GST (A4)",
    description: "The manual bill on a full A4 page, with a GST summary (taxable value, CGST, SGST).",
    accent: [20, 90, 43],
    page: "A4",
  },
  pos_thermal: {
    label: "Thermal Receipt (80mm)",
    description: "The narrow till receipt for 80mm thermal printers.",
    accent: [17, 17, 17],
    page: "80mm",
  },
  pos_thermal_58: {
    label: "Thermal Receipt (58mm)",
    description: "A compact till receipt for small 58mm printers.",
    accent: [80, 80, 80],
    page: "58mm",
  },
};
// 80mm Counter Bill unless another is picked in Settings -> Print -> POS bill.
export const DEFAULT_POS_TEMPLATE = "receipt";

// A placeholder name ("Customer", "Walk-in Customer") is not printed as the
// customer's name - the bill shows the name only when one was given.
const realName = (name) => {
  const n = String(name || "").trim();
  return !n || /^(walk-?in( customer)?|customer)$/i.test(n) ? "" : n;
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (p) => rupees(p, { decimals: true });
const plain = (p) => ((Number(p) || 0) / 100).toFixed(2);

function parts(order) {
  const p = order.pricing || {};
  const when = new Date(order.placedAt || Date.now());
  const date = when.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = when.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const gst = (p.taxBreakup || []).filter((b) => b.rate);
  const gstTotal = gst.reduce((sum, b) => sum + (b.tax || 0), 0);
  // How it was paid - just the method(s): "UPI", "CASH + UPI".
  const pay = [...new Set((order.posPayments || []).map((x) => String(x.method || "").toUpperCase()).filter(Boolean))].join(" + ");
  const customer = { ...(order.customerSnapshot || {}), name: realName(order.customerSnapshot?.name) };
  return { p, date, time, gst, gstTotal, pay, customer };
}


// The totals: Subtotal, Discount and Round off (when there are some), then
// TOTAL. No CGST / SGST lines - prices already include GST.
// "DUPLICATE COPY" (first reprint) / "DUPLICATE COPY 2" ...
export const dupText = (n) => (typeof n === "number" && n > 1 ? `DUPLICATE COPY ${n}` : "DUPLICATE COPY");

function totalRows(p) {
  const rows = [["Subtotal", plain(p.subtotal)]];
  if (p.offerDiscount) rows.push(["Discount", `-${plain(p.offerDiscount)}`]);
  if (p.roundOff) rows.push(["Round off", plain(p.roundOff)]);
  return rows;
}

// ---------------------------------------------------------------- manual bill

function manualBill(order, header, { provisional, a4, preview, duplicate }) {
  const { p, date, time, gst, pay, customer } = parts(order);
  const items = order.items || [];
  // Blank ruled rows under the items, so it reads like a printed bill book.
  const fill = Math.max(0, (a4 ? 16 : 9) - items.length);
  const rows = items
    .map(
      (i, n) => `<tr>
        <td class="c">${n + 1}</td>
        <td>${esc(i.name)}</td>
        <td class="c">${esc(unitText(i.variantName)) || "-"}</td>
        <td class="c">${esc(i.quantity)}</td>
        <td class="r">${plain(i.unitPrice)}</td>
        ${a4 ? `<td class="c">${i.taxRatePct ? `${i.taxRatePct}%` : "-"}</td>` : ""}
        <td class="r">${plain(i.lineTotal)}</td>
      </tr>`
    )
    .join("");
  const blanks = Array.from({ length: fill }, () => `<tr class="blank"><td></td><td></td><td></td><td></td><td></td>${a4 ? "<td></td>" : ""}<td></td></tr>`).join("");
  const gstTable =
    a4 && gst.length
      ? `<table class="gst">
          <thead><tr><th>GST rate</th><th>Taxable value</th><th>CGST</th><th>SGST</th><th>Total tax</th></tr></thead>
          <tbody>${gst
            .map((b) => {
              const half = Math.round(b.tax / 2);
              return `<tr><td class="c">${b.rate}%</td><td class="r">${plain(b.taxableValue)}</td><td class="r">${plain(half)}</td><td class="r">${plain(b.tax - half)}</td><td class="r">${plain(b.tax)}</td></tr>`;
            })
            .join("")}</tbody>
        </table>`
      : "";
  const cols = a4 ? 7 : 6;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.invoiceNo || "Bill")}</title>
<style>
/* Page margin 0 so the browser prints no date / URL header and footer; the
   margin is padding inside the page instead. */
/* Printed whole on any paper with no browser date / URL header and footer
   (see fitSheetCss); the page margin is padding inside the page instead. */
${fitSheetCss(a4 ? 210 : 148)}
@media print { body { padding: 10mm; } }
* { box-sizing: border-box; }
body { margin: 0; font: ${a4 ? 12 : 11}px/1.4 "Segoe UI", Arial, Helvetica, sans-serif; color: #1a1a1a; }
/* Designed bill: green letterhead band, info cards, striped rows, total bar. */
.bill { border: 1.5px solid #1b7a3a; border-radius: 10px; overflow: hidden; padding: 0 ${a4 ? 18 : 12}px ${a4 ? 18 : 12}px; }
.head { text-align: center; margin: 0 -${a4 ? 18 : 12}px; padding: ${a4 ? 16 : 11}px ${a4 ? 18 : 12}px ${a4 ? 14 : 10}px; color: #fff;
  background: linear-gradient(120deg, #145a2c 0%, #1b7a3a 55%, #3c9d3a 100%); position: relative; }
.head::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: repeating-linear-gradient(90deg, #f4c430 0 18px, #fff 18px 22px); opacity: .9; }
.head h1 { margin: 0; font-size: ${a4 ? 22 : 17}px; letter-spacing: 1px; color: #fff; text-transform: uppercase; }
.head p { margin: 2px 0 0; color: rgba(255,255,255,.92); }
.title { display: flex; align-items: center; gap: 10px; margin: ${a4 ? 12 : 9}px 0 ${a4 ? 10 : 8}px; }
.title::before, .title::after { content: ""; flex: 1; height: 1px; background: #b9d8c2; }
.title span { background: #1b7a3a; color: #fff; font-weight: bold; padding: 2px 14px; border-radius: 999px; letter-spacing: 1.5px; font-size: .85em; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
.meta div { background: #f1f8f3; border: 1px solid #d4e9da; border-left: 3px solid #1b7a3a; border-radius: 6px; padding: 4px 8px; }
.meta b { display: inline-block; min-width: ${a4 ? 70 : 58}px; color: #145a2c; }
table { width: 100%; border-collapse: collapse; }
.items th { background: #1b7a3a; color: #fff; font-weight: bold; padding: 5px; border: 1px solid #1b7a3a; }
.items td { border-left: 1px solid #1b7a3a; border-right: 1px solid #1b7a3a; padding: 4px 5px; vertical-align: top; }
.items tbody tr:not(.blank):nth-child(even) td { background: #f3faf5; }
.items th:first-child { border-top-left-radius: 6px; } .items th:last-child { border-top-right-radius: 6px; }
.items tbody tr:last-child td { border-bottom: 1px solid #1b7a3a; }
.items tr.blank td { height: ${a4 ? 22 : 18}px; }
.items .v { color: #555; font-size: .92em; }
.c { text-align: center; } .r { text-align: right; }
.sum { margin-top: 8px; display: grid; grid-template-columns: 1fr ${a4 ? 240 : 190}px; gap: 12px; align-items: start; }
.words { background: #f1f8f3; border: 1px solid #d4e9da; border-left: 3px solid #1b7a3a; border-radius: 6px; padding: 6px 8px; min-height: 40px; }
.words small { display: block; color: #555; }
.totals td { padding: 3px 5px; }
.totals tr.grand td { background: #1b7a3a; color: #fff; font-weight: bold; font-size: 1.1em; padding: 5px 8px; }
.totals tr.grand td:first-child { border-radius: 6px 0 0 6px; } .totals tr.grand td:last-child { border-radius: 0 6px 6px 0; }
.gst { margin-top: 10px; }
.gst th { background: #eef6f0; border: 1px solid #b9d8c2; padding: 4px; font-size: .92em; }
.gst td { border: 1px solid #d4e6d9; padding: 3px 5px; }
.foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: ${a4 ? 40 : 26}px; }
.sign { text-align: center; min-width: 150px; }
.sign div { border-top: 1px solid #333; padding-top: 3px; }
.note { text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #b9d8c2; color: #145a2c; font-size: .95em; font-weight: 600; }
.prov { text-align: center; color: #b45309; font-weight: bold; margin-top: 6px; }
.dup { text-align: center; margin: -4px 0 8px; font-weight: bold; letter-spacing: 2px; color: #b42318; border: 1.5px dashed #b42318; border-radius: 6px; padding: 3px; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="bill">
  <div class="head">
    <h1>${esc(header?.name || "Bill")}</h1>
    ${header?.legalName ? `<p>${esc(header.legalName)}</p>` : ""}
    ${header?.address ? `<p>${esc(header.address)}</p>` : ""}
    <p>${[header?.phone ? `Ph: ${esc(header.phone)}` : "", header?.email ? `Email: ${esc(header.email)}` : ""].filter(Boolean).join(" &nbsp;|&nbsp; ")}</p>
    <p>${[header?.gstin ? `GSTIN: ${esc(header.gstin)}` : "", header?.fssai ? `FSSAI: ${esc(header.fssai)}` : ""].filter(Boolean).join(" &nbsp;|&nbsp; ")}</p>
  </div>
  <div class="title"><span>${a4 ? "TAX INVOICE" : "CASH BILL"}</span></div>
  ${duplicate ? `<div class="dup">${dupText(duplicate)}</div>` : ""}
  <div class="meta">
    <div><b>Bill No:</b> ${preview ? "(given when printed)" : provisional ? "(assigned on sync)" : esc(order.invoiceNo || "-")}</div>
    <div><b>Date:</b> ${date} &nbsp;${time}</div>
    <div><b>Customer:</b> ${esc(customer.name || "")}</div>
    <div><b>Phone:</b> ${esc(customer.phone || "")}</div>
  </div>
  <table class="items">
    <thead><tr><th style="width:${a4 ? 44 : 34}px">S.No</th><th>Item</th><th style="width:${a4 ? 70 : 54}px">Unit</th><th style="width:${a4 ? 54 : 40}px">Qty</th><th style="width:${a4 ? 80 : 64}px">Rate</th>${a4 ? '<th style="width:54px">GST</th>' : ""}<th style="width:${a4 ? 92 : 72}px">Amount</th></tr></thead>
    <tbody>${rows}${blanks}</tbody>
  </table>
  <div class="sum">
    <div class="words"><small>Amount in words</small><b>${esc(amountInWords(p.total || 0))}</b>${pay ? `<small style="margin-top:6px">Paid by: ${esc(pay)}</small>` : ""}</div>
    <table class="totals">
      ${totalRows(p).map(([l, v]) => `<tr><td>${l}</td><td class="r">${v}</td></tr>`).join("")}
      <tr class="grand"><td>Total</td><td class="r">${money(p.total)}</td></tr>
    </table>
  </div>
  ${gstTable}
  <div class="foot">
    <div class="sign"><div>Customer signature</div></div>
    <div class="sign"><div>For ${esc(header?.name || "the store")}<br><small>Authorised signatory</small></div></div>
  </div>
  ${provisional ? '<div class="prov">PROVISIONAL — recorded offline</div>' : ""}
  <div class="note">${order.cashierName ? `Billed by ${esc(order.cashierName)} · ` : ""}Thank you! Visit again.</div>
</div>
</body></html>`;
}

// ---------------------------------------------------------------- thermal

function thermal(order, header, { provisional, width, preview, duplicate }) {
  const { p, date, time, gst, pay, customer } = parts(order);
  const narrow = width === 58;
  // Settings -> Print -> POS bill -> Font size.
  const scale = receiptScale(header?.posFontSize);
  const fz = (n) => `${Math.round(n * scale * 10) / 10}px`;
  // Bill details as label (left) / value (right) rows, like the counter bill.
  const kv = (l, v) => `<tr><td class="k">${l}</td><td class="v">${v}</td></tr>`;
  const rows = (order.items || [])
    .map(
      (i) => `<tr><td class="nm">${esc(i.name)}</td><td class="u">${esc(unitText(i.variantName))}</td><td class="c">${esc(i.quantity)}</td>${narrow ? "" : `<td class="r">${plain(i.unitPrice)}</td>`}<td class="r">${plain(i.lineTotal)}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.invoiceNo || "Bill")}</title>
<style>
@page { margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
/* A fixed column, as wide as the roll can print (72mm on
   80mm paper, 48mm on 58mm), at the top-left when printed. */
body { font: ${fz(narrow ? 13 : 15)}/1.25 "Courier New", monospace; font-weight: 500; width: ${narrow ? 48 : 72}mm; padding: 2mm 1.5mm; color: #000; }
@media screen { body { margin: 0 auto !important; } } /* centred in the preview only; prints at the top-left */
h1 { font-size: ${fz(narrow ? 17 : 20)}; line-height: 1.2; text-align: center; margin: 0 0 1px; }
.ttl { font-size: ${fz(narrow ? 14 : 16)}; letter-spacing: 1px; }
.c { text-align: center; } .r { text-align: right; white-space: nowrap; padding-left: 6px; }
.meta { font-size: ${fz(narrow ? 12.5 : 14)}; line-height: 1.3; }
.meta td.k { white-space: nowrap; padding-right: 8px; } .meta td.v { text-align: right; overflow-wrap: anywhere; }
.dup { font-weight: bold; font-size: ${fz(narrow ? 12.5 : 14)}; letter-spacing: 1px; margin: 1px 0; }
/* Small print: shop details, the GST sum and the closing line. */
.seller { font-size: ${fz(narrow ? 11.5 : 13)}; line-height: 1.25; }
tr.sm td { font-size: ${fz(narrow ? 12.5 : 14)}; }
.thanks { font-size: ${fz(narrow ? 13 : 15)}; font-weight: bold; }
table { width: 100%; border-collapse: collapse; table-layout: auto; } td { padding: 0; vertical-align: top; line-height: 1.2; word-break: break-word; }
.items { table-layout: auto; } /* number columns shrink to their numbers; the name gets the rest */
.items col.u, .items col.q, .items col.p, .items col.a { width: 1%; } .items td.u { white-space: nowrap; padding: 1px 4px 1px 2px; } .items td.c { white-space: nowrap; padding: 1px 2px; }
.items td { padding: 1px 0; } .items .th td { font-weight: bold; font-size: ${fz(narrow ? 11.5 : 13)}; }
/* One line per item: a long name is cut with "..." rather than wrapping. */
/* The full item name in smaller type; a very long one wraps rather than being cut. */
.items td.nm { white-space: normal; word-break: normal; overflow-wrap: break-word; padding-right: 3px; font-size: ${fz(narrow ? 12.5 : 14)}; font-weight: bold; line-height: 1.2; }
.items td:not(.nm) { font-size: ${fz(narrow ? 12 : 13)}; } .items td.r { padding-left: 5px; }
small { font-size: .88em; line-height: 1.15; }
hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
.b td { font-weight: bold; font-size: ${fz(narrow ? 15 : 18)}; padding-top: 1px; }
</style></head><body>
<h1>${esc(header?.name)}</h1>
<div class="c seller">${[
  header?.legalName ? esc(header.legalName) : "",
  // Address and phone run on together (two lines on the roll, not three).
  [esc(header?.address || ""), header?.phone ? `Ph: ${esc(header.phone)}` : ""].filter(Boolean).join(" - "),
  header?.email ? esc(header.email) : "",
  header?.gstin ? `GSTIN: ${esc(header.gstin)}` : "",
  header?.fssai ? `FSSAI: ${esc(header.fssai)}` : "",
].filter(Boolean).join("<br>")}</div>
<hr><div class="c ttl"><b>${narrow ? "BILL" : "TAX INVOICE"}</b></div>
${duplicate ? `<div class="c dup">** ${dupText(duplicate)} **</div>` : ""}
<table class="meta">${kv("Bill No", preview ? "Given when printed" : provisional ? "On sync" : esc(order.invoiceNo || "-"))}${kv("Date", `${date} ${time}`)}${order.cashierName ? kv("Cashier", esc(order.cashierName)) : ""}${customer.name ? kv("Customer", esc(customer.name)) : ""}${customer.phone ? kv("Phone", esc(customer.phone)) : ""}</table>
<hr><table class="items"><colgroup><col><col class="u"><col class="q">${narrow ? "" : '<col class="p">'}<col class="a"></colgroup>
<tr class="th"><td>ITEM</td><td class="u">UNIT</td><td class="c">QTY</td>${narrow ? "" : '<td class="r">RATE</td>'}<td class="r">AMT</td></tr>${rows}</table><hr>
<table>
${totalRows(p).map(([l, v]) => `<tr class="sm"><td>${l}</td><td class="r">${v}</td></tr>`).join("")}
<tr class="b"><td>TOTAL</td><td class="r">${money(p.total)}</td></tr>
</table><hr>
${pay ? `<table class="meta">${kv("Paid by", esc(pay))}</table><hr>` : ""}
<div class="c thanks">${provisional ? "PROVISIONAL - recorded offline<br>" : ""}Thank you! Visit again.</div>
</body></html>`;
}

// The full bill page for a template.
// preview: the bill as it will print, before it is saved (no number yet).
// duplicate: a reprint of a bill already generated - a number (which copy) or true.
export function posBillHtml(order, header, template = DEFAULT_POS_TEMPLATE, { provisional = false, preview = false, duplicate = 0 } = {}) {
  // One of the online invoice templates (Settings -> Print -> POS bill lists
  // them too): the sale printed in that layout.
  // An unknown / retired name prints as the default (80mm Counter Bill).
  if (!POS_TEMPLATES[template] && !INVOICE_TEMPLATES[template]) template = DEFAULT_POS_TEMPLATE;
  if (INVOICE_TEMPLATES[template]) return invoiceHtml(posAsInvoice(order, header, template, { provisional, preview, duplicate }));
  switch (POS_TEMPLATES[template] ? template : DEFAULT_POS_TEMPLATE) {
    case "pos_manual_a4":
      return manualBill(order, header, { provisional, preview, duplicate, a4: true });
    case "pos_thermal":
      return thermal(order, header, { provisional, preview, duplicate, width: 80 });
    case "pos_thermal_58":
      return thermal(order, header, { provisional, preview, duplicate, width: 58 });
    default:
      return manualBill(order, header, { provisional, preview, duplicate, a4: false });
  }
}

// A sample walk-in bill for the Settings preview.
export function samplePosBill() {
  const items = [
    { name: "Fresh Green Peas", variantName: "500 g", quantity: 2, unitPrice: 3500, lineTotal: 7000, taxRatePct: 0 },
    { name: "Whole Wheat Atta", variantName: "5 kg", quantity: 1, unitPrice: 27500, lineTotal: 27500, taxRatePct: 5 },
    { name: "Amul Butter", variantName: "100 g", quantity: 3, unitPrice: 5600, lineTotal: 16800, taxRatePct: 12 },
  ];
  return {
    order: {
      invoiceNo: "HB/25-26/00123",
      placedAt: new Date().toISOString(),
      cashierName: "Counter 1",
      customerSnapshot: { name: "Priya Raman", phone: "9876543210" },
      items,
      pricing: {
        subtotal: 51300,
        offerDiscount: 1300,
        taxBreakup: [
          { rate: 5, taxableValue: 26190, tax: 1310 },
          { rate: 12, taxableValue: 15000, tax: 1800 },
        ],
        roundOff: 0,
        total: 50000,
      },
      posPayments: [{ method: "cash", amount: 50000 }],
    },
    header: {
      name: "Hosur Basket",
      address: "Bagalur Road, Hosur, Tamil Nadu 635109",
      phone: "9876543210",
      gstin: "33ABCDE1234F1Z5",
    },
  };
}

// A POS sale as an online-invoice document: its payments as the method, no
// delivery, and a provisional / preview number when it has none yet.
function posAsInvoice(order, header, template, { provisional, preview, duplicate }) {
  const pays = (order.posPayments || []).map((x) => String(x.method || "").toUpperCase()).filter(Boolean);
  const inv = buildInvoice(
    {
      ...order,
      source: "pos",
      status: "DELIVERED",
      code: order.code || order.invoiceNo || "",
      customerSnapshot: { ...(order.customerSnapshot || {}), name: realName(order.customerSnapshot?.name) },
    },
    header,
    { template, statusLabel: "Paid", fontSize: header?.posFontSize }
  );
  inv.number = order.invoiceNo || (preview ? "Given when printed" : provisional ? "Provisional (on sync)" : order.code || "-");
  inv.payment = { method: pays.join(" + ") || "CASH", status: "paid", txn: "" };
  inv.duplicate = duplicate ? dupText(duplicate) : "";
  return inv;
}

// Page size of a POS bill template: "80mm" for counter bills, "A4" for a
// full invoice, or the POS template's own page.
export function posBillPage(template) {
  if (INVOICE_TEMPLATES[template]) return INVOICE_TEMPLATES[template].receipt ? "80mm" : "A4";
  return POS_TEMPLATES[template]?.page || "A5";
}

// The bill as a chat message (WhatsApp / SMS): shop, bill no, items, total.
export function posBillText(order, header) {
  return invoiceText(posAsInvoice(order, header, "receipt", {}));
}
