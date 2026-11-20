// Receipt printing on a thermal roll.
//
// The receipt is NOT given a custom page size (e.g. 80mm x 112mm): when the
// printer's driver does not list that exact size, Chrome shrinks the bill
// onto its normal paper and centres it — on an 80mm roll the right half then
// falls off the paper. Instead the page has no margins (which also drops
// Chrome's date / "about:blank" header and footer) and the bill itself is a
// fixed-width column at the top-left: 72mm for 80mm rolls (their printable
// width), 48mm for 58mm rolls. Whatever paper the printer is set to, the whole
// bill prints, starting at the top-left, and the roll stops after it.
//
// Chrome only applies print settings from a top-level window, so receipts
// print from their own small window (printReceipt), which closes itself as
// soon as printing is done or cancelled.

// The printable width of a thermal roll.
export const printableMm = (rollMm) => (rollMm <= 58 ? 48 : 72);

const receiptPageCss = "@page { margin: 0; } html, body { margin: 0 !important; height: auto !important; }";

// For a bill printed from a frame (pop-ups blocked).
export function fitPrintPage(doc) {
  if (!doc) return;
  const style = doc.createElement("style");
  style.textContent = receiptPageCss;
  doc.head.appendChild(style);
}

// Inline script for a bill in its own window: on load, sets the page, prints,
// then closes the window.
export const fitAndPrintScript = () => `<script>
window.onload = function () {
  var s = document.createElement("style");
  s.textContent = ${JSON.stringify(receiptPageCss)};
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
// printing is done or cancelled. `widthMm` set = a thermal receipt (no page
// margins, bill at the top-left); null = the page's own sheet size (A4/A5). `win` is a window
// already opened with openPrintWindow(); otherwise one is opened here.
export function printReceipt(html, widthMm, { win = null } = {}) {
  const script = widthMm
    ? fitAndPrintScript()
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
    if (widthMm) fitPrintPage(doc);
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  frame.srcdoc = html;
  return false;
}
