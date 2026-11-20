// Turns the admin's date filter (?from=2026-10-26&to=2026-10-26, plain days) into
// a Mongo range that covers those days completely.
//
// `new Date("2026-10-26")` is midnight UTC, which is 05:30 in India — so a "to"
// of that day used to stop before the day had even started, and "Today" and
// "Yesterday" came back empty. A plain day now means 00:00:00 at the start of
// it and 23:59:59.999 at the end of it, in the shop's own timezone (IST).
// Full timestamps are left exactly as given.

const SHOP_OFFSET = "+05:30";
const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parse(value, endOfDay) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = PLAIN_DAY.test(text)
    ? new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${SHOP_OFFSET}`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

// { $gte, $lte } for whichever of from / to were given, or null if neither was.
function dateBounds(from, to) {
  const bounds = {};
  const start = parse(from, false);
  const end = parse(to, true);
  if (start) bounds.$gte = start;
  if (end) bounds.$lte = end;
  return Object.keys(bounds).length ? bounds : null;
}

module.exports = { dateBounds };
