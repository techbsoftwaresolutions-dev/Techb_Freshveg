// Starts the commerce API inside the website's process when the host launches
// the site with plain `next start` (Hostinger's Next.js preset does, ignoring
// server.js). Next.js calls register() once when its server boots.
//
// The API listens on a private loopback port; next.config's /api rewrite and
// the server-rendered pages (API_BASE_URL in .env) both point at that port.
// When server.js is the entry point it serves /api itself and sets
// HB_API_IN_PROCESS, so this does nothing.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.HB_API_IN_PROCESS) return;
  process.env.HB_API_IN_PROCESS = "1";

  // Load the backend with Node's own require so webpack leaves it unbundled.
  const nodeRequire = eval("require");
  const path = nodeRequire("path");
  const root = process.cwd();
  const load = (file) => nodeRequire(path.join(root, "backend/src", file));

  const port = Number(process.env.INTERNAL_API_PORT) || 41755;
  const api = load("app");
  const { connectDb } = load("config/db");
  const scheduler = load("jobs/scheduler");

  try {
    await connectDb();
  } catch (err) {
    console.error("[api] database connection failed — the API will not start", err);
    return;
  }
  scheduler.start();
  api
    .listen(port, "127.0.0.1", () => console.log(`[api] listening on 127.0.0.1:${port}`))
    .on("error", (err) => console.error(`[api] could not listen on port ${port}`, err));
}
