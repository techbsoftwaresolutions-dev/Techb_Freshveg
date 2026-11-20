/* eslint-disable no-console */
// Runs the whole API against a throwaway in-memory MongoDB, seeded with the
// demo catalog — so the admin and the storefront can be driven on a machine
// with no database installed.
//
//   npm run demo
//
// Data lives only as long as the process. Use `npm start` against a real
// MONGODB_URI for anything you want to keep.

const { startMemoryMongo, stopMemoryMongo } = require("./memoryServer");

async function main() {
  await startMemoryMongo();

  // Required after MONGODB_URI is set, because config reads it on load.
  const { run: seed } = require("./run");
  const app = require("../app");
  const config = require("../config");

  await seed({ keepOpen: true });

  const server = app.listen(config.port, () => {
    console.log(`\n[demo] API on http://localhost:${config.port}${config.apiPrefix}`);
    console.log(`[demo] health: http://localhost:${config.port}/api/health`);
    console.log("[demo] in-memory database — everything is discarded on exit.\n");
  });

  const shutdown = async () => {
    console.log("\n[demo] shutting down");
    server.close();
    await stopMemoryMongo();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (err) => {
  console.error("[demo] failed to start:", err);
  await stopMemoryMongo().catch(() => {});
  process.exit(1);
});
