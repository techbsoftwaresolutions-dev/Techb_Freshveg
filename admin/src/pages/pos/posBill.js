// The POS (walk-in, manual) bill — its own formats, chosen in Settings ->
// Print -> POS bill. Separate from the online-order invoice templates
// (pages/orders/invoice.js), which this file does not touch.
//
// `order` is the server's POS order (or the provisional one the till builds
// while offline): items[], pricing{}, posPayments[], invoiceNo, placedAt,
// cashierName, customerSnapshot. `header` is the shop: name, address, phone,
// gstin, store.
import { rupees } from "../../components/ui";
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
export const DEFAULT_POS_TEMPLATE = "pos_manual";

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
  const pay = (order.posPayments || []).map((x) => `${String(x.method || "").toUpperCase()} ${money(x.amount)}`).join(" + ");
  const customer = order.customerSnapshot || {};
  return { p, date, time, gst, gstTotal, pay, customer };
}

// ---------------------------------------------------------------- manual bill

function manualBill(order, header, { provisional, a4, preview }) {
  const { p, date, time, gst, gstTotal, pay, customer } = parts(order);
  const items = order.items || [];
  // Blank ruled rows under the items, so it reads like a printed bill book.
  const fill = Math.max(0, (a4 ? 16 : 9) - items.length);
  const rows = items
    .map(
      (i, n) => `<tr>
        <td class="c">${n + 1}</td>
        <td>${esc(i.name)}${i.variantName ? ` <span class="v">(${esc(i.variantName)})</span>` : ""}</td>
        <td class="c">${esc(i.quantity)}</td>
        <td class="r">${plain(i.unitPrice)}</td>
        ${a4 ? `<td class="c">${i.taxRatePct ? `${i.taxRatePct}%` : "-"}</td>` : ""}
        <td class="r">${plain(i.lineTotal)}</td>
      </tr>`
    )
    .join("");
  const blanks = Array.from({ length: fill }, () => `<tr class="blank"><td></td><td></td><td></td><td></td>${a4 ? "<td></td>" : ""}<td></td></tr>`).join("");
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
  const cols = a4 ? 6 : 5;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.invoiceNo || "Bill")}</title>
<style>
@page { size: ${a4 ? "A4" : "A5"}; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font: ${a4 ? 12 : 11}px/1.4 Arial, Helvetica, sans-serif; color: #111; }
.bill { border: 1.5px solid #1b7a3a; padding: ${a4 ? 18 : 12}px; }
.head { text-align: center; border-bottom: 1.5px solid #1b7a3a; padding-bottom: 8px; }
.head h1 { margin: 0; font-size: ${a4 ? 24 : 19}px; letter-spacing: .5px; color: #1b7a3a; text-transform: uppercase; }
.head p { margin: 2px 0 0; }
.title { display: flex; justify-content: center; margin: 8px 0; }
.title span { border: 1px solid #1b7a3a; color: #1b7a3a; font-weight: bold; padding: 2px 14px; border-radius: 12px; letter-spacing: 1px; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 8px; }
.meta div { border-bottom: 1px dotted #999; padding: 2px 0; }
.meta b { display: inline-block; min-width: ${a4 ? 70 : 58}px; }
table { width: 100%; border-collapse: collapse; }
.items th { background: #1b7a3a; color: #fff; font-weight: bold; padding: 5px; border: 1px solid #1b7a3a; }
.items td { border-left: 1px solid #1b7a3a; border-right: 1px solid #1b7a3a; padding: 4px 5px; vertical-align: top; }
.items tbody tr:last-child td { border-bottom: 1px solid #1b7a3a; }
.items tr.blank td { height: ${a4 ? 22 : 18}px; }
.items .v { color: #555; font-size: .92em; }
.c { text-align: center; } .r { text-align: right; }
.sum { margin-top: 8px; display: grid; grid-template-columns: 1fr ${a4 ? 240 : 190}px; gap: 12px; align-items: start; }
.words { border: 1px dashed #999; padding: 6px 8px; min-height: 40px; }
.words small { display: block; color: #555; }
.totals td { padding: 3px 5px; }
.totals tr.grand td { border-top: 1.5px solid #1b7a3a; border-bottom: 1.5px solid #1b7a3a; font-weight: bold; font-size: 1.25em; color: #1b7a3a; }
.gst { margin-top: 10px; }
.gst th { background: #eef6f0; border: 1px solid #b9d8c2; padding: 4px; font-size: .92em; }
.gst td { border: 1px solid #d4e6d9; padding: 3px 5px; }
.foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: ${a4 ? 40 : 26}px; }
.sign { text-align: center; min-width: 150px; }
.sign div { border-top: 1px solid #333; padding-top: 3px; }
.note { text-align: center; margin-top: 10px; color: #555; font-size: .92em; }
.prov { text-align: center; color: #b45309; font-weight: bold; margin-top: 6px; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="bill">
  <div class="head">
    <h1>${esc(header?.name || "Bill")}</h1>
    ${header?.address ? `<p>${esc(header.address)}</p>` : ""}
    <p>${[header?.phone ? `Ph: ${esc(header.phone)}` : "", header?.gstin ? `GSTIN: ${esc(header.gstin)}` : ""].filter(Boolean).join(" &nbsp;|&nbsp; ")}</p>
  </div>
  <div class="title"><span>${a4 ? "TAX INVOICE" : "CASH BILL"}</span></div>
  <div class="meta">
    <div><b>Bill No:</b> ${preview ? "(given when printed)" : provisional ? "(assigned on sync)" : esc(order.invoiceNo || "-")}</div>
    <div><b>Date:</b> ${date} &nbsp;${time}</div>
    <div><b>Customer:</b> ${esc(customer.name || "")}</div>
    <div><b>Phone:</b> ${esc(customer.phone || "")}</div>
  </div>
  <table class="items">
    <thead><tr><th style="width:${a4 ? 44 : 34}px">S.No</th><th>Item</th><th style="width:${a4 ? 54 : 40}px">Qty</th><th style="width:${a4 ? 80 : 64}px">Rate</th>${a4 ? '<th style="width:54px">GST</th>' : ""}<th style="width:${a4 ? 92 : 72}px">Amount</th></tr></thead>
    <tbody>${rows}${blanks}</tbody>
  </table>
  <div class="sum">
    <div class="words"><small>Amount in words</small><b>${esc(amountInWords(p.total || 0))}</b>${pay ? `<small style="margin-top:6px">Paid by: ${esc(pay)}</small>` : ""}</div>
    <table class="totals">
      <tr><td>Sub total</td><td class="r">${plain(p.subtotal)}</td></tr>
      ${p.offerDiscount ? `<tr><td>Discount</td><td class="r">-${plain(p.offerDiscount)}</td></tr>` : ""}
      ${gstTotal ? `<tr><td>GST (included)</td><td class="r">${plain(gstTotal)}</td></tr>` : ""}
      ${p.roundOff ? `<tr><td>Round off</td><td class="r">${plain(p.roundOff)}</td></tr>` : ""}
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

function thermal(order, header, { provisional, width, preview }) {
  const { p, date, time, gst, pay, customer } = parts(order);
  const narrow = width === 58;
  const rows = (order.items || [])
    .map(
      (i) => `<tr><td>${esc(i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ""}<br><small>${esc(i.quantity)} x ${plain(i.unitPrice)}${i.taxRatePct && !narrow ? ` · GST ${i.taxRatePct}%` : ""}</small></td><td class="r">${plain(i.lineTotal)}</td></tr>`
    )
    .join("");
  const gstRows = gst
    .map((b) => {
      const half = Math.round(b.tax / 2);
      return narrow
        ? `<tr><td>GST ${b.rate}%</td><td class="r">${plain(b.tax)}</td></tr>`
        : `<tr><td>${b.rate}% on ${plain(b.taxableValue)}</td><td class="r">C ${plain(half)} + S ${plain(b.tax - half)}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.invoiceNo || "Bill")}</title>
<style>
@page { size: ${width}mm auto; margin: 0; }
body { font: ${narrow ? 10.5 : 12}px/1.4 monospace; width: ${width - 6}mm; margin: 0 auto; padding: 6px 2px; color: #000; }
h1 { font-size: ${narrow ? 13 : 15}px; text-align: center; margin: 0; }
.c { text-align: center; } .r { text-align: right; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; } td { padding: 2px 0; vertical-align: top; }
hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
.b td { font-weight: bold; font-size: ${narrow ? 12 : 14}px; }
</style></head><body>
<h1>${esc(header?.name)}</h1>
<div class="c">${esc(header?.address || "")}${header?.phone ? `<br>Ph: ${esc(header.phone)}` : ""}${header?.gstin ? `<br>GSTIN: ${esc(header.gstin)}` : ""}</div>
<hr><div class="c"><b>${narrow ? "BILL" : "TAX INVOICE"}</b></div>
<div>${preview ? "Bill no: given when printed" : provisional ? "Bill no: on sync" : `Bill: ${esc(order.invoiceNo || "-")}`}<br>${date} ${time}${order.cashierName ? `<br>Cashier: ${esc(order.cashierName)}` : ""}${customer.phone ? `<br>Customer: ${esc(customer.phone)}` : ""}</div>
<hr><table>${rows}</table><hr>
<table>
<tr><td>Subtotal</td><td class="r">${plain(p.subtotal)}</td></tr>
${p.offerDiscount ? `<tr><td>Discount</td><td class="r">-${plain(p.offerDiscount)}</td></tr>` : ""}
${gstRows}
${p.roundOff ? `<tr><td>Round off</td><td class="r">${plain(p.roundOff)}</td></tr>` : ""}
<tr class="b"><td>TOTAL</td><td class="r">${money(p.total)}</td></tr>
</table><hr>
${pay ? `<div>${esc(pay)}</div><hr>` : ""}
<div class="c">${provisional ? "PROVISIONAL - recorded offline<br>" : ""}Thank you! Visit again.</div>
</body></html>`;
}

// The full bill page for a template.
// preview: the bill as it will print, before it is saved (no number yet).
export function posBillHtml(order, header, template = DEFAULT_POS_TEMPLATE, { provisional = false, preview = false } = {}) {
  switch (POS_TEMPLATES[template] ? template : DEFAULT_POS_TEMPLATE) {
    case "pos_manual_a4":
      return manualBill(order, header, { provisional, preview, a4: true });
    case "pos_thermal":
      return thermal(order, header, { provisional, preview, width: 80 });
    case "pos_thermal_58":
      return thermal(order, header, { provisional, preview, width: 58 });
    default:
      return manualBill(order, header, { provisional, preview, a4: false });
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
