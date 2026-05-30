#!/usr/bin/env node
// scripts/backfill-workspaces.cjs
//
// One-time migration: creates one workspace per existing user,
// makes them the owner, then stamps workspace_id on all their
// existing records across every CRM / module table.
//
// Run once:
//   node scripts/backfill-workspaces.cjs
//
// Safe to re-run — uses upsert/skip logic so it won't create duplicates.

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Tables that have a user_id column and need workspace_id stamped.
// Each entry: { table, userCol, extraMatch }
// extraMatch: additional .eq() filters (optional)
const USER_SCOPED_TABLES = [
  { table: "leads",          userCol: "user_id" },
  { table: "crm_stages",     userCol: "owner"   }, // some schemas use "owner"
  { table: "crm_tasks",      userCol: "user_id" },
  { table: "crm_calls",      userCol: "user_id" },
  { table: "lead_lists",     userCol: "user_id" },
  { table: "funnels",        userCol: "user_id" },
  { table: "email_campaigns",userCol: "user_id" },
  { table: "automations",    userCol: "user_id" },
  { table: "bookings",       userCol: "user_id" },
  { table: "communities",    userCol: "user_id" },
];

async function log(msg) {
  process.stdout.write(msg + "\n");
}

async function tableExists(tableName) {
  const { error } = await supabase
    .from(tableName)
    .select("id")
    .limit(1);
  // PostgREST returns a specific error code for missing tables
  if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
    return false;
  }
  return true;
}

async function columnExists(tableName, columnName) {
  // Try selecting just that column — if it errors with "column does not exist" we know
  const { error } = await supabase
    .from(tableName)
    .select(columnName)
    .limit(1);
  if (error && error.message?.includes(`column "${columnName}" does not exist`)) {
    return false;
  }
  if (error && error.message?.includes("does not exist")) {
    return false;
  }
  return true;
}

async function getAllUsers() {
  // Use Supabase admin to list all users
  let users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const batch = data?.users || [];
    users = users.concat(batch);
    if (batch.length < perPage) break;
    page++;
  }
  return users;
}

async function getOrCreateWorkspace(user) {
  // Check if this user already has a workspace they own
  const { data: existing } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existing?.workspace_id) {
    return existing.workspace_id;
  }

  // Create a workspace named after the user's email or display name
  const workspaceName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split("@")[0] : `user-${user.id.slice(0, 8)}`);

  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({
      name: workspaceName,
      owner_id: user.id,
      plan: "starter",
    })
    .select("id")
    .single();

  if (wsErr) throw new Error(`Failed to create workspace for ${user.email}: ${wsErr.message}`);

  // Add user as owner member
  const { error: memberErr } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: ws.id,
      user_id: user.id,
      role: "owner",
      status: "active",
    });

  if (memberErr) throw new Error(`Failed to add owner member for ${user.email}: ${memberErr.message}`);

  return ws.id;
}

async function backfillTable(tableName, userCol, workspaceId, userId) {
  // Fetch all rows for this user that have no workspace_id yet
  const { data: rows, error: fetchErr } = await supabase
    .from(tableName)
    .select("id")
    .eq(userCol, userId)
    .is("workspace_id", null);

  if (fetchErr) {
    // Table or column might not exist — skip silently
    if (
      fetchErr.message?.includes("does not exist") ||
      fetchErr.code === "42P01"
    ) {
      return { skipped: true };
    }
    throw fetchErr;
  }

  if (!rows || rows.length === 0) return { updated: 0 };

  const ids = rows.map((r) => r.id);

  // Update in batches of 200
  let totalUpdated = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const { error: updateErr } = await supabase
      .from(tableName)
      .update({ workspace_id: workspaceId })
      .in("id", batch);

    if (updateErr) {
      // If workspace_id column doesn't exist yet (migration not run), note it
      if (updateErr.message?.includes("workspace_id")) {
        return { skipped: true, reason: "workspace_id column missing — run SQL migration first" };
      }
      throw updateErr;
    }
    totalUpdated += batch.length;
  }

  return { updated: totalUpdated };
}

async function main() {
  log("=== Workspace Backfill Script ===\n");

  // Verify workspaces table exists (migration must have been run first)
  const hasWorkspaces = await tableExists("workspaces");
  if (!hasWorkspaces) {
    log("ERROR: 'workspaces' table does not exist.");
    log("Please run the SQL migration first:");
    log("  supabase/migrations/20260522_workspace_crm_refactor.sql\n");
    process.exit(1);
  }

  log("✓ workspaces table found\n");

  // Get all users
  log("Fetching all users...");
  let users;
  try {
    users = await getAllUsers();
  } catch (e) {
    log(`ERROR fetching users: ${e.message}`);
    process.exit(1);
  }
  log(`Found ${users.length} user(s)\n`);

  let totalWorkspacesCreated = 0;
  let totalRecordsUpdated = 0;

  for (const user of users) {
    const label = user.email || user.id;
    log(`─ Processing user: ${label}`);

    let workspaceId;
    try {
      workspaceId = await getOrCreateWorkspace(user);
      if (!workspaceId.includes("-")) {
        // basic check it looks like a UUID
        throw new Error("Invalid workspace ID returned");
      }
      log(`  workspace: ${workspaceId}`);
      totalWorkspacesCreated++;
    } catch (e) {
      log(`  ERROR creating workspace: ${e.message}`);
      continue;
    }

    // Backfill each table
    for (const { table, userCol } of USER_SCOPED_TABLES) {
      try {
        const result = await backfillTable(table, userCol, workspaceId, user.id);
        if (result.skipped) {
          log(`  ${table}: skipped (${result.reason || "table/column not found"})`);
        } else if (result.updated > 0) {
          log(`  ${table}: updated ${result.updated} row(s)`);
          totalRecordsUpdated += result.updated;
        }
        // No output if 0 — keeps logs clean
      } catch (e) {
        log(`  ${table}: ERROR — ${e.message}`);
      }
    }

    // Special case: crm_stages may use a different column name
    // Try "owner" column as well as "user_id"
    try {
      const hasOwnerCol = await columnExists("crm_stages", "owner");
      if (hasOwnerCol) {
        const result = await backfillTable("crm_stages", "owner", workspaceId, user.id);
        if (result.updated > 0) {
          log(`  crm_stages (owner col): updated ${result.updated} row(s)`);
          totalRecordsUpdated += result.updated;
        }
      }
    } catch {
      // ignore
    }

    log("");
  }

  log("=== Summary ===");
  log(`Workspaces created/confirmed : ${totalWorkspacesCreated}`);
  log(`Records stamped with workspace_id: ${totalRecordsUpdated}`);
  log("\nDone. All existing data is now workspace-scoped.");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
