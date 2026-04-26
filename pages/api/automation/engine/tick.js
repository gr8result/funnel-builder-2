// /pages/api/automation/engine/tick.js
// FULL REPLACEMENT — CLEAN RUN CREATION + PROPER EMAIL + BOOKING REMINDERS

import { createClient } from "@supabase/supabase-js";
import { processBookingReminders } from "../../../../lib/automation/processBookingReminders";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function nowIso() {
  return new Date().toISOString();
}

function clean(v) {
  return String(v ?? "").trim();
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v).toLowerCase());
}

async function recordVisit(supabase, flow_id, node_id, lead_id) {
  if (!flow_id || !node_id || !lead_id) return;

  await supabase
    .from("automation_flow_node_history")
    .upsert(
      {
        flow_id,
        node_id,
        lead_id,
        first_seen_at: nowIso(),
        last_seen_at: nowIso(),
      },
      { onConflict: "flow_id,node_id,lead_id" }
    );
}

function nextFrom(nodeId, edges) {
  const e = (edges || []).find((x) => x.source === nodeId);
  return e?.target || null;
}

export default async function handler(req, res) {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const flow_id =
    (req.body?.flow_id || req.query.flow_id || "").toString().trim();

  if (!flow_id) {
    return res.status(400).json({ ok: false });
  }

  try {
    const debug = [];

    const { data: flow } = await supabase
      .from("automation_flows")
      .select("nodes,edges")
      .eq("id", flow_id)
      .single();

    if (!flow) {
      return res.status(404).json({ ok: false });
    }

    const nodes =
      typeof flow.nodes === "string"
        ? JSON.parse(flow.nodes)
        : flow.nodes || [];

    const edges =
      typeof flow.edges === "string"
        ? JSON.parse(flow.edges)
        : flow.edges || [];

    const trigger = nodes.find((n) =>
      (n.type || "").toLowerCase().includes("trigger")
    );

    if (!trigger?.id) {
      return res.status(500).json({ ok: false });
    }

    // ========================================
    // CREATE RUNS FOR MEMBERS
    // ========================================
    const { data: members } = await supabase
      .from("automation_flow_members")
      .select("lead_id")
      .eq("flow_id", flow_id)
      .in("status", ["active", "pending"]);

    for (const m of members || []) {
      const { data: existing } = await supabase
        .from("automation_flow_runs")
        .select("id")
        .eq("flow_id", flow_id)
        .eq("lead_id", m.lead_id)
        .maybeSingle();

      if (existing) continue;

      await supabase.from("automation_flow_runs").insert({
        flow_id,
        lead_id: m.lead_id,
        current_node_id: trigger.id,
        status: "pending",
        available_at: nowIso(),
      });

      await recordVisit(supabase, flow_id, trigger.id, m.lead_id);
    }

    // ========================================
    // PROCESS RUNS
    // ========================================
    const { data: runs } = await supabase
      .from("automation_flow_runs")
      .select("*")
      .eq("flow_id", flow_id)
      .eq("status", "pending");

    for (const r of runs || []) {
      try {
        const node = nodes.find((n) => n.id === r.current_node_id);
        if (!node) continue;

        const nodeType = node.data?.type || node.type;

        // Move past trigger automatically
        if (nodeType === "trigger") {
          const next = nextFrom(node.id, edges);
          if (!next) continue;

          await supabase
            .from("automation_flow_runs")
            .update({
              current_node_id: next,
              available_at: nowIso(),
            })
            .eq("id", r.id);

          continue;
        }

        // ========================================
        // EMAIL NODE (PRODUCTION SAFE)
        // ========================================
        if ((nodeType || "").includes("email")) {
          const { data: lead } = await supabase
            .from("leads")
            .select("email")
            .eq("id", r.lead_id)
            .single();

          if (!lead?.email || !isEmail(lead.email)) {
            continue;
          }

          // Only queue if not already queued or sent
          const { data: existingQueue } = await supabase
            .from("automation_email_queue")
            .select("id")
            .eq("flow_id", flow_id)
            .eq("node_id", node.id)
            .eq("lead_id", r.lead_id)
            .maybeSingle();

          if (!existingQueue) {
            await supabase.from("automation_email_queue").insert({
              flow_id,
              node_id: node.id,
              lead_id: r.lead_id,
              to_email: lead.email,
              status: "queued",
              scheduled_at: nowIso(),
            });
          }

          const { data: sent } = await supabase
            .from("automation_email_sends")
            .select("id")
            .eq("flow_id", flow_id)
            .eq("node_id", node.id)
            .eq("lead_id", r.lead_id)
            .maybeSingle();

          if (!sent) continue;

          const next = nextFrom(node.id, edges);

          if (!next) {
            await supabase
              .from("automation_flow_runs")
              .update({ status: "done" })
              .eq("id", r.id);
          } else {
            await recordVisit(supabase, flow_id, next, r.lead_id);

            await supabase
              .from("automation_flow_runs")
              .update({
                current_node_id: next,
                available_at: nowIso(),
              })
              .eq("id", r.id);
          }

          continue;
        }
      } catch (e) {
        console.error("[TICK] Run error:", r.id, e);
      }
    }

    // ========================================
    // BOOKING REMINDERS (CENTRAL INTEGRATION)
    // ========================================
    await processBookingReminders();

    return res.json({ ok: true });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
}