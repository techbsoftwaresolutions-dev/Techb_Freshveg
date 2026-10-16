import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A date (or date + time) picker drawn by the app rather than the browser.
// Value in / out is the same string a native input used: "YYYY-MM-DD", or
// "YYYY-MM-DDTHH:mm" with `withTime`. onChange receives that string ("" when
// cleared) — not an event.
//
// The calendar opens in a portal with fixed positioning, so it is never
// clipped by a table or a modal, and flips upward near the bottom of the
// screen. Click the month title to jump by month or year. `min` / `max`
// ("YYYY-MM-DD") grey out days outside a range.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value || ""));
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3], hh: m[4] == null ? null : +m[4], mm: m[5] == null ? null : +m[5] };
}

function today() {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), hh: t.getHours(), mm: t.getMinutes() };
}

function show(p, withTime) {
  if (!p) return "";
  const date = `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
  if (!withTime) return date;
  const h = p.hh ?? 0;
  return `${date}, ${h % 12 || 12}:${pad(p.mm ?? 0)} ${h < 12 ? "am" : "pm"}`;
}

export default function DatePicker({
  value,
  onChange,
  withTime = false,
  min,
  max,
  placeholder,
  disabled = false,
  clearable = true,
  id,
  className = "",
  style,
  invalid = false,
}) {
  const current = parse(value);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("days"); // "days" | "months"
  const [view, setView] = useState(() => ({ y: (current || today()).y, m: (current || today()).m }));
  const [place, setPlace] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const popRef = useRef(null);

  const emit = (p) => {
    if (!p) return onChange?.("");
    const base = ymd(p.y, p.m, p.d);
    onChange?.(withTime ? `${base}T${pad(p.hh ?? 0)}:${pad(p.mm ?? 0)}` : base);
  };

  const measure = () => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = 292;
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const need = withTime ? 430 : 380;
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const flip = below < need && above > below;
    setPlace({ left, width, top: flip ? undefined : r.bottom + 6, bottom: flip ? vh - r.top + 6 : undefined });
  };

  useLayoutEffect(() => {
    if (open) measure();
    else setPlace(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const base = parse(value) || today();
    setView({ y: base.y, m: base.m });
    setMode("days");
    const onDown = (event) => {
      const inside = rootRef.current?.contains(event.target) || popRef.current?.contains(event.target);
      if (!inside) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onScroll = (event) => {
      if (!popRef.current?.contains(event.target)) measure();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shift = (months) =>
    setView((v) => {
      const t = v.y * 12 + v.m + months;
      return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });

  const outOfRange = (y, m, d) => {
    const key = ymd(y, m, d);
    return Boolean((min && key < min) || (max && key > max));
  };

  const pick = (y, m, d) => {
    if (outOfRange(y, m, d)) return;
    const t = today();
    const hh = withTime ? current?.hh ?? t.hh : null;
    const mm = withTime ? current?.mm ?? t.mm : null;
    emit({ y, m, d, hh, mm });
    if (!withTime) {
      setOpen(false);
      buttonRef.current?.focus();
    } else {
      setView({ y, m });
    }
  };

  const setTime = (key, raw, limit) => {
    const n = Math.max(0, Math.min(limit, parseInt(raw, 10) || 0));
    const base = current || today();
    emit({ ...base, hh: base.hh ?? 0, mm: base.mm ?? 0, [key]: n });
  };

  // Six full weeks, Monday first, with the neighbouring months' days greyed in.
  const cells = [];
  const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(view.y, view.m, 1 - lead + i);
    cells.push({ y: date.getFullYear(), m: date.getMonth(), d: date.getDate(), other: date.getMonth() !== view.m });
  }
  const t = today();
  const isSel = (c) => current && current.y === c.y && current.m === c.m && current.d === c.d;
  const isToday = (c) => t.y === c.y && t.m === c.m && t.d === c.d;

  const pop =
    open && place
      ? createPortal(
          <div
            ref={popRef}
            className="dp-pop"
            role="dialog"
            aria-label="Choose date"
            style={{ position: "fixed", left: place.left, width: place.width, top: place.top, bottom: place.bottom, transformOrigin: place.bottom != null ? "bottom" : "top" }}
          >
            <div className="dp-head">
              <button type="button" className="dp-title" onClick={() => setMode(mode === "days" ? "months" : "days")} aria-live="polite">
                {mode === "days" ? `${MONTHS[view.m]} ${view.y}` : view.y}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={mode === "months" ? "up" : ""}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="dp-nav">
                <button type="button" aria-label={mode === "days" ? "Previous month" : "Previous year"} onClick={() => shift(mode === "days" ? -1 : -12)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
                </button>
                <button type="button" aria-label={mode === "days" ? "Next month" : "Next year"} onClick={() => shift(mode === "days" ? 1 : 12)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                </button>
              </div>
            </div>

            {mode === "months" ? (
              <div className="dp-months">
                {MONTHS.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    className={`dp-month${view.m === index ? " on" : ""}${t.y === view.y && t.m === index ? " today" : ""}`}
                    onClick={() => {
                      setView({ y: view.y, m: index });
                      setMode("days");
                    }}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="dp-week">
                  {DAYS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="dp-grid">
                  {cells.map((c) => {
                    const off = outOfRange(c.y, c.m, c.d);
                    return (
                      <button
                        key={`${c.y}-${c.m}-${c.d}`}
                        type="button"
                        disabled={off}
                        className={`dp-day${c.other ? " other" : ""}${isToday(c) ? " today" : ""}${isSel(c) ? " sel" : ""}`}
                        onClick={() => pick(c.y, c.m, c.d)}
                        aria-pressed={isSel(c) || undefined}
                      >
                        {c.d}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {withTime ? (
              <div className="dp-time">
                <span>Time</span>
                <input type="number" min="0" max="23" value={pad(current?.hh ?? 0)} onChange={(e) => setTime("hh", e.target.value, 23)} aria-label="Hour (24h)" />
                <b>:</b>
                <input type="number" min="0" max="59" value={pad(current?.mm ?? 0)} onChange={(e) => setTime("mm", e.target.value, 59)} aria-label="Minute" />
              </div>
            ) : null}

            <div className="dp-foot">
              {clearable && current ? (
                <button type="button" onClick={() => { emit(null); setOpen(false); }}>Clear</button>
              ) : <span />}
              {withTime ? (
                <button type="button" className="strong" onClick={() => setOpen(false)}>Done</button>
              ) : (
                <button type="button" className="strong" disabled={outOfRange(t.y, t.m, t.d)} onClick={() => pick(t.y, t.m, t.d)}>Today</button>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`dp${open ? " open" : ""}${className ? ` ${className}` : ""}`} ref={rootRef} style={style}>
      <button
        type="button"
        id={id}
        ref={buttonRef}
        className="dp-button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        <span className={current ? "dp-value" : "dp-placeholder"}>{current ? show(current, withTime) : placeholder || (withTime ? "Select date & time" : "Select date")}</span>
      </button>
      {pop}
    </div>
  );
}
