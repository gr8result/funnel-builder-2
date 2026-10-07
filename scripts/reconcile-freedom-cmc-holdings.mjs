import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { reconcileBrokerHoldings } from "../lib/freedom/brokerHoldingsSnapshot.js";

const snapshotPath = process.argv[2];
if (!snapshotPath) throw new Error("Supply a broker holdings snapshot JSON path; add --apply to persist.");
const target = path.resolve(process.env.FREEDOM_TRADE_STORE_PATH || "tmp/freedom-trades.json");
const original = await readFile(target, "utf8");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const previous = JSON.parse(original);
const now = new Date().toISOString();
const next = reconcileBrokerHoldings(previous, snapshot, now);
console.log(JSON.stringify({ updated: snapshot.holdings.map(row => ({ symbol: row.symbol, id: row.recordId })), archived: snapshot.archiveIds, totals: snapshot.totals }, null, 2));
if (previous.brokerPortfolioSnapshot?.id === snapshot.id) {
  console.log("Already reconciled; no write performed.");
} else if (process.argv.includes("--apply")) {
  const backupDir = path.join(path.dirname(target), "freedom-reconciliation-backups");
  await mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `before-${now.replace(/[:.]/g, "-")}.json`);
  await writeFile(backup, original, { flag: "wx" });
  const temporary = `${target}.${process.pid}.reconcile`;
  await writeFile(temporary, JSON.stringify(next, null, 2));
  if (await readFile(target, "utf8") !== original) throw new Error("Portfolio changed during reconciliation; refusing to overwrite it.");
  await rename(temporary, target);
  console.log(`Updated original records. Backup: ${backup}`);
} else {
  console.log("Preview only; no portfolio write performed.");
}
