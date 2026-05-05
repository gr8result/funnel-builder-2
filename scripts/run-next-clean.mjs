import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const mode = String(process.argv[2] || "dev").toLowerCase();
const cleanDist = process.argv.includes("--clean");

if (!["dev", "build", "start"].includes(mode)) {
  console.error(`Unsupported mode: ${mode}`);
  process.exit(1);
}

const workspaceRoot = process.cwd();
const nextBin = path.join(workspaceRoot, "node_modules", "next", "dist", "bin", "next");
const distDir = mode === "dev" ? ".next-dev" : ".next-build";
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

const existingLock = readLock();
if (existingLock?.pid && processExists(existingLock.pid)) {
  console.error(
    `Another Next ${mode} process is already running for ${distDir} (pid ${existingLock.pid}). Stop it first or use the existing server.`
  );
  process.exit(1);
}

if (existingLock) removeLock();

if (cleanDist) {
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log(`Removed ${nextDir}`);
  } catch (error) {
    console.warn(`Could not remove ${nextDir}: ${error?.message || error}`);
  }
}

const child = spawn(process.execPath, [nextBin, mode], {
  cwd: workspaceRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_DIST_DIR: distDir,
  },
});

try {
  fs.writeFileSync(lockFile, JSON.stringify({
    pid: child.pid,
    mode,
    distDir,
    startedAt: new Date().toISOString(),
  }, null, 2));
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