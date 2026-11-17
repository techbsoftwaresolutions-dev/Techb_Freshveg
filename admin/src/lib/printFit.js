// Receipt printing at the bill's exact length.
//
// A thermal bill asks for `@page { size: 80mm auto }`, but browsers do not
// support an "auto" page height: they print on a full A4/Letter page and the
// roll feeds out blank paper. So just before printing, the bill is measured
// and the page is set to exactly its size (e.g. 80mm x 112mm).
//
// Chrome only honours a page size set by a top-level window — a bill printed
// from a frame inside the admin page comes out on A4 with the date and URL in
// the margins. So receipts print from their own small window (printReceipt),
// which closes itself as soon as printing is done or cancelled.

const PX_TO_MM = 25.4 / 96;

// Sets `doc`'s print page to `widthMm` wide and exactly as long as `el` (the
// bill; the body by default), plus the page margins.
export function fitPrintPage(doc, widthMm, marginMm = 0, el = null) {
  if (!doc) return;
  const target = el || doc.body;
  const rect = target.getBoundingClientRect();
  const heightPx = Math.ceil(el ? rect.height : rect.bottom) + 2;
  const heightMm = Math.ceil(heightPx * PX_TO_MM + marginMm * 2 + 2);
  const style = doc.createElement("style");
  style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: ${marginMm}mm; } html, body { height: auto !important; }`;
  doc.head.appendChild(style);
}

// The same, as an inline script for a bill in its own window: measures on
// load, sets the page, prints, then closes the window.
export const fitAndPrintScript = (widthMm, marginMm = 0, selector = "") => `<script>
window.onload = function () {
  var el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : "null"};
  var r = (el || document.body).getBoundingClientRect();
  var px = Math.ceil(el ? r.height : r.bottom) + 2;
  var h = Math.ceil(px * ${PX_TO_MM} + ${marginMm * 2} + 2);
  var s = document.createElement("style");
  s.textContent = "@page { size: ${widthMm}mm " + h + "mm; margin: ${marginMm}mm; } html, body { height: auto !important; }";
  document.head.appendChild(s);
  window.onafterprint = function () { window.close(); };
  setTimeout(function () { window.print(); }, 80);
};
<\/script>`;

// A print window big enough for Chrome's print dialog to show in full,
// centred over the admin. Open it straight from the click (before any
// waiting), or the browser may block it as a pop-up; fill it afterwards.
export function openPrintWindow() {
  const w = Math.min(980, window.screen.availWidth - 40);
  const h = Math.min(760, window.screen.availHeight - 60);
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  const win = window.open("", "_blank", `width=${w},height=${h},left=${left},top=${top}`);
  if (win) {
    win.document.write('<!doctype html><title>Printing…</title><body style="font:15px Arial;color:#555;display:grid;place-items:center;height:90vh">Preparing the bill…</body>');
  }
  return win;
}

// Prints a page (full HTML) from its own window and closes the window once
// printing is done or cancelled. `widthMm` set = a receipt cut to the bill's
// exact length; null = the page's own sheet size (A4/A5). `win` is a window
// already opened with openPrintWindow(); otherwise one is opened here.
export function printReceipt(html, widthMm, { marginMm = 0, selector = "", win = null } = {}) {
  const script = widthMm
    ? fitAndPrintScript(widthMm, marginMm, selector)
    : "<script>window.onafterprint=function(){window.close()};window.onload=function(){setTimeout(function(){window.print()},80)}<\/script>";
  const page = html.includes("</body>") ? html.replace("</body>", `${script}</body>`) : html + script;
  const target = win || openPrintWindow();
  if (target) {
    target.document.open();
    target.document.write(page);
    target.document.close();
    return true;
  }
  // Pop-ups blocked: print from a hidden frame (the exact size may then be
  // ignored — allow pop-ups for the admin to get exact cuts).
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:800px;height:10px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(frame);
  frame.onload = () => {
    const doc = frame.contentWindow.document;
    if (widthMm) fitPrintPage(doc, widthMm, marginMm, selector ? doc.querySelector(selector) : null);
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  frame.srcdoc = html;
  return false;
}
