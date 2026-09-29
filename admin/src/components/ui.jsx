import { createContext, useContext, useEffect } from "react";
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

export function Table({ columns, rows, empty, onRowClick, keyOf }) {
  if (!rows.length) return empty || <Empty title="Nothing here yet" />;

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align === "right" ? "num" : ""} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
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
