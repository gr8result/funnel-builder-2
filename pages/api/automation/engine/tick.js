// /pages/api/automation/engine/tick.js
// FULL REPLACEMENT
//
// ✅ Server-side automation engine tick
// ✅ No Run Now button needed
// ✅ Ensures all active flow members are queued
// ✅ Walks trigger -> next nodes and queues emails to email_campaign_queue
//
// NOTES:
// - This assumes you have:
//   - automation_flows (id, nodes, edges, user_id)
//   - automation_flow_members (flow_id, lead_id, user_id, status)
//   - leads (id, user_id, email, name, phone)
//   - email_campaign_queue (lead_id, template_id, scheduled_at, user_id, meta?)
// - This creates/uses a table "automation_queue" if it exists.
//   If it does NOT exist, we will run in "stateless" mode (still queues emails),
//   but dedupe is weaker (best to create automation_queue table later).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isMissingTable(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    err?.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("relation")
  );
}

async function hasAutomationQueueTable() {
  try {
    const { error } = await supabaseAdmin.from("automation_queue").select("id").limit(1);
    if (error) {
      if (isMissingTable(error)) return false;
      return false;
    }
    return true;
  } catch (e) {
    if (isMissingTable(e)) return false;
    return false;
  }
}

function safeJson(v, fallback) {
  try {
    if (!v) return fallback;
    if (typeof v === "string") return JSON.parse(v);
    return v;
  } catch {
    return fallback;
  }
}

function buildGraph(nodes = [], edges = []) {
  const out = new Map();
  const byId = new Map();
  for (const n of nodes) byId.set(n.id, n);
  for (const e of edges) {
    const a = String(e.source || "");
    const b = String(e.target || "");
    if (!a || !b) continue;
    if (!out.has(a)) out.set(a, []);
    out.get(a).push(b);
  }
  return { out, byId };
}

function findTriggerNode(nodes = []) {
  return nodes.find((n) => n.type === "trigger") || null;
}

function getNextNodeIds(outMap, nodeId) {
  return outMap.get(nodeId) || [];
}

// Very simple: pick first outgoing path unless a condition node chooses later
function pickNextNode(outMap, nodeId) {
  const nexts = getNextNodeIds(outMap, nodeId);
  return nexts[0] || null;
}

async function ensureQueuedForMembers({ flow, members, useQueueTable }) {
  // If we have automation_queue table:
  // create a pending job for each active member if no pending job exists
  if (!useQueueTable) return;

  const flow_id = flow.id;

  const activeLeadIds = (members || [])
    .filter((m) => String(m.status || "").toLowerCase() === "active")
    .map((m) => m.lead_id)
    .filter(Boolean);

  if (!activeLeadIds.length) return;

  // existing pending jobs
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("automation_queue")
    .select("lead_id")
    .eq("flow_id", flow_id)
    .in("lead_id", activeLeadIds)
    .eq("status", "pending");

  if (exErr) return;

  const have = new Set((existing || []).map((r) => r.lead_id));
  const now = new Date().toISOString();

  const toIns = [];
  for (const lead_id of activeLeadIds) {
    if (have.has(lead_id)) continue;
    toIns.push({
      flow_id,
      lead_id,
      status: "pending",
      next_node_id: null,
      run_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  if (toIns.length) {
    await supabaseAdmin.from("automation_queue").insert(toIns);
  }
}

async function queueEmail({ flow, lead_id, node }) {
  const user_id = flow.user_id;

  // Expect email node data to contain template_id (you set this in EmailNodeDrawer)
  const template_id =
    node?.data?.template_id ||
    node?.data?.sendgrid_template_id ||
    node?.data?.templateId ||
    null;

  if (!template_id) {
    // No template set = cannot send
    return { ok: false, reason: "missing_template_id" };
  }

  const scheduled_at = new Date().toISOString();

  // Dedupe key (best-effort, does not require schema changes)
  const meta = {
    source: "automation",
    flow_id: flow.id,
    node_id: node.id,
    type: "email",
  };

  // Insert into your existing queue table that your SendGrid worker processes
  const { error } = await supabaseAdmin.from("email_campaign_queue").insert([
    {
      user_id,
      lead_id,
      template_id,
      scheduled_at,
      meta,
    },
  ]);

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

async function processOneMemberStateless({ graph, flow, member, nodesById }) {
  // No automation_queue table: we still auto-run by immediately queuing the first email node after trigger.
  // This will run EVERY tick unless deduped elsewhere, so we only do it for "new" members
  // if they have member.started_at field. If it doesn't exist, we do a soft dedupe by checking email_campaign_queue meta.
  const trigger = findTriggerNode([...nodesById.values()]);
  if (!trigger) return;

  const first = pickNextNode(graph.out, trigger.id);
  if (!first) return;

  const n = nodesById.get(first);
  if (!n) return;

  if (n.type === "email") {
    // Soft dedupe: check if already queued for this lead+flow+node
    const { data: exist } = await supabaseAdmin
      .from("email_campaign_queue")
      .select("id,meta")
      .eq("lead_id", member.lead_id)
      .limit(50);

    const already = (exist || []).some((r) => {
      const m = r?.meta || {};
      return m?.source === "automation" && m?.flow_id === flow.id && m?.node_id === n.id;
    });

    if (!already) {
      await queueEmail({ flow, lead_id: member.lead_id, node: n });
    }
  }
}

async function processQueueTable({ graph, flow, nodesById }) {
  // Fetch due pending jobs and advance them
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await supabaseAdmin
    .from("automation_queue")
    .select("*")
    .eq("flow_id", flow.id)
    .eq("status", "pending")
    .lte("run_at", nowIso)
    .order("run_at", { ascending: true })
    .limit(50);

  if (error || !jobs?.length) return;

  const trigger = findTriggerNode([...nodesById.values()]);
  if (!trigger) return;

  for (const job of jobs) {
    const lead_id = job.lead_id;
    const current_node_id = job.next_node_id || trigger.id;

    const nextNodeId = pickNextNode(graph.out, current_node_id);
    if (!nextNodeId) {
      // End of flow
      await supabaseAdmin
        .from("automation_queue")
        .update({
          status: "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    const node = nodesById.get(nextNodeId);
    if (!node) {
      await supabaseAdmin
        .from("automation_queue")
        .update({
          status: "error",
          error: `Missing node ${nextNodeId}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    // Handle node types
    if (node.type === "email") {
      const r = await queueEmail({ flow, lead_id, node });

      // Move to next node immediately after queuing email
      await supabaseAdmin
        .from("automation_queue")
        .update({
          next_node_id: nextNodeId,
          status: r.ok ? "pending" : "error",
          error: r.ok ? null : r.reason,
          run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      continue;
    }

    if (node.type === "delay") {
      // delay node expects minutes in node.data.minutes or node.data.delay_minutes
      const mins =
        Number(node?.data?.minutes ?? node?.data?.delay_minutes ?? 0) || 0;
      const runAt = new Date(Date.now() + mins * 60 * 1000).toISOString();

      await supabaseAdmin
        .from("automation_queue")
        .update({
          next_node_id: nextNodeId,
          status: "pending",
          run_at: runAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      continue;
    }

    if (node.type === "condition") {
      // For now: follow first branch
      await supabaseAdmin
        .from("automation_queue")
        .update({
          next_node_id: nextNodeId,
          status: "pending",
          run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    // trigger or unknown -> just advance
    await supabaseAdmin
      .from("automation_queue")
      .update({
        next_node_id: nextNodeId,
        status: "pending",
        run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }
}

export default async function handler(req, res) {
  try {
    // Can tick ALL flows, or a single flow_id
    const flow_id = req.query?.flow_id ? String(req.query.flow_id) : null;

    const useQueueTable = await hasAutomationQueueTable();

    const flowsQuery = supabaseAdmin
      .from("automation_flows")
      .select("id,user_id,nodes,edges,is_standard,name")
      .order("updated_at", { ascending: false });

    const { data: flows, error: flowErr } = flow_id
      ? await flowsQuery.eq("id", flow_id)
      : await flowsQuery.limit(50);

    if (flowErr) return res.status(500).json({ ok: false, error: flowErr.message });

    const out = [];
    for (const flow of flows || []) {
      const nodes = safeJson(flow.nodes, []);
      const edges = safeJson(flow.edges, []);
      const graph = buildGraph(nodes, edges);

      // members
      const { data: members } = await supabaseAdmin
        .from("automation_flow_members")
        .select("lead_id,status")
        .eq("flow_id", flow.id);

      if (useQueueTable) {
        await ensureQueuedForMembers({ flow, members, useQueueTable: true });
        await processQueueTable({ graph, flow, nodesById: graph.byId });
      } else {
        // Stateless fallback: queue first email after trigger once per lead (soft dedupe)
        for (const m of members || []) {
          if (String(m.status || "").toLowerCase() !== "active") continue;
          await processOneMemberStateless({
            graph_toggle: true,
            graph,
            flow,
            member: m,
            nodesById: graph.byId,
          });
        }
      }

      out.push({ flow_id: flow.id, name: flow.name || null });
    }

    return res.json({ ok: true, processed_flows: out.length, flows: out, queue_table: useQueueTable });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
