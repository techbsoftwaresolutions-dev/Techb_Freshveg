// Starts the commerce API inside the website's process when the host launches
// the site with plain `next start` (Hostinger's Next.js preset does, ignoring
// server.js). Next.js calls register() once when its server boots.
//
// The API listens on a private loopback port; next.config's /api rewrite and
// the server-rendered pages both point at that port. When server.js is the
// entry point it serves /api itself and sets HB_API_IN_PROCESS, so this does
// nothing.
const INTERNAL_API_PORT = 41755;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.HB_API_IN_PROCESS) return;
  process.env.HB_API_IN_PROCESS = "1";

  // The site's own pages read the catalog from this in-process API, whatever
  // API_BASE_URL the host's settings may say.
  process.env.API_BASE_URL = `http://127.0.0.1:${INTERNAL_API_PORT}`;

  // A broken API (say, a missing MONGODB_URI) must not take the shop's pages
  // down with it, so its failure is logged, not thrown.
  try {
    const { startApi } = await import("./backend/start.js");
    await startApi(INTERNAL_API_PORT);
  } catch (err) {
    console.error("[api] could not start", err);
  }
}
