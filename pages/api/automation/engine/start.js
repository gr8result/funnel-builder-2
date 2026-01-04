// /pages/api/automation/engine/start.js
// FULL REPLACEMENT
//
// ✅ Creates automation runs for members already inside a flow
// ✅ You can start the whole flow, or just 1 lead
// ✅ Safe: won't duplicate runs if one already exists
//
// POST JSON:
//  { flow_id: "uuid-of-flow" }                -> starts everyone in the flow
//  { flow_id: "uuid-of-flow", lead_id: "..." }-> starts only that lead
//
// NOTE: This does NOT "tick" the flow. It creates runs (status=active).
// Your tick endpoint advances them.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function nowIso() {
  return new Date().toISOString();
}

// Try common member tables (because your project has evolved a lot)
async function loadMemberLeadIds(flow_id) {
  // 1) automation_flow_members
  {
    const { data, error } = await supabase
      .from("automation_flow_members")
      .select("lead_id")
      .eq("flow_id", flow_id);

    if (!error && Array.isArray(data)) {
      const ids = data.map((r) => r.lead_id).filter(Boolean);
      return { leadIds: ids, table: "automation_flow_members" };
    }
  }

  // 2) automation_flow_enrollments
  {
    const { data, error } = await supabase
      .from("automation_flow_enrollments")
      .select("lead_id")
      .eq("flow_id", flow_id);

    if (!error && Array.isArray(data)) {
      const ids = data.map((r) => r.lead_id).filter(Boolean);
      return { leadIds: ids, table: "automation_flow_enrollments" };
    }
  }

  // 3) fallback: no members table found
  throw new Error(
    "Could not find a members table. Expected automation_flow_members or automation_flow_enrollments."
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ ok: false, error: "POST only" });

    const { flow_id, lead_id } = req.body || {};
    if (!flow_id)
      return res.status(400).json({ ok: false, error: "flow_id required" });

    // load members already added to this flow
    let leadIds = [];
    let table = "";
    if (lead_id) {
      leadIds = [lead_id];
      table = "(single lead)";
    } else {
      const out = await loadMemberLeadIds(flow_id);
      leadIds = out.leadIds;
      table = out.table;
    }

    if (!leadIds.length) {
      return res.json({
        ok: true,
        started: 0,
        skipped_existing: 0,
        note: "No members found in this flow yet.",
        members_table: table,
      });
    }

    let started = 0;
    let skipped_existing = 0;

    // Create runs if missing
    // We treat a "run" as unique by (flow_id + lead_id)
    for (const lid of leadIds) {
      // check if run already exists and is not completed/cancelled
      const { data: existing, error: exErr } = await supabase
        .from("automation_flow_runs")
        .select("id,status")
        .eq("flow_id", flow_id)
        .eq("lead_id", lid)
        .in("status", ["active", "waiting_event"])
        .maybeSingle();

      if (!exErr && existing?.id) {
        skipped_existing++;
        continue;
      }

      const { error: insErr } = await supabase
        .from("automation_flow_runs")
        .insert([
          {
            flow_id,
            lead_id: lid,
            status: "active",
            available_at: nowIso(),
            current_node_id: null, // start at trigger
            created_at: nowIso(),
            updated_at: nowIso(),
          },
        ]);

      if (insErr) {
        // If you have a unique constraint and a race happens, just treat as skipped
        const msg = String(insErr.message || "");
        if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
          skipped_existing++;
          continue;
        }
        throw insErr;
      }

      started++;
    }

    return res.json({
      ok: true,
      members_table: table,
      total_members_targeted: leadIds.length,
      started,
      skipped_existing,
      note:
        "Runs created. Now call /api/automation/engine/tick to advance and send.",
    });
  } catch (err) {
    console.error("engine/start error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
}
