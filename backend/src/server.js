const app = require("./app");
const config = require("./config");
const { connectDb } = require("./config/db");
const scheduler = require("./jobs/scheduler");

async function start() {
  try {
    await connectDb();
  } catch {
    // connectDb has already explained what went wrong; exiting beats serving
    // an API where every request fails on a database timeout.
    process.exit(1);
  }

  // Scheduled rules (abandoned carts, win-back, stock alerts) run in-process.
  scheduler.start();

  const server = app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
    console.log(`[api] routes mounted at ${config.apiPrefix}`);
    console.log(`[api] health check: http://localhost:${config.port}/api/health`);
  });

  const shutdown = (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
