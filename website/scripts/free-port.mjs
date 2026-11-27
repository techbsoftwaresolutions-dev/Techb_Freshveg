// Runs before `npm run dev` (package.json "predev"). If an earlier
// `next dev` for THIS website is still running in the background (a closed
// terminal, a crashed editor, a server started by a tool), port 3100 stays
// taken and the new one fails with "EADDRINUSE: address already in use".
// This stops only those leftover Next.js processes of this folder — nothing
// else on the machine is touched.
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function leftovers() {
  if (process.platform === "win32") {
    const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object { "$($_.ProcessId)\t$($_.CommandLine)" }`;
    const out = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { encoding: "utf8" });
    return out.split(/\r?\n/).filter(Boolean).map((line) => {
      const [pid, ...rest] = line.split("\t");
      return { pid: Number(pid), cmd: rest.join("\t") };
    });
  }
  const out = execSync("ps -eo pid=,args=", { encoding: "utf8" });
  return out.split("\n").filter(Boolean).map((line) => {
    const m = line.trim().match(/^(\d+)\s+(.*)$/);
    return m ? { pid: Number(m[1]), cmd: m[2] } : null;
  }).filter(Boolean);
}

try {
  const here = root.toLowerCase().replace(/\\/g, "/");
  const stale = leftovers().filter(({ pid, cmd }) => {
    if (!pid || pid === process.pid || pid === process.ppid) return false;
    const c = cmd.toLowerCase().replace(/\\/g, "/");
    // `next dev` of this folder: its CLI (next/dist/bin/next) or its server worker.
    return c.includes(here) && (c.includes("next/dist/bin/next") || c.includes("next/dist/server/lib/start-server"));
  });
  for (const { pid } of stale) {
    try {
      if (process.platform === "win32") execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      else process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  if (stale.length) console.log(`Stopped ${stale.length} leftover website server process(es) holding port 3100.`);
} catch {
  // Could not list processes: carry on, `next dev` will report the port itself.
}
