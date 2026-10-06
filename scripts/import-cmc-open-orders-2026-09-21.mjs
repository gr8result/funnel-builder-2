// One-off import of three real CMC Invest open (unfilled) limit orders into Freedom,
// using the existing broker-import pipeline (lib/freedom/tradeImport.js -> extractBrokerImport,
// lib/freedom/tradeStore.js -> importReviewedTrades) exactly as the "Import Open Orders" panel
// on pages/freedom/my-trades.js does for a pasted CMC order list. No new import mechanism is
// created; this script only supplies the text CMC would show and confirms the reviewed rows,
// the same two steps a human does through the UI.
//
// Usage:
//   node scripts/import-cmc-open-orders-2026-09-21.mjs            (preview only, no writes)
//   node scripts/import-cmc-open-orders-2026-09-21.mjs --apply    (writes to the active backend)
//
// Idempotent: importReviewedTrades() de-dupes on importFingerprint (broker|symbol|exchange|side
// |quantity|limitPrice|orderDate|expiry-or-GTC), so re-running with --apply after the first
// successful run reports "already_imported" for all three rows instead of creating duplicates.

import fs from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { extractBrokerImport } = await import("../lib/freedom/tradeImport.js");
const { importReviewedTrades, listShortTermTrades, listLongTermHoldings } = await import("../lib/freedom/tradeStore.js");
const { isSupabaseBackend, backendName } = await import("../lib/freedom/freedomStoreBackend.js");

const COMPANY_NAMES = {
  SEMI: "Global X Semiconductor ETF",
  FANG: "Global X FANG+ ETF",
  AINF: "Global X Artificial Intelligence Infrastructure ETF",
};

// Written in the same "Symbol - Side - quantity N - limit A$X - Good Till Cancelled -
// status Waiting for Entry" shape already covered by test/freedom-trade-import.test.mjs's
// CMC fixture, so this goes through the real parser rather than hand-built records.
const CMC_OPEN_ORDERS_TEXT = `
CMC Markets
SEMI - BUY - quantity 580 - limit A$33.50 - Good Till Cancelled - status Waiting for Entry
FANG - BUY - quantity 477 - limit A$33.50 - Good Till Cancelled - status Waiting for Entry
AINF - BUY - quantity 883 - limit A$16.50 - Good Till Cancelled - status Waiting for Entry
`;

const EXPECTED = {
  SEMI: { quantity: 580, limitPrice: 33.5, exchange: "ASX", currency: "AUD" },
  FANG: { quantity: 477, limitPrice: 33.5, exchange: "ASX", currency: "AUD" },
  AINF: { quantity: 883, limitPrice: 16.5, exchange: "ASX", currency: "AUD" },
};

// Freedom is entitlement-gated to a single developer account (lib/adminUsers.js
// isDeveloperEmail), not by workspace membership - the "support" workspace behind
// FREEDOM_WORKSPACE_ID has hundreds of unrelated members (customer accounts visible
// to support staff), so workspace_members cannot be used to resolve tenancy here.
// The workspace's OWNER is the account Freedom actually belongs to; this mirrors
// authoriseFreedomRequest()'s platform-admin path in platform-core/api-guards/
// freedomApiGuard.js, which uses FREEDOM_WORKSPACE_ID with the caller's own
// (developer) user id, not a membership lookup.
async function resolveSupabaseTenancy() {
  const workspaceId = process.env.FREEDOM_WORKSPACE_ID;
  if (!workspaceId) throw new Error("FREEDOM_WORKSPACE_ID is not configured; cannot resolve a workspace to write to.");
  const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");
  const { isDeveloperEmail } = await import("../lib/adminUsers.js");
  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from("workspaces")
    .select("id, owner_id")
    .eq("id", workspaceId)
    .single();
  if (workspaceError) throw workspaceError;
  if (!workspace?.owner_id) throw new Error(`Workspace ${workspaceId} has no owner_id.`);
  const { data: owner, error: ownerError } = await supabaseAdmin.auth.admin.getUserById(workspace.owner_id);
  if (ownerError) throw ownerError;
  if (!isDeveloperEmail(owner?.user?.email)) {
    throw new Error(`Workspace ${workspaceId} owner (${owner?.user?.email}) is not a recognised Freedom developer account; refusing to write.`);
  }
  return { workspaceId, userId: workspace.owner_id, ownerEmail: owner.user.email };
}

function buildRows() {
  const extracted = extractBrokerImport({ sourceType: "text", text: CMC_OPEN_ORDERS_TEXT });
  if (extracted.rows.length !== 3) {
    throw new Error(`Expected 3 parsed open orders, got ${extracted.rows.length}: ${JSON.stringify(extracted.rows)}`);
  }
  const rows = extracted.rows.map((row) => {
    const expected = EXPECTED[row.symbol];
    if (!expected) throw new Error(`Unexpected symbol parsed from CMC text: ${row.symbol}`);
    if (
      row.quantity !== expected.quantity ||
      row.limitPrice !== expected.limitPrice ||
      row.exchange !== expected.exchange ||
      row.currency !== expected.currency ||
      row.side !== "BUY" ||
      row.classification !== "PENDING_BUY_ORDER" ||
      row.goodTillCancelled !== true
    ) {
      throw new Error(`Parsed row for ${row.symbol} does not match the exact CMC order details: ${JSON.stringify(row)}`);
    }
    return {
      ...row,
      checked: true,
      filledQuantity: 0,
      companyName: COMPANY_NAMES[row.symbol],
      notes: "Open CMC Invest limit order, entered manually in Freedom (no live CMC API/sync exists yet).",
    };
  });
  return rows;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = buildRows();
  const totalReserved = rows.reduce((sum, row) => sum + row.quantity * row.limitPrice, 0);

  console.log(`Backend: ${backendName()}`);
  console.log(`Parsed ${rows.length} open orders. Total reserved value: $${totalReserved.toFixed(2)} AUD.`);
  rows.forEach((row) => {
    console.log(`  ${row.symbol}: ${row.quantity} @ A$${row.limitPrice} = A$${(row.quantity * row.limitPrice).toFixed(2)} (fingerprint ${row.importFingerprint})`);
  });

  if (!apply) {
    console.log("\nPreview only (pass --apply to write). No changes made.");
    return;
  }

  let restore = () => {};
  if (isSupabaseBackend()) {
    const tenancy = await resolveSupabaseTenancy();
    console.log(`\nWriting to Supabase workspace ${tenancy.workspaceId} (user ${tenancy.userId}, ${tenancy.ownerEmail}).`);
    const { setFreedomStoreContext } = await import("../lib/freedom/freedomStoreSupabase.js");
    restore = setFreedomStoreContext(tenancy);
  }

  try {
    const beforeShort = await listShortTermTrades();
    const beforeLong = await listLongTermHoldings();

    const result = await importReviewedTrades(rows);
    console.log("\nImport reports:");
    console.log(JSON.stringify(result.reports, null, 2));

    const afterShort = await listShortTermTrades();
    const afterLong = await listLongTermHoldings();

    // Every pre-existing record, byte for byte, must be untouched by this import.
    const beforeById = new Map(beforeShort.map((row) => [row.id, row]));
    let unchanged = 0;
    for (const row of afterShort) {
      if (!beforeById.has(row.id)) continue;
      if (JSON.stringify(row) !== JSON.stringify(beforeById.get(row.id))) {
        throw new Error(`Pre-existing short-term trade ${row.id} (${row.symbol}) was modified by this import.`);
      }
      unchanged += 1;
    }
    if (afterLong.length !== beforeLong.length) {
      throw new Error("Long-term holdings count changed; this import must never touch long-term holdings.");
    }

    const ours = afterShort.filter((row) => rows.some((r) => r.importFingerprint === row.importFingerprint));
    console.log(`\nVerified: ${unchanged} pre-existing short-term trades unchanged, ${beforeLong.length} long-term holdings unchanged.`);
    console.log(`Verified: ${ours.length} of 3 target orders present, all with status="pending": ${ours.every((r) => r.status === "pending")}`);
    console.log(`Verified: none has status="open" or status="closed": ${ours.every((r) => r.status === "pending")}`);
    const reservedNow = ours.reduce((sum, row) => sum + row.entryPrice * row.quantity, 0);
    console.log(`Verified: reserved total for the 3 orders = $${reservedNow.toFixed(2)} AUD (expected $${totalReserved.toFixed(2)}).`);
  } finally {
    restore();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
