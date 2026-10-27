import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "./SelectMenu";

// A compact date + time picker, in place of the browser's own
// <input type="datetime-local"> (which stretches to the field's full width and
// looks different in every browser). Value in and out is the same local
// "YYYY-MM-DDTHH:mm" string that input uses, or "" for none.
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n) => String(n).padStart(2, "0");

const parse = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const format = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function DateTimePicker({ value, onChange, placeholder = "Pick date & time", disablePast = true, disabled }) {
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  // Opens upwards when the field sits too low on the screen for it to fit.
  const [up, setUp] = useState(false);
  const [view, setView] = useState(() => selected || new Date());
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const today = startOfDay(new Date());
  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  // A day picked keeps the chosen time (6:00 PM if none yet).
  const pickDay = (day) => {
    const base = selected || new Date(day.getFullYear(), day.getMonth(), day.getDate(), 18, 0);
    onChange(format(new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes())));
  };
  const setTime = (hours12, minutes, pm) => {
    const base = selected || new Date();
    const h = (hours12 % 12) + (pm ? 12 : 0);
    onChange(format(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, minutes)));
  };
  const quick = (build) => {
    const d = build(new Date());
    onChange(format(d));
    setView(d);
  };

  const hour12 = selected ? selected.getHours() % 12 || 12 : 6;
  const minute = selected ? selected.getMinutes() - (selected.getMinutes() % 5) : 0;
  const pm = selected ? selected.getHours() >= 12 : true;

  const label = selected
    ? selected.toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : placeholder;

  return (
    <div className="dtp" ref={box}>
      <button
        type="button"
        className={`dtp-trigger${selected ? "" : " empty"}`}
        onClick={() => {
          setView(selected || new Date());
          const rect = box.current?.getBoundingClientRect();
          setUp(Boolean(rect) && window.innerHeight - rect.bottom < 440 && rect.top > 440);
          setOpen((v) => !v);
        }}
        disabled={disabled}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        <span>{label}</span>
      </button>
      {selected && !disabled ? (
        <button type="button" className="dtp-clear" onClick={() => onChange("")} aria-label="Clear date">
          ×
        </button>
      ) : null}

      {open ? (
        <div className={`dtp-pop${up ? " up" : ""}`} role="dialog" aria-label="Choose date and time">
          <div className="dtp-quick">
            <button type="button" onClick={() => quick((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 55))}>Tonight</button>
            <button type="button" onClick={() => quick((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 23, 55))}>Tomorrow</button>
            <button type="button" onClick={() => quick((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3, 23, 55))}>In 3 days</button>
            <button type="button" onClick={() => quick((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 23, 55))}>In a week</button>
          </div>

          <div className="dtp-head">
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
            <strong>{view.toLocaleString("en-IN", { month: "long", year: "numeric" })}</strong>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label="Next month">›</button>
          </div>

          <div className="dtp-grid">
            {WEEKDAYS.map((d) => (
              <span key={d} className="dtp-wd">{d}</span>
            ))}
            {days.map((day) => {
              const outside = day.getMonth() !== view.getMonth();
              const past = disablePast && day < today;
              const cls = [
                "dtp-day",
                outside && "outside",
                sameDay(day, today) && "today",
                sameDay(day, selected) && "on",
              ].filter(Boolean).join(" ");
              return (
                <button key={day.toISOString()} type="button" className={cls} disabled={past} onClick={() => pickDay(day)}>
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="dtp-time">
            <span className="dtp-time-label">Time</span>
            <Select value={hour12} onChange={(e) => setTime(Number(e.target.value), minute, pm)} aria-label="Hour">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </Select>
            <span>:</span>
            <Select value={minute} onChange={(e) => setTime(hour12, Number(e.target.value), pm)} aria-label="Minutes">
              {MINUTES.map((m) => (
                <option key={m} value={m}>{pad(m)}</option>
              ))}
            </Select>
            <div className="dtp-ampm" role="group" aria-label="AM or PM">
              <button type="button" className={!pm ? "on" : ""} onClick={() => setTime(hour12, minute, false)}>AM</button>
              <button type="button" className={pm ? "on" : ""} onClick={() => setTime(hour12, minute, true)}>PM</button>
            </div>
          </div>

          <div className="dtp-foot">
            <button type="button" className="btn sm ghost" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <button type="button" className="btn sm primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
