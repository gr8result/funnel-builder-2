// /pages/api/automation/engine/enroll.js
// FULL REPLACEMENT
//
// ✅ Bulletproof enrollment
// ✅ Supports event-based triggers AND manual forced enrollment
// ✅ Creates BOTH: membership + run (run is what makes it actually execute)
//
// POST JSON examples:
//
// 1) Website/FB form adds lead to a list:
// { lead_id, list_id, event: "list_subscribed" }
//
// 2) Lead created (any source):
// { lead_id, event: "lead_created" }
//
// 3) Manual "Send to Automation" from CRM:
// { lead_id, flow_id, event: "crm_sent" }
//
// 4) Manual bulk enrollment (add list to a flow):
// { lead_id, flow_id, event: "manual" }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const NOW = () => new Date().toISOString();

function safeJson(x, fallback) {
  try {
    if (Array.isArray(x)) return x;
    if (typeof x === "string") return JSON.parse(x || "[]");
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

async function insertMembership(flow_id, lead_id, source = "event") {
  const candidates = ["automation_flow_members", "automation_flow_enrollments"];

  for (const t of candidates) {
    const { error } = await supabase.from(t).insert([
      {
        flow_id,
        lead_id,
        source,
        status: "active",
        created_at: NOW(),
        updated_at: NOW(),
      },
    ]);

    if (!error) return { ok: true, table: t };

    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: true, table: t, note: "already member" };
    }
    if (msg.includes("relation") && msg.includes("does not exist")) continue;
    // keep trying next candidate
  }

  return { ok: false };
}

async function ensureRun(flow_id, lead_id) {
  // Prevent duplicates (active/waiting)
  const { data: existing, error: exErr } = await supabase
    .from("automation_flow_runs")
    .select("id,status")
    .eq("flow_id", flow_id)
    .eq("lead_id", lead_id)
    .in("status", ["active", "waiting_event"])
    .maybeSingle();

  if (!exErr && existing?.id) {
    return { ok: true, created: false, run_id: existing.id, status: existing.status };
  }

  const { data: ins, error: insErr } = await supabase
    .from("automation_flow_runs")
    .insert([
      {
        flow_id,
        lead_id,
        status: "active",
        available_at: NOW(),
        current_node_id: null, // start at trigger
        created_at: NOW(),
        updated_at: NOW(),
      },
    ])
    .select("id,status")
    .maybeSingle();

  if (insErr) {
    const msg = String(insErr.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: true, created: false, note: "race duplicate" };
    }
    throw insErr;
  }

  return { ok: true, created: true, run_id: ins?.id, status: ins?.status };
}

function flowMatchesEvent(flow, { event, list_id }) {
  const nodes = safeJson(flow.nodes, []);
  const e = String(event || "").trim();

  // Find trigger node
  const trig = nodes.find((n) => n?.type === "trigger");
  if (!trig) return false;

  const d = trig.data || {};
  const t = String(d.triggerType || "").trim();

  // ✅ list_subscribed matches triggerType=list_subscribed AND listId equals list_id
  if (e === "list_subscribed") {
    if (t !== "list_subscribed") return false;
    const nodeListId = String(d.listId || "");
    return nodeListId && String(list_id || "") && nodeListId === String(list_id);
  }

  // ✅ lead_created matches triggerType=lead_created
  if (e === "lead_created") {
    return t === "lead_created";
  }

  // ✅ crm_sent matches triggerType=crm_sent
  if (e === "crm_sent") {
    return t === "crm_sent";
  }

  // Unknown event -> no match
  return false;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ ok: false, error: "POST only" });

    const { lead_id, flow_id, event, list_id } = req.body || {};
    if (!lead_id) return res.status(400).json({ ok: false, error: "lead_id required" });

    // 1) Forced/manual enrollment into a specific flow (bulk add, CRM send, admin actions)
    if (flow_id) {
      await insertMembership(flow_id, lead_id, event || "manual");
      const run = await ensureRun(flow_id, lead_id);

      return res.json({
        ok: true,
        mode: "forced",
        flow_id,
        run,
      });
    }

    // 2) Event-based enrollment (match flows)
    const ev = String(event || "").trim();
    if (!ev) {
      return res.status(400).json({
        ok: false,
        error: "event required when flow_id is not provided",
        hint: 'Use { event:"list_subscribed", list_id } or { event:"lead_created" }',
      });
    }

    const { data: flows, error } = await supabase
      .from("automation_flows")
      .select("id,name,nodes,is_standard,user_id");

    if (error) throw error;

    const matching = (flows || []).filter((f) =>
      flowMatchesEvent(f, { event: ev, list_id })
    );

    if (!matching.length) {
      return res.json({
        ok: true,
        enrolled_flows: 0,
        note:
          ev === "list_subscribed"
            ? "No flows matched this list trigger. Make sure Trigger is 'Subscribed to List' and a list is selected."
            : "No flows matched this event trigger.",
      });
    }

    let enrolled_flows = 0;
    let runs_created = 0;
    let runs_existing = 0;

    for (const f of matching) {
      await insertMembership(f.id, lead_id, ev);
      const run = await ensureRun(f.id, lead_id);

      enrolled_flows++;
      if (run.created) runs_created++;
      else runs_existing++;
    }

    return res.json({
      ok: true,
      mode: "event",
      event: ev,
      enrolled_flows,
      runs_created,
      runs_existing,
    });
  } catch (err) {
    console.error("enroll error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
