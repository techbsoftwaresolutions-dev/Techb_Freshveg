// Builds the Farmers Basket uploads for hosting that bills per Node app:
//
//   farmersbasket-app.zip    → ONE Node.js app at thefarmersbasket.in
//                            (website + API at thefarmersbasket.in/api)
//   farmersbasket-admin.zip  → static files for admin.thefarmersbasket.in
//
// Run from anywhere:  node deploy/package-one-app.js
// The project folders themselves are not modified, apart from the admin build
// output, which goes straight into the staging folder.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const project = path.resolve(__dirname, "..");
const live = "https://thefarmersbasket.in";
const stage = path.join(__dirname, ".stage");
fs.rmSync(stage, { recursive: true, force: true });

// Never shipped: dependencies (the host installs them), build output (the
// host builds), local uploads, archives, and local env files.
const SKIP = new Set([
  "node_modules", ".next", ".expo", "dist", "uploads", ".git", "src.zip", ".omc",
  ".env", ".env.local", "package-lock.json", "server.js",
]);
const copy = (from, to) =>
  fs.cpSync(from, to, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });

// Replaces KEY=value lines (adding any missing; null removes) in env text.
function setEnv(text, values) {
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`^${key}=.*(\\r?\\n)?`, "m");
    if (value === null) out = out.replace(re, "");
    else if (re.test(out)) out = out.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
    else out = `${out.trimEnd()}\n${key}=${value}\n`;
  }
  return out;
}

// ---- the one Node app: website at the root, API code under ./backend
const app = path.join(stage, "app");
copy(path.join(project, "website"), app);
copy(path.join(project, "backend/src"), path.join(app, "backend/src"));
// The API is served by a Next.js API route that runs the Express app
// in-process, so the host only ever sees an ordinary Next.js app.
fs.copyFileSync(path.join(__dirname, "one-app/instrumentation.js"), path.join(app, "instrumentation.js"));
fs.copyFileSync(path.join(__dirname, "one-app/api-start.js"), path.join(app, "backend/start.js"));
fs.copyFileSync(path.join(__dirname, "one-app/next.config.mjs"), path.join(app, "next.config.mjs"));
fs.mkdirSync(path.join(app, "pages/api"), { recursive: true });
fs.copyFileSync(path.join(__dirname, "one-app/api-route.js"), path.join(app, "pages/api/[...path].js"));
// Stamp the upload, so GET /api/health says which build the host is running.
const builtAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
fs.writeFileSync(
  path.join(app, "backend/src/build-info.js"),
  `// Written by deploy/package-one-app.js.\nmodule.exports = { builtAt: ${JSON.stringify(builtAt)} };\n`
);
console.log(`build stamp: ${builtAt}`);

const site = JSON.parse(fs.readFileSync(path.join(project, "website/package.json"), "utf8"));
const api = JSON.parse(fs.readFileSync(path.join(project, "backend/package.json"), "utf8"));
fs.writeFileSync(
  path.join(app, "package.json"),
  JSON.stringify(
    {
      name: "farmersbasket",
      version: site.version,
      private: true,
      scripts: { build: "next build", start: "next start" },
      dependencies: { ...api.dependencies, ...site.dependencies },
      engines: { node: ">=20" },
    },
    null,
    2
  ) + "\n"
);

// One .env for both halves. PORT is left out: the host supplies it.
const backendEnv = fs.readFileSync(path.join(project, "backend/.env"), "utf8");
fs.writeFileSync(
  path.join(app, ".env"),
  setEnv(backendEnv, {
    PORT: null,
    NODE_ENV: "production",
    PUBLIC_URL: live,
    // The website is same-origin now; only the admin calls the API cross-site.
    CORS_ORIGINS: `${live},https://www.thefarmersbasket.in,https://admin.thefarmersbasket.in`,
    // The pages read the API at the site's own public address (instrumentation.js
    // enforces this at runtime; here it also serves the build step).
    INTERNAL_API_PORT: null,
    // A workaround for Node's DNS on some Windows PCs (backend/.env). On the
    // host it can only get in the way of reaching MongoDB, so it is left out.
    DNS_SERVERS: null,
    API_BASE_URL: live,
    SITE_URL: live,
  })
);
// The same settings as a file for hPanel's "Import .env" button: the host's
// Next.js preset may not carry the uploaded .env through to the running app,
// but its own Environment Variables always reach it. Holds secrets — never share.
fs.copyFileSync(path.join(app, ".env"), path.join(__dirname, "farmersbasket-app.env"));

// A lockfile matching the merged dependencies, so `npm ci` works too.
execSync("npm install --package-lock-only --no-audit --no-fund", { cwd: app, stdio: "inherit" });
console.log("app staged");

// ---- admin: static build that talks to the API on the main domain
execSync(`npx vite build --outDir "${path.join(stage, "admin")}" --emptyOutDir`, {
  cwd: path.join(project, "admin"),
  stdio: "inherit",
  env: { ...process.env, VITE_API_BASE_URL: live },
});
console.log("admin built");

// ---- zips (tar writes forward-slash paths, which Linux hosts need)
for (const [dir, zip] of [["app", "farmersbasket-app.zip"], ["admin", "farmersbasket-admin.zip"]]) {
  const out = path.join(__dirname, zip);
  fs.rmSync(out, { force: true });
  // Every top-level entry by name (dotfiles included), so paths have no "./".
  const entries = fs.readdirSync(path.join(stage, dir)).map((f) => `"${f}"`).join(" ");
  execSync(`tar.exe -a -cf "${out}" ${entries}`, { cwd: path.join(stage, dir), stdio: "inherit" });
  console.log(`${zip}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
