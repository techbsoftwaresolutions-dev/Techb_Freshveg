import { createContext, isValidElement, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sparkline from "./Sparkline";

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
  const wrapperProps = to ? { to, className: "card stat-card" } : { className: "card" };
  return (
    <Wrapper {...wrapperProps}>
      <div className="card-body stat">
        <div className="stat-top">
          <div className="stat-head">
            {Icon ? (
              <span className={`icon-chip${hue ? ` ${hue}` : ""}`}>
                <Icon />
              </span>
            ) : null}
            <div className="label">{label}</div>
          </div>
          {spark && spark.length > 1 ? <Sparkline points={spark} tone={trendUp ? "ok" : "danger"} /> : null}
        </div>
        <div className="value" style={tone ? { color: `var(--${tone})` } : undefined}>
          {value}
        </div>
        {hasTrend ? (
          <div className={`stat-trend ${trendUp ? "up" : "down"}`}>
            <span>{trendUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%</span>
            <span className="stat-trend-note">vs last week</span>
          </div>
        ) : null}
        {foot && <div className="foot">{foot}</div>}
      </div>
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

export function Banner({ tone = "info", children }) {
  if (!children) return null;
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

export function Field({ label, help, error, children, inherited }) {
  return (
    <div className="field">
      {label && (
        <label>
          {label}
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

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// CSV and Word both download straight away. PDF has no reliable dependency-
// free way to generate a file client-side, so it opens a print-formatted
// window instead and lets the browser's own "Save as PDF" do the encoding —
// the standard zero-dependency way to offer a PDF export from the browser.
function exportRows(columns, rows, format, title) {
  const cols = columns.filter((c) => c.exportable !== false);
  const headers = cols.map((c) => c.label);
  const lines = rows.map((row) => cols.map((c) => textOf(c.render ? c.render(row) : row[c.key])));
  const base = (title || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "export";
  const heading = escapeHtml(title || "Export");

  if (format === "csv") {
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...lines].map((row) => row.map(esc).join(",")).join("\r\n");
    downloadBlob(csv, `${base}.csv`, "text/csv;charset=utf-8;");
    return;
  }

  const tableHtml = `
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;">
      <thead><tr>${headers.map((h) => `<th style="background:#f1f5f9;text-align:left;padding:6px 10px;">${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>${lines.map((row) => `<tr>${row.map((cell) => `<td style="padding:6px 10px;">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;

  if (format === "word") {
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${heading}</title></head>
      <body><h2 style="font-family:Arial,sans-serif;">${heading}</h2>${tableHtml}</body></html>`;
    // Word opens an HTML document saved with a .doc extension natively —
    // the standard way to hand Word a file with no docx-building library.
    downloadBlob(doc, `${base}.doc`, "application/msword");
    return;
  }

  if (format === "pdf") {
    const win = window.open("", "_blank");
    if (!win) return; // pop-up blocked — nothing to export into
    win.document.write(`<html><head><title>${heading}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h2 { margin: 0 0 16px; }
        @media print { @page { margin: 16mm; } }
      </style></head>
      <body><h2>${heading}</h2>${tableHtml}</body></html>`);
    win.document.close();
    win.focus();
    // The print dialog needs the page actually painted first — closing the
    // write stream alone isn't enough on a slower machine and can print a
    // blank sheet.
    setTimeout(() => win.print(), 300);
  }
}

function ExportBar({ columns, rows, title }) {
  if (!rows.length) return null;
  return (
    <div className="table-export-bar">
      <span className="faint" style={{ fontSize: 12 }}>Export:</span>
      <button type="button" className="btn ghost sm" onClick={() => exportRows(columns, rows, "csv", title)}>CSV</button>
      <button type="button" className="btn ghost sm" onClick={() => exportRows(columns, rows, "word", title)}>Word</button>
      <button type="button" className="btn ghost sm" onClick={() => exportRows(columns, rows, "pdf", title)}>PDF</button>
    </div>
  );
}

// `title` names the export (filename + heading) — any page can pass one,
// but every page works without it (falls back to "export"), so adding
// sorting and download buttons here reaches every list in the app without
// having to touch each page's own columns.
export function Table({ columns, rows, empty, onRowClick, keyOf, title }) {
  const [sort, setSort] = useState({ key: null, dir: 1 });

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => compareValues(valueOf(a, col), valueOf(b, col)) * sort.dir);
  }, [rows, sort, columns]);

  function toggleSort(key) {
    setSort((current) => (current.key === key ? { key, dir: -current.dir } : { key, dir: 1 }));
  }

  if (!rows.length) return empty || <Empty title="Nothing here yet" />;

  return (
    <div className="table-wrap">
      <ExportBar columns={columns} rows={sortedRows} title={title} />
      <table className="data">
        <thead>
          <tr>
            {columns.map((col) => {
              const sortable = col.sortable !== false;
              return (
                <th
                  key={col.key}
                  className={[col.align === "right" ? "num" : "", sortable ? "sortable" : ""].filter(Boolean).join(" ")}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={sortable ? () => toggleSort(col.key) : undefined}
                >
                  {col.label}
                  {sortable && sort.key === col.key ? (
                    <span className="sort-arrow">{sort.dir === 1 ? " ▲" : " ▼"}</span>
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
            >
              {columns.map((col) => (
                <td key={col.key} className={col.align === "right" ? "num" : ""}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="inline" style={{ justifyContent: "flex-end", padding: "12px 16px", gap: 10 }}>
      <span className="faint" style={{ fontSize: 12 }}>
        Page {meta.page} of {meta.pages} · {meta.total} total
      </span>
      <button className="btn sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        Prev
      </button>
      <button className="btn sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>
        Next
      </button>
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

// Tabs that keep their state in the URL, so a filtered view is shareable and
// the browser's back button does what it looks like it should.
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="inline" style={{ gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`btn sm${active === tab.key ? " primary" : " ghost"}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && tab.count !== null ? (
            <span style={{ opacity: 0.7, marginLeft: 2 }}>({tab.count})</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// From/to pickers with the presets people actually use, so nobody types dates
// to answer "how did we do this week?".
export function DateRange({ value, onChange }) {
  const preset = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    onChange({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  };

  return (
    <div className="inline" style={{ gap: 6 }}>
      <button className="btn sm" onClick={() => preset(1)}>Today</button>
      <button className="btn sm" onClick={() => preset(7)}>7 days</button>
      <button className="btn sm" onClick={() => preset(30)}>30 days</button>
      <input
        type="date"
        value={value.from || ""}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        style={{ width: "auto" }}
      />
      <span className="faint">to</span>
      <input
        type="date"
        value={value.to || ""}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        style={{ width: "auto" }}
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
