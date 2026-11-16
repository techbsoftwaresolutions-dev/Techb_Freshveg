// Builds the installable APK on this computer with Gradle, so releases don't
// depend on EAS cloud build credits (the free plan runs out each month).
//
//   npm run build:apk            -> release APK pointed at production
//   npm run build:apk -- --debug -> debug APK
//   API_BASE_URL=http://... npm run build:apk   -> point at another server
//
// Output: android/app/build/outputs/apk/<release|debug>/app-<type>.apk
const { spawnSync } = require("node:child_process");
const { existsSync, copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const PRODUCTION_API = "https://hosurbasket.com"; // same as eas.json "preview"
const debug = process.argv.includes("--debug");
const type = debug ? "debug" : "release";

const root = join(__dirname, "..");
const androidDir = join(root, "android");

// app.config.js reads API_BASE_URL while Gradle bundles the JS. The local .env
// leaves it blank (the dev server falls back to the LAN backend), so a release
// build must set it or the installed app would talk to a laptop IP.
const env = { ...process.env };
if (!env.API_BASE_URL) env.API_BASE_URL = PRODUCTION_API;
env.NODE_ENV = debug ? "development" : "production";
// Some Windows terminals start without these; Gradle and Node child processes need them.
env.SystemRoot = env.SystemRoot || env.SYSTEMROOT || "C:\\Windows";
env.windir = env.windir || env.SystemRoot;
// The native (C++) steps fail on Windows' 260-character path limit when the
// Gradle cache sits under a long user folder ("C:\Users\<name>\.gradle\caches\
// ...\transforms\<hash>\...\boost\...hpp"). A short Gradle home on the
// project's drive keeps every path well under it. Override with GRADLE_USER_HOME.
if (process.platform === "win32" && !process.env.GRADLE_USER_HOME) {
  env.GRADLE_USER_HOME = `${root.slice(0, 2)}\\gradle-home`;
}

// An Android SDK under a folder with spaces ("C:\Users\First  Last\...") makes
// CMake call the compiler by its 8.3 short name (CLANG_~1.EXE instead of
// clang++.exe). Clang then no longer knows it is C++ and skips the C++ library,
// so linking fails with "undefined symbol: operator delete". A junction (a
// link, not a copy) gives the same SDK a space-free path.
const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
if (process.platform === "win32" && /\s/.test(sdk)) {
  const link = `${root.slice(0, 2)}\\android-sdk`;
  if (!existsSync(link)) {
    const made = spawnSync(env.ComSpec || "cmd.exe", ["/d", "/c", "mklink", "/J", link, sdk], { env, stdio: "inherit" });
    if (made.status !== 0) {
      console.error(`Could not create ${link} -> ${sdk}. Create it once by hand:\n  mklink /J ${link} "${sdk}"`);
      process.exit(1);
    }
  }
  env.ANDROID_HOME = link;
  env.ANDROID_SDK_ROOT = link;
}

// The SDK's default CMake 3.22 ships ninja 1.10, which refuses any object path
// over 260 characters ("Filename longer than 260 characters"); this project's
// path makes the C++ codegen paths longer than that. CMake 3.31's ninja (1.12)
// handles long paths (with Windows long paths enabled), so point Gradle at it.
const cmakeDir =
  process.platform === "win32" && (env.ANDROID_HOME || env.ANDROID_SDK_ROOT)
    ? useLongPathCmake(env.ANDROID_HOME || env.ANDROID_SDK_ROOT)
    : null;

// Native build folders (.cxx) remember absolute paths (Gradle home, SDK,
// CMake) from when they were configured. When any changes they must be
// regenerated, or the old paths keep being used.
const homeMarker = join(androidDir, ".gradle-home-used");
const usedHome = `${env.GRADLE_USER_HOME || "(default)"} | ${env.ANDROID_HOME || env.ANDROID_SDK_ROOT} | ${cmakeDir || "(default cmake)"}`;
const previousHome = existsSync(homeMarker) ? readFileSync(homeMarker, "utf8").trim() : null;
if (previousHome !== usedHome) {
  const stale = [join(androidDir, "app", ".cxx")];
  const modules = join(root, "node_modules");
  for (const name of existsSync(modules) ? readdirSync(modules) : []) {
    const dirs = name.startsWith("@")
      ? readdirSync(join(modules, name)).map((sub) => join(modules, name, sub))
      : [join(modules, name)];
    for (const dir of dirs) stale.push(join(dir, "android", ".cxx"));
  }
  for (const dir of stale) if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  writeFileSync(homeMarker, `${usedHome}\n`);
  console.log(`Gradle home is ${usedHome}; cleared cached native build folders.`);
}

if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT) {
  console.error("ANDROID_HOME is not set. Point it at your Android SDK (Android Studio > SDK Manager shows the path).");
  process.exit(1);
}

console.log(`Building ${type} APK with API_BASE_URL=${env.API_BASE_URL}\n`);

const isWin = process.platform === "win32";
const task = debug ? "assembleDebug" : "assembleRelease";
// Full path, not a bare "gradlew.bat": cmd may not search the current folder,
// and the project path has spaces, so it is quoted for cmd explicitly.
const gradle = (arg) =>
  (isWin
    ? spawnSync(env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `""${join(androidDir, "gradlew.bat")}" ${arg}"`], {
        cwd: androidDir,
        env,
        stdio: "inherit",
        windowsVerbatimArguments: true,
      })
    : spawnSync(join(androidDir, "gradlew"), [arg], { cwd: androidDir, env, stdio: "inherit" })
  ).status ?? 1;

// One build at a time: two Gradle runs on the same android/ folder overwrite
// each other's intermediate files ("Supplied proguard configuration does not
// exist: ...aapt_rules.txt" and similar).
const lock = join(androidDir, ".build-apk.lock");
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, "utf8"));
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = pid !== process.pid;
  } catch {
    alive = false;
  }
  if (alive) {
    console.error(`Another APK build is already running (process ${pid}). Wait for it to finish, or close it, then try again.`);
    process.exit(1);
  }
}
writeFileSync(lock, String(process.pid));
process.on("exit", () => rmSync(lock, { force: true }));
process.on("SIGINT", () => process.exit(130));

// Always start from a clean app output: stop leftover Gradle daemons and
// delete the old build folders, so half-written files from an earlier or
// interrupted build can never break this one.
console.log("Clearing old build output…\n");
gradle("--stop");
rmSync(join(androidDir, "app", "build"), { recursive: true, force: true });
rmSync(join(androidDir, "build"), { recursive: true, force: true });

let status = gradle(task);
if (status !== 0) {
  // Most failures here come from half-written build output left by an
  // interrupted or overlapping earlier build. Stop the Gradle daemons, throw
  // away the app's build output and try once more from clean.
  console.warn(`\nGradle ${task} failed (exit ${status}). Cleaning the build output and retrying once…\n`);
  gradle("--stop");
  rmSync(join(androidDir, "app", "build"), { recursive: true, force: true });
  rmSync(join(androidDir, "build"), { recursive: true, force: true });
  status = gradle(task);
}
if (status !== 0) {
  console.error(`\nGradle ${task} failed again (exit ${status}).`);
  process.exit(status);
}

const apk = join(androidDir, "app", "build", "outputs", "apk", type, `app-${type}.apk`);
if (!existsSync(apk)) {
  console.error(`Build finished but ${apk} was not found.`);
  process.exit(1);
}

// A copy with a readable name at the project root, easy to share or adb install.
const outDir = join(root, "dist-apk");
mkdirSync(outDir, { recursive: true });
const named = join(outDir, `hosur-basket-partner-${type}.apk`);
copyFileSync(apk, named);

console.log(`\nAPK ready:\n  ${named}\nInstall on a connected phone/emulator:\n  adb install -r "${named}"`);

// Newest installed CMake 3.31+ (3.x: 4.x drops support some native libraries
// still rely on), installing 3.31.6 through sdkmanager if none is there, and
// written to android/local.properties as cmake.dir.
function useLongPathCmake(sdkDir) {
  const cmakeRoot = join(sdkDir, "cmake");
  const ok = (v) => /^3\.(3[1-9]|[4-9]\d)\./.test(v);
  const byVersion = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  const installed = () => (existsSync(cmakeRoot) ? readdirSync(cmakeRoot).filter(ok).sort(byVersion) : []);
  let found = installed();
  if (!found.length) {
    console.log("Installing CMake 3.31.6 (needed for long native build paths)…");
    const sdkmanager = join(sdkDir, "cmdline-tools", "latest", "bin", "sdkmanager.bat");
    spawnSync(env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `""${sdkmanager}" "cmake;3.31.6""`], {
      env,
      input: "y\n",
      stdio: ["pipe", "inherit", "inherit"],
      windowsVerbatimArguments: true,
    });
    found = installed();
    if (!found.length) {
      console.error('Could not install CMake 3.31.6. Install it in Android Studio > SDK Manager > SDK Tools > CMake ("Show Package Details").');
      process.exit(1);
    }
  }
  const dir = join(cmakeRoot, found[found.length - 1]);

  const props = join(androidDir, "local.properties");
  const lines = existsSync(props)
    ? readFileSync(props, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("cmake.dir="))
    : [];
  lines.push(`cmake.dir=${dir.replace(/\\/g, "\\\\").replace(/:/g, "\\:")}`);
  writeFileSync(props, `${lines.join("\n")}\n`);

  const reg = spawnSync("reg", ["query", "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem", "/v", "LongPathsEnabled"], { env, encoding: "utf8" });
  if (!/0x1\b/.test(reg.stdout || "")) {
    console.warn(
      "\nWarning: Windows long paths are off, so the C++ step may still fail. Enable them once from an admin PowerShell:\n" +
        "  Set-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem LongPathsEnabled 1\n",
    );
  }
  return dir;
}
