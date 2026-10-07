// Starts the commerce API inside the website's process (see instrumentation.js).
// Copied to backend/start.js in the upload. It is imported statically, so the
// Next.js build compiles the backend's code into .next itself — Hostinger's
// Next.js preset runs only the build output, not the rest of the upload.
const api = require("./src/app");
const { connectDb } = require("./src/config/db");
const scheduler = require("./src/jobs/scheduler");

async function startApi(port) {
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

module.exports = { startApi };
