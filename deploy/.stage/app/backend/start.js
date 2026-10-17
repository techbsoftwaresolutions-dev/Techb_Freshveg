// The commerce API, run inside the website's own process. Copied to
// backend/start.js in the upload.
//
//   handle(req, res)  — pages/api/[...path].js hands every browser/app /api
//                       request here.
//   inject(request)   — instrumentation.js routes the website's own
//                       server-side catalog reads here, in memory, so they
//                       never leave the process (going out to the public
//                       address meets Hostinger's CDN and its bot check).
//
// Imported statically, so `next build` compiles the backend's code into .next
// itself — Hostinger's Next.js preset runs only the build output.
//
// Next.js compiles this file into more than one bundle (the API route and
// instrumentation), and each bundle gets its own copy of the module. The
// Express app and the database connection must exist once per process, so
// they live on globalThis, and the backend is only ever loaded by whichever
// copy gets there first.
const { IncomingMessage, ServerResponse } = require("http");
const { Socket } = require("net");

const state = globalThis.__hosurBasketApi || (globalThis.__hosurBasketApi = { ready: null, app: null });

function ensureReady() {
  if (!state.ready) {
    state.ready = (async () => {
      const app = require("./src/app");
      const { connectDb } = require("./src/config/db");
      await connectDb();
      // Scheduled jobs belong to the running site, not to a build.
      if (process.env.NEXT_PHASE !== "phase-production-build") require("./src/jobs/scheduler").start();
      state.app = app;
    })().catch((err) => {
      // Try again on the next request (the database may simply have been slow).
      state.ready = null;
      throw err;
    });
  }
  return state.ready;
}

// Error text without secrets: connection strings are masked.
function describe(err) {
  return String((err && err.message) || err).replace(/mongodb(\+srv)?:\/\/\S+/gi, "mongodb://***");
}

async function handle(req, res) {
  try {
    await ensureReady();
  } catch (err) {
    console.error("[api] could not start", err);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, error: "The API could not start", reason: describe(err) }));
    return;
  }
  state.app(req, res);
}

// Runs one request through the Express app in memory and resolves with
// { status, headers, body }. No accept-encoding is sent, so the body comes
// back uncompressed.
async function inject({ method = "GET", path, headers = {}, body }) {
  await ensureReady();

  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = method.toUpperCase();
    req.url = path;
    // A loopback address for the request log and rate limits ("trust proxy"
    // is on, so this is what req.ip reports).
    req.headers = { ...lowerKeys(headers), host: "localhost", "x-forwarded-for": "127.0.0.1" };
    if (body !== undefined && body !== null) req.push(typeof body === "string" ? body : Buffer.from(body));
    req.push(null);

    const res = new ServerResponse(req);
    const chunks = [];
    const collect = (chunk, encoding) => {
      if (chunk && typeof chunk !== "function") {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8"));
      }
    };
    res.write = (chunk, encoding, callback) => {
      collect(chunk, encoding);
      const done = typeof encoding === "function" ? encoding : callback;
      if (done) done();
      return true;
    };
    res.end = (chunk, encoding, callback) => {
      collect(chunk, encoding);
      const done = [chunk, encoding, callback].find((a) => typeof a === "function");
      if (done) done();
      resolve({ status: res.statusCode, headers: res.getHeaders(), body: Buffer.concat(chunks) });
      return res;
    };
    res.on("error", reject);

    try {
      state.app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

function lowerKeys(headers) {
  const entries =
    typeof headers.entries === "function" && !Array.isArray(headers) ? [...headers.entries()] : Object.entries(headers);
  return Object.fromEntries(entries.map(([key, value]) => [String(key).toLowerCase(), String(value)]));
}

module.exports = { handle, inject };
