import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "./Icons";

// A compact date filter: one text field (showing the current choice, e.g. Today) that opens a small menu with
// All Time, Last 7 Days, Last 15 Days, Last 1 Month and a Custom Range.
// It reads and writes the same { from, to } value (yyyy-mm-dd, local dates) as
// the older DateRange control, so a page can swap one for the other.

// Local dates, not toISOString() — that is UTC, and before 5:30am IST it would
// say "yesterday".
const day = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const PRESETS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7", label: "Last 7 Days" },
  { key: "15", label: "Last 15 Days" },
  { key: "month", label: "Last 1 Month" },
];

// What every list and report opens on: today only. Pick another range from
// the field to see more.
export const todayRange = () => rangeFor("today");

function rangeFor(key) {
  if (key === "all") return { from: "", to: "" };
  if (key === "today") {
    const today = day(new Date());
    return { from: today, to: today };
  }
  if (key === "yesterday") {
    const back = new Date();
    back.setDate(back.getDate() - 1);
    const yesterday = day(back);
    return { from: yesterday, to: yesterday };
  }
  const to = new Date();
  const from = new Date();
  if (key === "month") from.setMonth(from.getMonth() - 1);
  else from.setDate(from.getDate() - (Number(key) - 1));
  return { from: day(from), to: day(to) };
}

// Which menu row matches the current value, so the right one is highlighted.
function choiceOf(value) {
  if (!value.from && !value.to) return "all";
  for (const preset of PRESETS.slice(1)) {
    const range = rangeFor(preset.key);
    if (range.from === value.from && range.to === value.to) return preset.key;
  }
  return "custom";
}

// What the field shows: the preset's name, or the dates for a custom range.
function labelOf(value, choice) {
  const preset = PRESETS.find((p) => p.key === choice);
  if (preset) return preset.label;
  const short = (d) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "…";
  return `${short(value.from)} – ${short(value.to)}`;
}

export default function DateFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(value.from || "");
  const [to, setTo] = useState(value.to || "");
  const box = useRef(null);
  const choice = choiceOf(value);

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

  function toggle() {
    if (!open) {
      setFrom(value.from || "");
      setTo(value.to || "");
      setCustomOpen(choice === "custom");
    }
    setOpen(!open);
  }

  function pick(key) {
    onChange(rangeFor(key));
    setOpen(false);
  }

  function apply() {
    if (!from && !to) return pick("all");
    // If the dates were typed the wrong way round, put them in order.
    const [a, b] = from && to && from > to ? [to, from] : [from, to];
    onChange({ from: a, to: b });
    setOpen(false);
  }

  return (
    <div className="date-filter" ref={box}>
      <button
        type="button"
        className={`date-filter-field${open ? " open" : ""}`}
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Filter by date"
      >
        <span>{labelOf(value, choice)}</span>
        <IconChevronDown width="14" height="14" aria-hidden="true" className={open ? "flip" : ""} />
      </button>

      {open && (
        <div className="date-filter-pop" role="menu">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              role="menuitem"
              className={`date-filter-item${choice === preset.key ? " on" : ""}`}
              onClick={() => pick(preset.key)}
            >
              {preset.label}
            </button>
          ))}

          <button
            type="button"
            className={`date-filter-item custom${choice === "custom" ? " on" : ""}`}
            onClick={() => setCustomOpen(!customOpen)}
            aria-expanded={customOpen}
          >
            Custom Range
            <IconChevronDown width="14" height="14" aria-hidden="true" className={customOpen ? "" : "flip"} />
          </button>

          {customOpen && (
            <div className="date-filter-custom">
              <label>
                <span>From</span>
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </label>
              <button type="button" className="btn primary date-filter-apply" onClick={apply}>
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
