const rules = require("./rules");

// A small in-process scheduler.
//
// Deliberately not a cron library and not a queue: this runs one store's
// housekeeping, and an interval timer with an overlap guard is the honest
// amount of machinery for that. When the business outgrows one API process,
// these same functions move behind BullMQ without changing.

const JOBS = [
  { name: "abandonedCarts", everyMinutes: 15, run: rules.abandonedCarts },
  { name: "wishlistWatches", everyMinutes: 60, run: rules.wishlistWatches },
  { name: "lowStockAlerts", everyMinutes: 12 * 60, run: rules.lowStockAlerts },
  { name: "winBack", everyMinutes: 24 * 60, run: rules.winBack },
  { name: "expireCarts", everyMinutes: 24 * 60, run: rules.expireCarts },
  { name: "expireLoyalty", everyMinutes: 24 * 60, run: rules.expireLoyalty },
];

const timers = [];
const running = new Set();
const lastRun = new Map();

async function runJob(job) {
  // A slow sweep must not stack on itself — skip rather than queue.
  if (running.has(job.name)) return null;
  running.add(job.name);

  const startedAt = Date.now();
  try {
    const result = await job.run();
    lastRun.set(job.name, { at: new Date(), ms: Date.now() - startedAt, result });
    if (result && !result.skipped) {
      const summary = Object.entries(result)
        .filter(([, value]) => typeof value === "number" && value > 0)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      if (summary) console.log(`[jobs] ${job.name}: ${summary}`);
    }
    return result;
  } catch (err) {
    lastRun.set(job.name, { at: new Date(), ms: Date.now() - startedAt, error: err.message });
    console.warn(`[jobs] ${job.name} failed:`, err.message);
    return null;
  } finally {
    running.delete(job.name);
  }
}

function start() {
  if (process.env.DISABLE_JOBS === "true") {
    console.log("[jobs] disabled by DISABLE_JOBS");
    return;
  }

  for (const job of JOBS) {
    const interval = job.everyMinutes * 60 * 1000;
    const timer = setInterval(() => runJob(job), interval);
    // Do not hold the process open for a timer — a shutdown should not wait
    // twelve hours for the next low-stock sweep.
    timer.unref?.();
    timers.push(timer);
  }

  console.log(`[jobs] ${JOBS.length} scheduled rules running`);
}

function stop() {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
}

/** Runs one job immediately — used by the admin's "run now" button and tests. */
async function trigger(name) {
  const job = JOBS.find((j) => j.name === name);
  if (!job) throw new Error(`Unknown job: ${name}`);
  return runJob(job);
}

const status = () =>
  JOBS.map((job) => ({
    name: job.name,
    everyMinutes: job.everyMinutes,
    running: running.has(job.name),
    last: lastRun.get(job.name) || null,
  }));

module.exports = { start, stop, trigger, status, JOBS };
