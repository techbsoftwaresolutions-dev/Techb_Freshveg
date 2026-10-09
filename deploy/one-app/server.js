// The Farmers Basket as ONE Node app — the website and the API in a single process,
// so the hosting plan runs (and bills) one application instead of two.
//
//   https://thefarmersbasket.in/api/...   → the commerce API (backend/src/app.js)
//   https://thefarmersbasket.in/...       → the Next.js website
//
// The admin panel is plain static files and is hosted separately on
// admin.thefarmersbasket.in (no Node needed); it and the phone apps call the API at
// https://thefarmersbasket.in/api/v1.
//
// package-one-app.js copies this file to the root of the upload, next to the
// website files, with the backend's code under ./backend.
const http = require("http");

const port = Number(process.env.PORT) || 3000;

// The website's server-rendered pages read the catalog from the API. Here the
// API is this same process, so they call it over loopback rather than going
// out to the internet and back in through the host's proxy.
process.env.API_BASE_URL = `http://127.0.0.1:${port}`;
// This file serves /api itself, so instrumentation.js must not start a second copy.
process.env.HB_API_IN_PROCESS = "1";

const api = require("./backend/src/app");
const { connectDb } = require("./backend/src/config/db");
const scheduler = require("./backend/src/jobs/scheduler");
const storage = require("./backend/src/modules/storage/providers");
const next = require("next");

const site = next({ dev: false, dir: __dirname });
const handleSite = site.getRequestHandler();

const isApi = (url = "") => url === "/api" || url.startsWith("/api/") || url.startsWith("/api?");

async function start() {
  try {
    await connectDb();
  } catch {
    // connectDb has already explained what went wrong.
    process.exit(1);
  }

  // Scheduled rules (abandoned carts, win-back, stock alerts) run in-process.
  scheduler.start();

  try {
    await site.prepare();
  } catch (err) {
    console.error("[app] website could not start — has `npm run build` been run?", err);
    process.exit(1);
  }

  const server = http
    .createServer((req, res) => (isApi(req.url) ? api(req, res) : handleSite(req, res)))
    .listen(port, () => {
      console.log(`[app] The Farmers Basket ready on port ${port} (website + API at /api)`);
      const missing = storage.missingConfig();
      if (missing.length) console.warn(`[app] image uploads disabled — set ${missing.join(", ")}`);
    });

  const shutdown = (signal) => {
    console.log(`[app] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
