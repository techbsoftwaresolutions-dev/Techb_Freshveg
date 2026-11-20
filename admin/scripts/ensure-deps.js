// Runs before `npm run dev` / `build` / `preview` (see package.json "pre*"
// scripts). After a `git pull` that adds or upgrades a package, node_modules
// is out of date and Vite fails with "Failed to resolve import ...". This
// checks every direct dependency against package-lock.json and runs
// `npm install` only when something is missing or at the wrong version —
// a few milliseconds when everything is already in place.
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));

const pkg = readJson("package.json");
const lock = existsSync(join(root, "package-lock.json")) ? readJson("package-lock.json") : null;
const wanted = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

const stale = wanted.filter((name) => {
  const installed = join(root, "node_modules", name, "package.json");
  if (!existsSync(installed)) return true;
  const lockedVersion = lock?.packages?.[`node_modules/${name}`]?.version;
  return Boolean(lockedVersion) && JSON.parse(readFileSync(installed, "utf8")).version !== lockedVersion;
});

if (stale.length) {
  console.log(`[deps] Out of date: ${stale.join(", ")} — running npm install…`);
  execSync("npm install --no-audit --no-fund", { cwd: root, stdio: "inherit" });
}
