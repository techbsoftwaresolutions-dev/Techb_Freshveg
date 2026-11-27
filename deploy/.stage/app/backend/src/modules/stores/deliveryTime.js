// How soon a store promises to deliver: 15 minutes, 30 minutes, 1 hour, the
// next day — or any extra choice the store adds itself. An extra choice is
// either a length of time ("2 hours") or a fixed time of day with a name the
// admin types ("Next morning" = tomorrow 9:00 am, "Evening" = today 6:00 pm).
// The store keeps the pick in `settings.deliveryTime`, its own extra choices in
// `settings.deliveryTimeOptions`, and mirrors the pick into
// `settings.prepTimeMinutes`, which older screens and reports read.

const DEFAULTS = [
  { key: "15m", label: "15 min", minutes: 15 },
  { key: "30m", label: "30 min", minutes: 30 },
  { key: "1h", label: "1 hour", minutes: 60 },
  { key: "next_day", label: "Next day", minutes: 1440 },
];

const TZ = "Asia/Kolkata";
const istDate = (date) => date.toLocaleDateString("en-CA", { timeZone: TZ });

// "09:00" -> "9:00 am"
function clock12(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// Order of the dropdown: lengths of time by minutes, fixed times by how far
// into "today" (or "tomorrow" = +24 h) they fall.
function sortKeyOf(o) {
  if (o.plain) return 100000; // named only: after everything with a time, in the order added
  if (!o.at) return o.minutes;
  const [h, m] = o.at.split(":").map(Number);
  return (o.day === "tomorrow" ? 1440 : 0) + h * 60 + m;
}

function wordsFor(option) {
  if (option.key === "next_day") return "the next day";
  if (option.plain) return String(option.label).toLowerCase();
  if (option.at) return `${option.day === "tomorrow" ? "tomorrow" : "today"} at ${clock12(option.at)}`;
  // "10 min" reads as "in about 10 minutes" to a customer.
  const words = String(option.label).toLowerCase().replace(/\bmin\b/, (m, i, all) => (/^1\s/.test(all) ? "minute" : "minutes"));
  return `in about ${words}`;
}

// When an order placed `from` should arrive. Next day = 10 am tomorrow (IST);
// a fixed time rolls to tomorrow if today's has already gone.
function expectedByOption(option, from = new Date()) {
  if (option.plain) return null; // a name with no clock time has no exact arrival
  if (option.key === "next_day") {
    return new Date(`${istDate(new Date(from.getTime() + 86400000))}T10:00:00+05:30`);
  }
  if (option.at) {
    let when = new Date(`${istDate(from)}T${option.at}:00+05:30`);
    if (option.day === "tomorrow") when = new Date(`${istDate(new Date(from.getTime() + 86400000))}T${option.at}:00+05:30`);
    else if (when <= from) when = new Date(when.getTime() + 86400000);
    return when;
  }
  return new Date(from.getTime() + option.minutes * 60000);
}

const minutesUntil = (option, from = new Date()) =>
  option.plain ? 1440 : Math.max(1, Math.round((expectedByOption(option, from) - from) / 60000));

// Orders placed after the store's cut-off (default 7 pm) — or overnight before
// the morning run — are still taken and confirmed, but go out first thing in
// the morning. Returns null while same-day delivery is still on.
const CUTOFF = "19:00";
const MORNING = "07:00";
const okClock = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || "")) ? String(v) : "");
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function afterHours(settings = {}, at = new Date()) {
  const cutoff = okClock(settings.orderCutoff) || CUTOFF;
  const morning = okClock(settings.morningDelivery) || MORNING;
  const ist = new Date(at.getTime() + 330 * 60000);
  const now = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (now < toMin(cutoff) && now >= toMin(morning)) return null;
  const nextDay = now >= toMin(cutoff);
  const day = istDate(new Date(at.getTime() + (nextDay ? 86400000 : 0)));
  return {
    cutoff,
    morning,
    expectedBy: new Date(`${day}T${morning}:00+05:30`),
    label: "Early morning",
    when: `${nextDay ? "tomorrow" : "this"} morning at ${clock12(morning)}`,
    reason: nextDay
      ? `We take the day's last orders at ${clock12(cutoff)}, so yours will be packed fresh and delivered first thing in the morning.`
      : `Our store is closed overnight, so yours will be packed fresh and delivered first thing in the morning.`,
  };
}

// Standard choices plus the store's own, in order.
function optionsFor(settings = {}) {
  const custom = (settings.deliveryTimeOptions || [])
    .filter((o) => o && o.key && o.label && (Number(o.minutes) > 0 || o.at || o.plain))
    .map((o) => ({
      key: String(o.key),
      label: String(o.label),
      minutes: Number(o.minutes) || 0,
      ...(o.at ? { at: String(o.at), day: o.day === "tomorrow" ? "tomorrow" : "today" } : {}),
      ...(o.plain ? { plain: true } : {}),
      custom: true,
    }));
  return [...DEFAULTS.map((o) => ({ ...o })), ...custom]
    .map((o) => ({ ...o, text: wordsFor(o) }))
    .sort((a, b) => sortKeyOf(a) - sortKeyOf(b));
}

// Cleans the extra choices an admin submits.
function normaliseCustom(list) {
  const seen = new Set(DEFAULTS.map((o) => o.key));
  const minutesSeen = new Set(DEFAULTS.map((o) => o.minutes));
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const label = String(raw?.label || "").trim().slice(0, 24);
    if (!label) continue;
    if (raw?.plain) {
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) continue;
      const key = `t${slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label, plain: true, minutes: 0 });
    } else if (raw?.at) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.at)) continue;
      const day = raw.day === "tomorrow" ? "tomorrow" : "today";
      const key = `a${raw.at.replace(":", "")}${day === "tomorrow" ? "t" : "d"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label, at: raw.at, day, minutes: sortKeyOf({ at: raw.at, day }) });
    } else {
      const minutes = Math.round(Number(raw?.minutes));
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 14400 || minutesSeen.has(minutes)) continue;
      minutesSeen.add(minutes);
      out.push({ key: `c${minutes}`, label, minutes });
    }
  }
  return out;
}

// Free text typed into the dropdown: "2 hours" / "45 min" is a length of time,
// anything else ("Next morning") is a name only.
function parseTyped(text) {
  const typed = String(text || "").trim().replace(/\s+/g, " ").slice(0, 24);
  if (!typed) return null;
  const m = typed.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i);
  if (m) {
    const n = Number(m[1]);
    const u = m[2].toLowerCase()[0];
    const unit = u === "m" ? "min" : u === "h" ? (n === 1 ? "hour" : "hours") : n === 1 ? "day" : "days";
    return { label: `${n} ${unit}`, minutes: Math.round(n * (u === "m" ? 1 : u === "h" ? 60 : 1440)) };
  }
  return { label: typed[0].toUpperCase() + typed.slice(1), plain: true };
}

// A store saved before the choice existed only has a number of minutes.
function infoFor(settings = {}) {
  const options = optionsFor(settings);
  const chosen = options.find((o) => o.key === settings.deliveryTime);
  if (chosen) return chosen;
  const minutes = Number(settings.prepTimeMinutes) || 30;
  return options.find((o) => !o.custom && o.minutes >= minutes) || options.find((o) => o.key === "next_day");
}

const expectedBy = (settings, from) => expectedByOption(infoFor(settings), from);

module.exports = { afterHours, okClock, parseTyped, DEFAULTS, optionsFor, normaliseCustom, infoFor, expectedBy, expectedByOption, minutesUntil };
