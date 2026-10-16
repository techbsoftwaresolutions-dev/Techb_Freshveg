const app = require("./app");
const config = require("./config");
const { connectDb } = require("./config/db");
const scheduler = require("./jobs/scheduler");
const storage = require("./modules/storage/providers");

async function start() {
  try {
    await connectDb();
  } catch {
    // connectDb has already explained what went wrong; exiting beats serving
    // an API where every request fails on a database timeout.
    process.exit(1);
  }

  // The single app icon of older versions becomes one icon per app.
  await require("./modules/settings/branding")
    .migrateLegacyAppIcon(require("mongoose").connection.db)
    .catch((err) => console.warn("[api] app icon migration:", err.message));

  // Reward coupons depend on their unique indexes (one coupon per referral
  // milestone, one code each) to stay single-issue, so these are ensured on
  // boot rather than left to `npm run sync-indexes` like the rest. Both
  // collections are small; on later boots this is a no-op check.
  for (const model of [require("./modules/referrals/coupon.model"), require("./modules/referrals/referral.model")]) {
    model
      .createIndexes()
      .catch((err) => console.warn("[api] referral indexes:", err.message));
  }

  // Scheduled rules (abandoned carts, win-back, stock alerts) run in-process.
  scheduler.start();

  const server = app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
    console.log(`[api] routes mounted at ${config.apiPrefix}`);
    console.log(`[api] health check: http://localhost:${config.port}/api/health`);

    // Image uploads have no fallback, so say so now rather than at the first upload.
    const missing = storage.missingConfig();
    if (missing.length) console.warn(`[api] image uploads disabled — set ${missing.join(", ")}`);
  });

  const shutdown = (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
