import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { importNativeBrokerPosition } from "../lib/freedom/importNativeBrokerPosition.js";

const target = path.resolve(process.env.FREEDOM_TRADE_STORE_PATH || "tmp/freedom-trades.json");
const original = await readFile(target, "utf8");
const previous = JSON.parse(original);
const snapshot = JSON.parse(await readFile("data/freedom/tiger-tjgc-2026-09-06.json", "utf8"));
const at = new Date().toISOString();
const next = importNativeBrokerPosition(previous, snapshot, at);
if (JSON.stringify(previous) === JSON.stringify(next)) {
  console.log("Position already imported; no write performed.");
} else if (process.argv.includes("--apply")) {
  const backupDir = path.join(path.dirname(target), "freedom-reconciliation-backups");
  await mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `before-tiger-${at.replace(/[:.]/g, "-")}.json`);
  await writeFile(backup, original, { flag: "wx" });
  const temporary = `${target}.${process.pid}.reconcile`;
  await writeFile(temporary, JSON.stringify(next, null, 2));
  if (await readFile(target, "utf8") !== original) throw new Error("Portfolio changed; refusing overwrite");
  await rename(temporary, target);
  console.log(JSON.stringify({ id: `broker_${snapshot.id}`, symbol: snapshot.symbol, backup }));
} else console.log("Preview passed. One new TJGC position; existing records preserved. Use --apply to persist.");
