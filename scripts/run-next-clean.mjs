import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const mode = String(process.argv[2] || "dev").toLowerCase();
// Only wipe the dist dir when explicitly asked (npm run dev:fresh passes --clean).
// `dev` used to wipe unconditionally, which deleted .next-dev out from under an
// already-running dev server sharing that directory. The running server then threw
// unhandled exceptions on every route whose chunks had vanished, surfacing as plain
// "Internal Server Error" 500s that "fixed themselves" on restart.
const cleanDist = process.argv.includes("--clean");
const isVercelBuild = Boolean(process.env.VERCEL) || process.env.CI === "true";

if (!["dev", "build", "start"].includes(mode)) {
  console.error(`Unsupported mode: ${mode}`);
  process.exit(1);
}

const workspaceRoot = process.cwd();
const distDir = mode === "dev" ? ".next-dev" : (isVercelBuild ? ".next" : ".next-build");
const nextDir = path.join(workspaceRoot, distDir);
const lockFile = path.join(workspaceRoot, `${distDir}.lock.json`);

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(lockFile, "utf8"));
  } catch {
    return null;
  }
}

function removeLock(expectedPid = null) {
  try {
    const current = readLock();
    if (!current) return;
    if (expectedPid !== null && current.pid !== expectedPid) return;
    fs.rmSync(lockFile, { force: true });
  } catch {}
}

function writeLock(pid, extra = {}) {
  fs.writeFileSync(lockFile, JSON.stringify({
    pid,
    mode,
    distDir,
    startedAt: new Date().toISOString(),
    ...extra,
  }, null, 2));
}

function acquireStartupLock() {
  try {
    const fd = fs.openSync(lockFile, "wx");
    try {
      fs.writeFileSync(fd, JSON.stringify({
        pid: process.pid,
        mode,
        distDir,
        status: "starting",
        startedAt: new Date().toISOString(),
      }, null, 2));
    } finally {
      fs.closeSync(fd);
    }
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    return false;
  }
}

const existingLock = readLock();

// Whether another dev server is really running is decided by the port, not by the
// lock file. A lock can be deleted, or its wrapper can die while the server keeps
// serving; and on Windows process.kill(pid, 0) also succeeds for a *recycled* pid,
// which made a stale lock permanently block startup. Two dev servers share one dist
// dir, so a genuine second start would delete the first one's chunks and make it
// return 500s - that is the case worth blocking.
async function devPortInUse() {
  if (mode !== "dev") return false;
  const port = Number(process.env.PORT) || 3000;
  const net = await import("net");
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (result) => { socket.destroy(); resolve(result); };
    socket.setTimeout(600);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

if (await devPortInUse()) {
  const port = Number(process.env.PORT) || 3000;
  const owner = existingLock?.pid ? ` (lock pid ${existingLock.pid})` : "";
  console.error(
    `A dev server is already serving port ${port} for this workspace and shares ${distDir}${owner}.\n` +
    `Starting another one would delete its build output and make it return HTTP 500.\n` +
    `Use the running server, or stop it first (then 'npm run dev:fresh' if you need a clean build).`
  );
  process.exit(1);
}

// Port is free, so nothing can be harmed: any lock left behind is stale.
if (existingLock) {
  if (existingLock.pid && processExists(existingLock.pid)) {
    console.warn(
      `Clearing a stale ${distDir} lock (pid ${existingLock.pid} is no longer serving port ${Number(process.env.PORT) || 3000}).`
    );
  }
  removeLock();
}

if (!acquireStartupLock()) {
  const current = readLock();
  const owner = current?.pid ? ` (lock pid ${current.pid})` : "";
  console.error(
    `A ${mode} process is already starting or running for this workspace and shares ${distDir}${owner}.\n` +
    `Starting another one could leave ${distDir} half-written and make Next return HTTP 500.\n` +
    `Use the running process, or stop it first.`
  );
  process.exit(1);
}

if (cleanDist) {
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log(`Removed ${nextDir}`);
  } catch (error) {
    console.warn(`Could not remove ${nextDir}: ${error?.message || error}`);
  }
}

const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, mode], {
  cwd: workspaceRoot,
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    NEXT_DIST_DIR: distDir,
  },
});

try {
  writeLock(child.pid, { status: "running" });
} catch (error) {
  console.error(`Failed to create lock file ${lockFile}: ${error?.message || error}`);
  child.kill();
  process.exit(1);
}

function shutdown(signal = "SIGTERM") {
  removeLock(child.pid);
  if (!child.killed) child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  removeLock(child.pid);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  removeLock(child.pid);
  console.error(`Failed to start next ${mode}: ${error?.message || error}`);
  process.exit(1);
});
