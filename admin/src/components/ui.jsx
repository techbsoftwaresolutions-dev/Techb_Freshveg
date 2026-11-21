import DatePicker from "./DatePicker";
import { createContext, isValidElement, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
// xlsx-js-style: the same API as xlsx, but it writes cell styles (centring,
// fills, borders) that the free xlsx build silently drops.
import * as XLSX from "xlsx-js-style";
import Sparkline from "./Sparkline";
import { IconDownload } from "./Icons";
import { toast } from "./toast";
import { saveFile as downloadBlob, stampedName } from "../lib/saveFile";

// Small shared primitives. Deliberately plain — the interesting code in this
// app is the schema-driven form, not a component library.

export function Card({ title, actions, children, tight, className = "", style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <header className="card-head">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {actions && <div className="inline">{actions}</div>}
        </header>
      )}
      <div className={`card-body${tight ? " tight" : ""}`}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, foot, tone, icon: Icon, hue, trend, spark, to }) {
  const hasTrend = typeof trend === "number" && Number.isFinite(trend);
  const trendUp = hasTrend && trend >= 0;
  // Whole card is clickable when a destination is given, rather than only
  // the small caption underneath — the caption still renders (as plain
  // text, not its own link, so it doesn't nest an <a> inside this one).
  const Wrapper = to ? Link : "div";
  const className = `card stat-v2${to ? " stat-card" : ""}${hue ? ` hue-${hue}` : ""}${Icon ? "" : " stat-plain"}`;
  return (
    <Wrapper {...(to ? { to } : {})} className={className}>
      {Icon || hasTrend ? (
      <div className="stat2-top">
        {Icon ? (
          <span className="stat2-icon">
            <Icon />
          </span>
        ) : (
          <span />
        )}
        {hasTrend ? (
          <span className={`stat2-pill ${trendUp ? "up" : "down"}`} title="Compared with the previous 7 days">
            {trendUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        ) : null}
      </div>
      ) : null}

      <div className="stat2-label">{label}</div>
      <div className="stat2-value" style={tone ? { color: `var(--${tone})` } : undefined}>
        {value}
      </div>

      {foot || (spark && spark.length > 1) ? (
        <div className="stat2-foot">
          <span>{foot}</span>
          {spark && spark.length > 1 ? (
            <Sparkline points={spark} tone={trendUp ? "ok" : "danger"} width={64} height={24} />
          ) : null}
        </div>
      ) : null}
    </Wrapper>
  );
}

// An on/off switch with its state spelled out beside it. Clicks don't reach
// a surrounding clickable row — flipping a switch in a table should not also
// open the record.
export function Switch({ checked, onChange, onLabel, offLabel, disabled, tone = "ok", offTone = "", title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch ${checked ? `on ${tone}` : `off ${offTone}`}`}
      disabled={disabled}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-label">{checked ? onLabel : offLabel}</span>
    </button>
  );
}

export function Pill({ tone, children }) {
  return <span className={`pill${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function Loading({ label = "Loading" }) {
  return (
    <div className="loading">
      <span className="spinner" /> {label}…
    </div>
  );
}

export function Empty({ title, hint, action, icon: Icon }) {
  return (
    <div className="empty">
      {Icon ? (
        <div className="empty-icon">
          <Icon />
        </div>
      ) : null}
      <div style={{ fontWeight: 600, color: "var(--text)" }}>{title}</div>
      {hint && <p style={{ margin: "6px 0 0", fontSize: 13 }}>{hint}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

// Plain text of a React node, for turning a banner's content into a toast.
const noticeText = (n) => (n == null || n === false ? "" : Array.isArray(n) ? n.map(noticeText).join("") : typeof n === "object" ? noticeText(n.props?.children) : String(n));

// Success ("ok") banners are shown as toasts, so a saved/deleted message does not push the page down.
export function Banner({ tone = "info", children }) {
  const text = tone === "ok" ? noticeText(children).trim() : "";
  useEffect(() => { if (text) toast(text); }, [text]);
  if (!children || tone === "ok") return null;
  return <div className={`banner ${tone}`}>{children}</div>;
}

// Add and edit forms open as their own pages, not pop-ups — each with its own
// URL, the whole screen to work in, and the browser's back button to leave.
// The forms were all written as <Modal>s, so rather than rewrite each one,
// a form rendered inside <AsPage> finds this context and <Modal> draws itself
// as a page instead: same fields, same save logic, different frame.
//
// A page resets the context for its own children, so a small confirmation a
// form page opens (reject a review, adjust a balance) is still a dialog.
const PageModeContext = createContext(null);

// `error` is a save failure the page itself owns (forms that used to report
// errors through the list behind them); it shows under the page title.
export function AsPage({ backLabel = "Back", error = "", children }) {
  return <PageModeContext.Provider value={{ backLabel, error }}>{children}</PageModeContext.Provider>;
}

export function Modal(props) {
  const page = useContext(PageModeContext);
  return page ? (
    <ModalAsPage {...props} backLabel={page.backLabel} pageError={page.error} />
  ) : (
    <ModalDialog {...props} />
  );
}

function ModalAsPage({ title, onClose, children, footer, backLabel, pageError }) {
  return (
    <PageModeContext.Provider value={null}>
      <div className="page form-page">
        <div className="form-page-head">
          <button type="button" className="btn ghost sm form-page-back" onClick={onClose}>
            ← {backLabel}
          </button>
          <h1>{title}</h1>
        </div>
        <Banner tone="error">{pageError}</Banner>
        <section className="card form-page-card">
          <div className="card-body">{children}</div>
        </section>
        {footer && <div className="form-page-foot">{footer}</div>}
      </div>
    </PageModeContext.Provider>
  );
}

function ModalDialog({ title, onClose, children, footer, wide }) {
  // Escape closes, and the body does not scroll behind the dialog.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

// A proper popup for "are you sure?" questions, in place of the browser's
// window.confirm box. Use it as:
//   const [confirm, confirmDialog] = useConfirm();
//   if (!(await confirm({ title, message, confirmLabel }))) return;
//   ...and render {confirmDialog} somewhere in the page.
export function ConfirmDialog({ title, message, confirmLabel = "Delete", cancelLabel = "Cancel", tone = "danger", onAnswer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onAnswer(false);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onAnswer]);

  return (
    <div className="confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onAnswer(false)}>
      <div className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        {tone === "danger" ? (
          <span className="confirm-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </span>
        ) : null}
        <h2 id="confirm-title">{title}</h2>
        {message ? <p className="confirm-message">{message}</p> : null}
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={() => onAnswer(false)} autoFocus>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${tone === "danger" ? "confirm-danger" : "primary"}`} onClick={() => onAnswer(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [asking, setAsking] = useState(null);
  const resolver = useRef(null);

  const confirm = (options) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setAsking(options);
    });

  const answer = (value) => {
    setAsking(null);
    resolver.current?.(value);
    resolver.current = null;
  };

  const dialog = asking ? <ConfirmDialog {...asking} onAnswer={answer} /> : null;
  return [confirm, dialog];
}

export function Field({ label, help, error, children, inherited, required }) {
  return (
    <div className="field">
      {label && (
        <label>
          {label}
          {required && <span className="req" aria-hidden="true"> *</span>}
          {inherited && <span className="inherited"> · from {inherited}</span>}
        </label>
      )}
      {children}
      {help && !error && <span className="help">{help}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

// Pulls the plain text out of whatever a column's render() produced — a
// string, a number, or a tree of elements (a Pill, a stacked name+phone) —
// so sorting and exporting have something to compare and print even for a
// column that renders markup instead of a bare value.
function textOf(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join(" ");
  if (isValidElement(node)) return textOf(node.props?.children);
  return "";
}

// What a column sorts and exports by: the row's own field when the column
// reads straight off it (the common case — "totalSpend", "lastOrderAt" — so
// numbers and ISO dates sort correctly, not as display strings), falling
// back to whatever render() displays for a column that's computed rather
// than stored.
function valueOf(row, col) {
  const raw = row[col.key];
  if (raw !== undefined && raw !== null) return raw;
  return col.render ? textOf(col.render(row)) : "";
}

function compareValues(a, b) {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

// CSV and Word both download straight away. PDF has no reliable dependency-
// free way to generate a file client-side, so it opens a print-formatted
// window instead and lets the browser's own "Save as PDF" do the encoding —
// the standard zero-dependency way to offer a PDF export from the browser.
// One look for every download (XLSX, PDF, Word): the table starts with a
// green header row, every cell centred with thin borders,
// light banding, and Status coloured (Active green, Low Stock yellow,
// Inactive red). CSV is plain text — it carries the same columns and values.
const EXPORT_STYLE = {
  brand: "1B7A3A",
  brandDark: "145A2B",
  border: "D9DED9",
  band: "F5F8F5",
  tones: {
    active: { fill: "DCFCE7", text: "166534" },
    "low stock": { fill: "FEF08A", text: "854D0E" },
    inactive: { fill: "FEE2E2", text: "991B1B" },
    "out of stock": { fill: "FEE2E2", text: "991B1B" },
  },
};
const toneOf = (header, value) =>
  String(header).toLowerCase() === "status" ? EXPORT_STYLE.tones[String(value ?? "").trim().toLowerCase()] || null : null;

// A value Excel may treat as a number: up to 9 digits (with an optional
// decimal part), no leading zero. Anything longer is a code, not an amount.
const isPlainNumber = (v) =>
  typeof v === "number" || (typeof v === "string" && /^-?(0|[1-9]\d{0,8})(\.\d+)?$/.test(v.trim()));

function exportRows(columns, rows, format, title) {
  const cols = columns.filter((c) => c.exportable !== false);
  // Every download starts with a serial number column (1, 2, 3…).
  const headers = ["S.No", ...cols.map((c) => c.label)];
  const lines = rows.map((row, index) => [
    index + 1,
    ...cols.map((c) => {
      if (typeof c.exportValue === "function") return c.exportValue(row);
      return textOf(c.render ? c.render(row) : row[c.key]);
    }),
  ]);
  // Picture cells for Word and PDF (e.g. a QR code): a column's exportImage
  // gives an image URL; CSV and Excel keep the text value instead.
  const images = rows.map((row) => [
    null,
    ...cols.map((c) => (typeof c.exportImage === "function" ? c.exportImage(row) || null : null)),
  ]);
  const name = title || "Export";
  const base = stampedName(name);

  if (format === "csv") {
    const esc = (v) => {
      const str = String(v ?? "");
      // A long digit string (barcode) is written as ="…" so Excel keeps it as
      // text instead of 8.9E+12.
      if (/^\d{10,}$/.test(str) || /^0\d+$/.test(str)) return `="${str}"`;
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csv = [headers, ...lines].map((row) => row.map(esc).join(",")).join("\r\n");
    // UTF-8 BOM so Excel shows ₹ correctly instead of â‚¹.
    downloadBlob("﻿" + csv, `${base}.csv`, "text/csv;charset=utf-8;");
    return;
  }

  if (format === "xlsx") {
    const S = EXPORT_STYLE;
    const line = (rgb) => ({ style: "thin", color: { rgb } });
    const box = (rgb) => ({ top: line(rgb), bottom: line(rgb), left: line(rgb), right: line(rgb) });
    const center = { horizontal: "center", vertical: "center", wrapText: true };
    // Plain numbers go in as numbers so Excel can sum and sort them.
    // Plain numbers (stock, counts) go in as numbers so Excel can sum and sort
    // them; long digit strings — barcodes, codes — stay text, or Excel shows
    // 8901234567890 as 8.9E+12 and drops leading zeros.
    const value = (v) => (isPlainNumber(v) ? Number(v) : v ?? "");

    // The table starts on row 1 with the header — no title lines above it.
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...lines.map((row) => row.map(value))]);
    const put = (r, c, style) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!sheet[ref]) sheet[ref] = { t: "s", v: "" };
      sheet[ref].s = style;
    };
    headers.forEach((_, c) =>
      put(0, c, {
        fill: { patternType: "solid", fgColor: { rgb: S.brand } },
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        alignment: center,
        border: box(S.brandDark),
      })
    );
    lines.forEach((row, i) =>
      row.forEach((cell, c) => {
        const tone = toneOf(headers[c], cell);
        put(1 + i, c, {
          fill: { patternType: "solid", fgColor: { rgb: tone ? tone.fill : i % 2 ? S.band : "FFFFFF" } },
          font: { sz: 11, bold: Boolean(tone), color: { rgb: tone ? tone.text : "1F2937" } },
          alignment: center,
          border: box(S.border),
        });
      })
    );
    sheet["!cols"] = headers.map((h, i) => ({
      wch: Math.min(48, Math.max(8, String(h).length, ...lines.map((row) => String(row[i] ?? "").length)) + 4),
    }));
    sheet["!rows"] = [{ hpt: 24 }, ...lines.map(() => ({ hpt: 20 }))];
    // Header stays in view while scrolling down the sheet.
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, String(name).replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    const bytes = XLSX.write(book, { bookType: "xlsx", type: "array", cellStyles: true });
    downloadBlob(
      new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${base}.xlsx`
    );
    return;
  }

  // Word and PDF: the same table as HTML, styled to match the Excel file.
  const S = EXPORT_STYLE;
  const cellBase = `padding:7px 10px;border:1px solid #${S.border};text-align:center;vertical-align:middle;`;
  const tableHtml = `
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;">
      <thead><tr>${headers
        .map(
          (h) =>
            `<th style="background:#${S.brand};color:#ffffff;font-weight:bold;padding:9px 10px;border:1px solid #${S.brandDark};text-align:center;vertical-align:middle;">${escapeHtml(h)}</th>`
        )
        .join("")}</tr></thead>
      <tbody>${lines
        .map(
          (row, rowIdx) =>
            `<tr>${row
              .map((cell, colIdx) => {
                const tone = toneOf(headers[colIdx], cell);
                const bg = tone ? `#${tone.fill}` : rowIdx % 2 ? `#${S.band}` : "#ffffff";
                const style = `${cellBase}background:${bg};color:${tone ? `#${tone.text}` : "#1f2937"};${tone ? "font-weight:bold;" : ""}`;
                const picture = images[rowIdx]?.[colIdx];
                if (picture) {
                  return `<td style="${style}"><img src="${escapeHtml(picture)}" width="64" height="64" alt="" style="display:block;margin:0 auto 2px;" /><div style="font-size:10px;color:#555555;">${escapeHtml(cell)}</div></td>`;
                }
                return `<td style="${style}">${escapeHtml(cell)}</td>`;
              })
              .join("")}</tr>`
        )
        .join("")}</tbody>
    </table>`;

  if (format === "word") {
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${escapeHtml(name)}</title></head>
      <body>${tableHtml}</body></html>`;
    downloadBlob("﻿" + doc, `${base}.doc`);
    return;
  }

  if (format === "pdf") {
    const page = `<html><head><meta charset="utf-8"><title>${escapeHtml(base)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        @media print {
          @page { margin: 0; } /* no browser date / URL header and footer */
          body { padding: 12mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
      </style></head>
      <body>${tableHtml}</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(page);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
      return;
    }
    // Pop-up blocked: print from a hidden frame instead.
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    frame.contentWindow.document.open();
    frame.contentWindow.document.write(page);
    frame.contentWindow.document.close();
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 3000);
    }, 500);
  }
}

const EXPORT_FORMATS = [
  { format: "csv", label: "CSV" },
  { format: "xlsx", label: "XLSX" },
  { format: "pdf", label: "PDF" },
  { format: "word", label: "Word" },
];

// One download icon, sat at the right end of the header row; the three
// formats live in a popover. The popover is position:fixed (placed from the
// button's rect) so the table's horizontal-scroll wrapper can't clip it.
function ExportMenu({ columns, rows, title }) {
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setPos(null);
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    rootRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      setPos(null);
      rootRef.current?.querySelector("button")?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = [...rootRef.current.querySelectorAll('[role="menuitem"]')];
      const next = items.indexOf(document.activeElement) + (event.key === "ArrowDown" ? 1 : -1);
      items[(next + items.length) % items.length]?.focus();
    }
  };

  const toggle = (event) => {
    event.stopPropagation(); // the header cell may be a sort target
    if (open) return setPos(null);
    const r = event.currentTarget.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  return (
    <div className="menu-part" ref={rootRef} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn ghost icon-btn"
        title="Export"
        aria-label="Export"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <IconDownload width="16" height="16" />
      </button>
      {open ? (
        <div className="export-menu-pop" role="menu" style={pos}>
          {EXPORT_FORMATS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className="export-menu-item"
              onClick={() => {
                setPos(null);
                exportRows(columns, rows, format, title);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// The table's column picker: a checkbox per column, to show only the ones
// wanted. The choice is remembered per table (by its title) in this browser,
// and downloads export exactly the columns on show.
function ColumnsMenu({ columns, hidden, onChange }) {
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const open = pos !== null;
  const pickable = columns.filter((c) => c.label);
  const shownCount = pickable.filter((c) => !hidden.includes(c.key)).length;

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setPos(null);
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close();
    };
    const onKey = (event) => event.key === "Escape" && close();
    // Scrolling the column list itself must not close it — only the page or
    // the table moving under it does (the list is pinned to the button).
    const onScroll = (event) => {
      if (rootRef.current && event.target instanceof Node && rootRef.current.contains(event.target)) return;
      // The page or table scrolled: keep the list open and pinned under its
      // button; close only once the button has scrolled out of sight.
      const button = rootRef.current?.querySelector("button");
      if (!button) return close();
      const r = button.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return close();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleOpen = (event) => {
    event.stopPropagation();
    if (open) return setPos(null);
    const r = event.currentTarget.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };
  const flip = (key) => {
    const on = !hidden.includes(key);
    if (on && shownCount <= 1) return; // keep at least one column
    onChange(on ? [...hidden, key] : hidden.filter((k) => k !== key));
  };

  return (
    <div className="menu-part" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`btn ghost icon-btn${hidden.length ? " has-hidden" : ""}`}
        title={hidden.length ? `Columns (${hidden.length} hidden)` : "Choose columns"}
        aria-label="Choose columns"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="2" fill="currentColor" />
          <circle cx="15" cy="12" r="2" fill="currentColor" />
          <circle cx="7" cy="18" r="2" fill="currentColor" />
        </svg>
        {hidden.length ? <span className="cols-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="export-menu-pop cols-pop" style={pos}>
          <div className="cols-head">
            <strong>Columns</strong>
            {hidden.length ? (
              <button type="button" className="cols-reset" onClick={() => onChange([])}>
                Show all
              </button>
            ) : null}
          </div>
          {pickable.map((col) => {
            const on = !hidden.includes(col.key);
            return (
              <label key={col.key} className={`cols-item${on ? " on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => flip(col.key)} disabled={on && shownCount <= 1} />
                <span>{col.label}</span>
              </label>
            );
          })}
          <p className="cols-note">Downloads include only the ticked columns.</p>
        </div>
      ) : null}
    </div>
  );
}

// Which columns a table hides, remembered per table title in this browser.
function useHiddenColumns(title) {
  const key = `table-cols:${title || "table"}`;
  const [hidden, setHidden] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const update = (next) => {
    setHidden(next);
    try {
      if (next.length) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch {
      // storage blocked: the choice lasts until the page is left
    }
  };
  return [hidden, update];
}

// `title` names the export (filename + heading) — any page can pass one,
// but every page works without it (falls back to "export"), so adding
// sorting and download buttons here reaches every list in the app without
// having to touch each page's own columns.
// `onReorder(fromIndex, toIndex)` turns on drag-to-reorder: each row gets a grip
// handle in a leading column. Dragging is off while a column sort is active,
// because the rows on screen are then not in their saved order.
// Everything a row says, as lower-case text for the table's search box:
// every column as shown or exported (even hidden ones) plus the row's own
// stored fields, so a phone number or code that isn't on screen still matches.
function rowText(row, columns) {
  const parts = [];
  for (const col of columns) {
    try {
      const value = typeof col.exportValue === "function" ? col.exportValue(row) : textOf(col.render ? col.render(row) : row[col.key]);
      if (value != null && value !== "") parts.push(String(value));
    } catch {
      // a column that cannot render for this row adds nothing
    }
  }
  const walk = (value, depth) => {
    if (value == null || depth > 3) return;
    if (typeof value === "string" || typeof value === "number") parts.push(String(value));
    else if (Array.isArray(value)) value.slice(0, 50).forEach((v) => walk(v, depth + 1));
    else if (typeof value === "object") Object.values(value).forEach((v) => walk(v, depth + 1));
  };
  walk(row, 0);
  return parts.join(" ").toLowerCase();
}

// `search` (default on): a box above the table that filters its rows by
// anything in them. Pages whose list is searched on the server pass
// search={false} and keep their own box.
export function Table({ columns: allColumns, rows, empty, onRowClick, keyOf, title, onReorder, search = true }) {
  const [hidden, setHidden] = useHiddenColumns(title);
  const [query, setQuery] = useState("");
  // Columns the user unticked are left out of the table and of downloads.
  // Columns with no heading (row actions) are never hidden.
  const columns = allColumns.filter((c) => !c.label || !hidden.includes(c.key));
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [drag, setDrag] = useState({ from: null, over: null });
  const reorderable = Boolean(onReorder) && !sort.key;

  const matchedRows = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return rows;
    // Every word must appear somewhere in the row ("amul 500" finds Amul 500 g).
    return rows.filter((row) => {
      const text = rowText(row, allColumns);
      return terms.every((t) => text.includes(t));
    });
  }, [rows, query, allColumns]);

  const sortedRows = useMemo(() => {
    if (!sort.key) return matchedRows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return matchedRows;
    return [...matchedRows].sort((a, b) => compareValues(valueOf(a, col), valueOf(b, col)) * sort.dir);
  }, [matchedRows, sort, columns]);

  function toggleSort(key) {
    setSort((current) => (current.key === key ? { key, dir: -current.dir } : { key, dir: 1 }));
  }

  if (!rows.length) return empty || <Empty title="Nothing here yet" />;

  // Dragging rows is off while a search narrows the list.
  const canDrag = reorderable && !query.trim();

  return (
    <>
    {search ? (
      <div className="table-search">
        <span className="search-field">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title ? title.toLowerCase() : "this list"}…`}
            aria-label={`Search ${title || "this list"}`}
          />
        </span>
        {query.trim() ? (
          <span className="table-search-count">
            {sortedRows.length} of {rows.length}
          </span>
        ) : null}
      </div>
    ) : null}
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {onReorder ? <th className="drag-th" aria-label="Reorder" /> : null}
            {columns.map((col, i) => {
              const sortable = col.sortable !== false;
              const last = i === columns.length - 1;
              return (
                <th
                  key={col.key}
                  className={[col.align === "right" ? "num" : "", sortable ? "sortable" : "", last ? "export-th" : ""].filter(Boolean).join(" ")}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={sortable ? () => toggleSort(col.key) : undefined}
                >
                  {col.label}
                  {sortable && sort.key === col.key ? (
                    <span className="sort-arrow">{sort.dir === 1 ? " ▲" : " ▼"}</span>
                  ) : null}
                  {last ? (
                    <div className="export-menu">
                      <ColumnsMenu columns={allColumns} hidden={hidden} onChange={setHidden} />
                      <ExportMenu columns={columns} rows={sortedRows} title={title} />
                    </div>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr
              key={keyOf ? keyOf(row) : row.id || index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
              className={[drag.from === index ? "dragging" : "", drag.over === index && drag.from !== index ? "drop-target" : ""].filter(Boolean).join(" ") || undefined}
              draggable={canDrag || undefined}
              onDragStart={canDrag ? (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index)); setDrag({ from: index, over: index }); } : undefined}
              onDragOver={canDrag ? (e) => { e.preventDefault(); if (drag.over !== index) setDrag((d) => ({ ...d, over: index })); } : undefined}
              onDrop={canDrag ? (e) => { e.preventDefault(); if (drag.from !== null && drag.from !== index) onReorder(drag.from, index); setDrag({ from: null, over: null }); } : undefined}
              onDragEnd={canDrag ? () => setDrag({ from: null, over: null }) : undefined}
            >
              {onReorder ? (
                <td className="drag-td" onClick={(e) => e.stopPropagation()}>
                  <span className={`drag-handle${canDrag ? "" : " off"}`} title={canDrag ? "Drag to reorder" : query.trim() ? "Clear the search to reorder" : "Clear the column sort to reorder"} aria-hidden="true">⋮⋮</span>
                </td>
              ) : null}
              {columns.map((col) => (
                <td key={col.key} className={col.align === "right" ? "num" : ""}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {!sortedRows.length ? (
            <tr>
              <td colSpan={columns.length + (onReorder ? 1 : 0)} className="table-nomatch">
                No matches for “{query.trim()}”
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
    </>
  );
}

// Page numbers to show: always the first and last, the current one and its
// neighbours, with "…" for the gaps (1 … 4 5 6 … 12).
function pageList(page, pages) {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  if (page <= 3) [2, 3, 4].forEach((p) => p <= pages && keep.add(p));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => p >= 1 && keep.add(p));
  const sorted = [...keep].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(`gap${p}`);
    out.push(p);
  });
  return out;
}

const PAGE_SIZES = [10, 20, 50, 100];

// Table footer: rows per page (when onLimit is given), "41–60 of 79", and
// first / previous / numbered pages / next / last.
export function Pagination({ meta, onPage, onLimit }) {
  if (!meta || !meta.total) return null;
  const { page, pages, total } = meta;
  const limit = meta.limit || Math.ceil(total / pages) || 20;
  if (pages <= 1 && !onLimit) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="table-pager">
      {onLimit ? (
        <label className="table-pager-size">
          Rows per page
          <select value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
            {(PAGE_SIZES.includes(limit) ? PAGE_SIZES : [...PAGE_SIZES, limit].sort((a, b) => a - b)).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      ) : null}
      <span className="table-pager-range">
        {from}–{to} of {total}
      </span>
      {pages > 1 ? (
        <nav className="table-pager-pages" aria-label="Pagination">
          <button type="button" disabled={page <= 1} onClick={() => onPage(1)} aria-label="First page">«</button>
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
          {pageList(page, pages).map((p) =>
            typeof p === "number" ? (
              <button
                type="button"
                key={p}
                className={p === page ? "on" : ""}
                aria-current={p === page ? "page" : undefined}
                onClick={() => p !== page && onPage(p)}
              >
                {p}
              </button>
            ) : (
              <span key={p} className="table-pager-gap">…</span>
            )
          )}
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
          <button type="button" disabled={page >= pages} onClick={() => onPage(pages)} aria-label="Last page">»</button>
        </nav>
      ) : null}
    </div>
  );
}

// Prices cross the wire as integer paise; rupees exist only for display.
export const rupees = (paise, { decimals = false } = {}) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format((Number(paise) || 0) / 100);

export const when = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// A filter that used to be a row of chips (All / Active / Hidden / Archived …),
// folded into one dropdown that expands to show every choice. Options are
// { value, label }; "" is the usual "All".
export function ChipDropdown(props) {
  return <ChipExpand {...props} />;
}

// Same idea, but the choices open sideways: click the selected chip and the
// others slide out in a horizontal row next to it (scrolls if there are many).
export function ChipExpand({ options, value, onChange, ariaLabel, small = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const current = options.find((o) => String(o.value) === String(value ?? "")) || options[0];
  return (
    <div className={`chip-expand${open ? " open" : ""}`} ref={rootRef} role="group" aria-label={ariaLabel}>
      <button type="button" className={`cat-chip on chip-expand-toggle${small ? " small" : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {current?.label}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="chip-expand-arrow"><path d="m9 6 6 6-6 6" /></svg>
      </button>
      {open ? (
        <div className="chip-expand-list" role="tablist">
          {options.filter((o) => o !== current).map((o) => (
            <button
              key={String(o.value) || "all"}
              type="button"
              role="tab"
              aria-selected={false}
              className={`cat-chip${small ? " small" : ""}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
const pairs = (list) => list.map(([value, label]) => ({ value, label }));
export { pairs as chipPairs };

// Tabs that keep their state in the URL, so a filtered view is shareable and
// the browser's back button does what it looks like it should.
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="chip-row tabs-chips" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`cat-chip${active === tab.key ? " on" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && tab.count !== null ? <span className="chip-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// From/to pickers with the presets people actually use, so nobody types dates
// to answer "how did we do this week?".
export function DateRange({ value, onChange }) {
  // Local dates, not toISOString() — that is UTC, and before 5:30am IST it
  // would say "yesterday".
  const day = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const preset = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    onChange({ from: day(from), to: day(to) });
  };

  return (
    <div className="inline" style={{ gap: 6 }}>
      <button className="btn sm" onClick={() => preset(1)}>Today</button>
      <button className="btn sm" onClick={() => preset(7)}>7 days</button>
      <button className="btn sm" onClick={() => preset(30)}>30 days</button>
      <DatePicker
        value={value.from || ""}
        max={value.to || undefined}
        placeholder="From date"
        onChange={(from) => onChange({ ...value, from })}
      />
      <span className="faint">to</span>
      <DatePicker
        value={value.to || ""}
        min={value.from || undefined}
        placeholder="To date"
        onChange={(to) => onChange({ ...value, to })}
      />
    </div>
  );
}

// A rating, read-only. Written out rather than drawn as stars: a moderator
// scanning a queue compares numbers faster than they count shapes, and "2/5"
// is unambiguous at any size.
export function Rating({ value = 0, size = 13 }) {
  return (
    <span
      style={{ fontSize: size, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}
      aria-label={`${value} out of 5`}
    >
      {Number(value).toFixed(1)}
      <span className="faint" style={{ fontWeight: 400 }}>/5</span>
    </span>
  );
}

export function Divider({ style }) {
  return <div className="divider" style={style} />;
}
