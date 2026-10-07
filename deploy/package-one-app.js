// Builds the Hosur Basket uploads for hosting that bills per Node app:
//
//   hosurbasket-app.zip    → ONE Node.js app at hosurbasket.com
//                            (website + API at hosurbasket.com/api)
//   hosurbasket-admin.zip  → static files for admin.hosurbasket.com
//
// Run from anywhere:  node deploy/package-one-app.js
// The project folders themselves are not modified, apart from the admin build
// output, which goes straight into the staging folder.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const project = path.resolve(__dirname, "..");
const live = "https://hosurbasket.com";
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
fs.copyFileSync(path.join(__dirname, "one-app/server.js"), path.join(app, "server.js"));
fs.copyFileSync(path.join(__dirname, "one-app/instrumentation.js"), path.join(app, "instrumentation.js"));
fs.copyFileSync(path.join(__dirname, "one-app/api-start.js"), path.join(app, "backend/start.js"));
fs.copyFileSync(path.join(__dirname, "one-app/next.config.mjs"), path.join(app, "next.config.mjs"));

const site = JSON.parse(fs.readFileSync(path.join(project, "website/package.json"), "utf8"));
const api = JSON.parse(fs.readFileSync(path.join(project, "backend/package.json"), "utf8"));
fs.writeFileSync(
  path.join(app, "package.json"),
  JSON.stringify(
    {
      name: "hosurbasket",
      version: site.version,
      private: true,
      main: "server.js",
      scripts: { build: "next build", start: "node server.js" },
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
    CORS_ORIGINS: `${live},https://www.hosurbasket.com,https://admin.hosurbasket.com`,
    // Under plain `next start`, instrumentation.js runs the API on this private
    // port and both the /api rewrite and the server-rendered pages use it.
    // (Under server.js the site points at its own port instead.)
    INTERNAL_API_PORT: "41755",
    API_BASE_URL: "http://127.0.0.1:41755",
    SITE_URL: live,
  })
);
// The same settings as a file for hPanel's "Import .env" button: the host's
// Next.js preset may not carry the uploaded .env through to the running app,
// but its own Environment Variables always reach it. Holds secrets — never share.
fs.copyFileSync(path.join(app, ".env"), path.join(__dirname, "hosurbasket-app.env"));

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
for (const [dir, zip] of [["app", "hosurbasket-app.zip"], ["admin", "hosurbasket-admin.zip"]]) {
  const out = path.join(__dirname, zip);
  fs.rmSync(out, { force: true });
  // Every top-level entry by name (dotfiles included), so paths have no "./".
  const entries = fs.readdirSync(path.join(stage, dir)).map((f) => `"${f}"`).join(" ");
  execSync(`tar.exe -a -cf "${out}" ${entries}`, { cwd: path.join(stage, dir), stdio: "inherit" });
  console.log(`${zip}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
