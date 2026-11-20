const mongoose = require("mongoose");

// Numbered codes — ORD-260928-0007, MNT-1004, AST-0102 — from one counter
// document per series, advanced with a single atomic $inc.
//
// The old way was "count the rows, add one". Two checkouts in the same
// instant both counted the same total and both got the same code (the unique
// index then rejected one customer's order), and deleting a row shrank the
// count so the next code collided with one already issued. An atomic counter
// hands every caller a different number no matter how many arrive at once,
// and it only ever goes up, so a number is never issued twice.

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String }, // the series, e.g. "order:260928"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false, collection: "counters" }
);

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

const DUPLICATE_KEY = 11000;

/**
 * The next number in a series.
 *
 * `floor` is the highest number already issued before this counter existed
 * (or by anything that bypassed it). The counter is raised to at least that
 * first — with $max, which is also atomic — so switching an existing series
 * over never reissues a code that is already on a record.
 */
async function nextSequence(key, { floor = 0 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      if (floor > 0) {
        await Counter.updateOne({ _id: key }, { $max: { seq: floor } }, { upsert: true });
      }
      const counter = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      return counter.seq;
    } catch (err) {
      // Two first-ever calls for a series can race to insert its counter;
      // the loser simply tries again against the row the winner created.
      if (err?.code === DUPLICATE_KEY && attempt < 3) continue;
      throw err;
    }
  }
}

/**
 * The highest number already used in a series of codes, read off the codes
 * themselves: "ORD-260928-" with codes up to ORD-260928-0012 gives 12.
 * Zero-padding keeps codes of one width sorting in number order.
 */
async function highestIssued(Model, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const latest = await Model.findOne({ code: new RegExp(`^${escaped}\\d+$`) })
    .sort({ code: -1 })
    .select("code")
    .lean();
  return latest ? Number(latest.code.slice(prefix.length)) || 0 : 0;
}

module.exports = { nextSequence, highestIssued, Counter };
