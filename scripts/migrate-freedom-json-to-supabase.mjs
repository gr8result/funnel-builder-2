#!/usr/bin/env node
/**
 * Migrate Freedom's JSON store into Supabase (Stage 3).
 *
 *   node scripts/migrate-freedom-json-to-supabase.mjs --workspace <uuid> --user <uuid>
 *   node scripts/migrate-freedom-json-to-supabase.mjs --workspace <uuid> --user <uuid> --apply
 *
 * SAFETY PROPERTIES
 *
 *   - Dry run is the default. Nothing is written without --apply.
 *   - The JSON source is opened read-only and never written to. It stays the
 *     rollback material.
 *   - Idempotent. Rows are upserted on their existing id, so a second run
 *     updates in place and creates zero duplicates.
 *   - Existing ids are preserved verbatim, because records reference each other
 *     through them (sourceTradeId).
 *   - Ownership is never guessed. workspace_id and user_id must be supplied and
 *     are verified against workspace_members before anything is written.
 *   - Null entry prices stay null. Two live open positions genuinely have no
 *     known entry price and the script refuses to invent one.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  importToRow,
  positionToRow,
  snapshotToRow,
} from "../lib/freedom/freedomStoreSupabase.js";
import { POSITION_COLLECTIONS } from "../lib/freedom/freedomStoreBackend.js";

// ---------------------------------------------------------------------------

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  }
}

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : true;
}

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

function line(char = "-") { console.log(char.repeat(78)); }

// ---------------------------------------------------------------------------

async function main() {
  loadEnv();

  const sourcePath = arg("source", process.env.FREEDOM_TRADE_STORE_PATH
    || path.join(process.cwd(), "tmp", "freedom-trades.json"));
  const workspaceId = arg("workspace");
  const userId = arg("user");

  line("=");
  console.log(`FREEDOM JSON -> SUPABASE MIGRATION   [${DRY_RUN ? "DRY RUN - no writes" : "APPLY - WILL WRITE"}]`);
  line("=");

  if (!workspaceId || workspaceId === true || !userId || userId === true) {
    console.error("\nERROR: --workspace <uuid> and --user <uuid> are both required.");
    console.error("Ownership is never guessed: these rows are financial records and must be");
    console.error("assigned to a workspace deliberately.\n");
    process.exit(1);
  }

  // ---- source -------------------------------------------------------------
  if (!fs.existsSync(sourcePath)) {
    console.error(`\nERROR: source not found: ${sourcePath}\n`);
    process.exit(1);
  }
  // Hash the raw bytes, not a decoded string: the byte count and the character
  // count differ here (the file carries multi-byte characters), and a migration
  // audit trail should record the same number `md5sum` would.
  const bytes = fs.readFileSync(sourcePath);
  const raw = bytes.toString("utf8");
  const store = JSON.parse(raw);
  const { createHash } = await import("node:crypto");
  const md5 = createHash("md5").update(bytes).digest("hex");
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  console.log(`\nSOURCE      ${sourcePath}`);
  console.log(`  bytes     ${bytes.length}  (${raw.length} characters)`);
  console.log(`  MD5       ${md5}`);
  console.log(`  SHA-256   ${sha256}`);

  const shortTerm = store.shortTermTrades || [];
  const longTerm = store.longTermHoldings || [];
  const archived = store.archivedHoldings || [];
  const imports = store.tradeImports || [];
  const snapshotHistory = store.brokerPortfolioSnapshotHistory || [];
  const currentSnapshot = store.brokerPortfolioSnapshot || null;

  console.log("\nSOURCE COUNTS");
  console.log(`  shortTermTrades          ${shortTerm.length}  (pending ${shortTerm.filter(t => t.status === "pending").length}, open ${shortTerm.filter(t => t.status === "open").length})`);
  console.log(`  longTermHoldings         ${longTerm.length}`);
  console.log(`  archivedHoldings         ${archived.length}`);
  console.log(`  tradeImports             ${imports.length}`);
  console.log(`  brokerPortfolioSnapshot  ${currentSnapshot ? 1 : 0} current, ${snapshotHistory.length} in history`);

  // ---- connect ------------------------------------------------------------
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("\nERROR: Supabase URL and service role key are required.\n");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log(`\nDESTINATION ${url.replace(/https:\/\/([a-z0-9]+).*/, "project $1")}`);

  // ---- verify ownership ---------------------------------------------------
  const membership = await db
    .from("workspace_members")
    .select("workspace_id,user_id,role,status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership.error) {
    console.error(`\nERROR verifying membership: ${membership.error.message}\n`);
    process.exit(1);
  }
  if (!membership.data) {
    console.error(`\nERROR: user ${userId} is not a member of workspace ${workspaceId}.`);
    console.error("Refusing to assign Freedom records to a workspace the user does not belong to.\n");
    process.exit(1);
  }

  const workspace = await db.from("workspaces").select("id,name,plan").eq("id", workspaceId).maybeSingle();
  console.log("\nRESOLVED OWNERSHIP");
  console.log(`  workspace_id  ${workspaceId}  (${workspace.data?.name ?? "?"}, plan ${workspace.data?.plan ?? "?"})`);
  console.log(`  user_id       ${userId}`);
  console.log(`  membership    role=${membership.data.role}, status=${membership.data.status}  VERIFIED`);

  // ---- build rows ---------------------------------------------------------
  const ctx = { workspaceId, userId };
  const positionRows = [];
  for (const [collection, kind] of Object.entries(POSITION_COLLECTIONS)) {
    for (const record of store[collection] || []) {
      if (!record?.id) {
        console.error(`\nERROR: a ${kind} record has no id. Refusing to migrate an unidentifiable record.\n`);
        process.exit(1);
      }
      positionRows.push(positionToRow(record, kind, ctx));
    }
  }
  const importRows = imports.filter(r => r?.id).map(r => importToRow(r, ctx));

  const snapshotById = new Map();
  for (const record of snapshotHistory) if (record?.id) snapshotById.set(String(record.id), record);
  if (currentSnapshot?.id) snapshotById.set(String(currentSnapshot.id), currentSnapshot);
  const snapshotRows = [...snapshotById.entries()].map(([id, record]) =>
    snapshotToRow(record, { ...ctx, isCurrent: currentSnapshot?.id != null && String(currentSnapshot.id) === id }));

  console.log("\nDESTINATION MAPPING");
  console.log(`  freedom_positions         ${positionRows.length} rows`);
  for (const [collection, kind] of Object.entries(POSITION_COLLECTIONS)) {
    console.log(`      kind='${kind}'`.padEnd(30) + `${(store[collection] || []).length}`);
  }
  console.log(`  freedom_trade_imports     ${importRows.length} rows`);
  console.log(`  freedom_broker_snapshots  ${snapshotRows.length} rows (${snapshotRows.filter(r => r.is_current).length} current)`);
  console.log(`  freedom_position_events   0 rows (order history stays inline on its position)`);

  // ---- records ------------------------------------------------------------
  console.log("\nRECORDS TO BE WRITTEN");
  console.log("  " + "id".padEnd(30) + "kind".padEnd(12) + "sym".padEnd(7) + "qty".padEnd(8) + "entry_price".padEnd(13) + "status");
  for (const row of positionRows) {
    console.log("  " + String(row.id).slice(0, 29).padEnd(30) + String(row.kind).padEnd(12)
      + String(row.symbol).padEnd(7) + String(row.quantity ?? "-").padEnd(8)
      + (row.entry_price === null ? "NULL" : String(row.entry_price)).padEnd(13)
      + String(row.status ?? "-"));
  }

  // ---- null entry prices --------------------------------------------------
  const nulls = positionRows.filter(r => r.entry_price === null);
  console.log(`\nNULL entry_price: ${nulls.length} record(s) - these are legitimate and MUST stay NULL`);
  for (const row of nulls) {
    console.log(`  ${String(row.symbol).padEnd(7)} kind=${String(row.kind).padEnd(11)} status=${String(row.status ?? "-").padEnd(9)} purchase_price=${row.purchase_price ?? "NULL"}`);
  }

  // ---- conflict detection -------------------------------------------------
  const ids = positionRows.map(r => r.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    console.error(`\nERROR: duplicate ids within the source: ${[...new Set(dupes)].join(", ")}\n`);
    process.exit(1);
  }

  const existing = await db.from("freedom_positions").select("id,workspace_id").in("id", ids.length ? ids : ["__none__"]);
  if (existing.error && existing.error.code !== "PGRST205") {
    console.error(`\nERROR checking existing rows: ${existing.error.message}\n`);
    process.exit(1);
  }
  const already = existing.data || [];
  const foreign = already.filter(r => r.workspace_id !== workspaceId);

  console.log("\nCONFLICT DETECTION");
  console.log(`  ids already present in destination : ${already.length}${already.length ? "  (these will be UPDATED in place, not duplicated)" : ""}`);
  if (foreign.length) {
    console.error(`  *** ${foreign.length} id(s) already belong to a DIFFERENT workspace. Refusing. ***`);
    foreign.forEach(r => console.error(`      ${r.id} -> ${r.workspace_id}`));
    process.exit(1);
  }
  console.log(`  cross-workspace id collisions      : 0`);

  // ---- apply --------------------------------------------------------------
  if (DRY_RUN) {
    line();
    console.log("DRY RUN COMPLETE. Nothing was written.");
    console.log("Re-run with --apply to perform the migration.");
    line();
    return;
  }

  line();
  console.log("APPLYING...");

  if (positionRows.length) {
    const { error } = await db.from("freedom_positions").upsert(positionRows, { onConflict: "id" });
    if (error) { console.error(`  freedom_positions FAILED: ${error.message}`); process.exit(1); }
    console.log(`  freedom_positions         ${positionRows.length} upserted`);
  }
  if (importRows.length) {
    const { error } = await db.from("freedom_trade_imports").upsert(importRows, { onConflict: "id" });
    if (error) { console.error(`  freedom_trade_imports FAILED: ${error.message}`); process.exit(1); }
    console.log(`  freedom_trade_imports     ${importRows.length} upserted`);
  }
  if (snapshotRows.length) {
    const clear = await db.from("freedom_broker_snapshots")
      .update({ is_current: false }).eq("workspace_id", workspaceId).eq("is_current", true);
    if (clear.error) { console.error(`  snapshot flag reset FAILED: ${clear.error.message}`); process.exit(1); }
    const { error } = await db.from("freedom_broker_snapshots").upsert(snapshotRows, { onConflict: "id" });
    if (error) { console.error(`  freedom_broker_snapshots FAILED: ${error.message}`); process.exit(1); }
    console.log(`  freedom_broker_snapshots  ${snapshotRows.length} upserted`);
  }

  // ---- verify -------------------------------------------------------------
  console.log("\nVERIFYING DESTINATION");
  const check = async (table, expected) => {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId);
    if (error) { console.error(`  ${table}: ERROR ${error.message}`); return false; }
    const ok = count === expected;
    console.log(`  ${table.padEnd(26)} ${count} (expected ${expected})  ${ok ? "OK" : "*** MISMATCH ***"}`);
    return ok;
  };
  let allOk = true;
  allOk = await check("freedom_positions", positionRows.length) && allOk;
  allOk = await check("freedom_trade_imports", importRows.length) && allOk;
  allOk = await check("freedom_broker_snapshots", snapshotRows.length) && allOk;

  const nullCheck = await db.from("freedom_positions")
    .select("symbol,entry_price").eq("workspace_id", workspaceId).is("entry_price", null);
  console.log(`  NULL entry_price rows      ${(nullCheck.data || []).length} (expected ${nulls.length}): ${(nullCheck.data || []).map(r => r.symbol).sort().join(", ") || "-"}`);
  if ((nullCheck.data || []).length !== nulls.length) allOk = false;

  console.log(`\nSOURCE UNCHANGED: ${createHash("md5").update(fs.readFileSync(sourcePath)).digest("hex") === md5 ? "YES" : "*** NO ***"}`);

  line();
  console.log(allOk ? "MIGRATION COMPLETE - all counts verified." : "MIGRATION FINISHED WITH MISMATCHES - investigate before switching backend.");
  line();
  if (!allOk) process.exit(1);
}

main().catch((error) => {
  console.error("\nMIGRATION FAILED:", error?.message || error);
  process.exit(1);
});
