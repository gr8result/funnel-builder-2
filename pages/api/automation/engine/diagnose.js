// /pages/api/automation/engine/diagnose.js
// Diagnostic endpoint to see exactly what's in your flow

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  try {
    const flow_id = String(req.query?.flow_id || "").trim();
    if (!flow_id) return res.status(400).json({ ok: false, error: "Missing flow_id" });

    const { data: flow } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flow_id)
      .single();

    if (!flow) {
      return res.status(404).json({ ok: false, error: "Flow not found" });
    }

    let nodes = [];
    let edges = [];

    try {
      if (typeof flow.nodes === "string") {
        nodes = JSON.parse(flow.nodes);
      } else {
        nodes = flow.nodes || [];
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: `Failed to parse nodes: ${e.message}` });
    }

    try {
      if (typeof flow.edges === "string") {
        edges = JSON.parse(flow.edges);
      } else {
        edges = flow.edges || [];
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: `Failed to parse edges: ${e.message}` });
    }

    // Get members
    const { data: members } = await supabase
      .from("automation_flow_members")
      .select("lead_id, status")
      .eq("flow_id", flow_id);

    // Get runs
    const { data: runs } = await supabase
      .from("automation_flow_runs")
      .select("id, lead_id, current_node_id, status")
      .eq("flow_id", flow_id);

    // Get detailed email node info
    const emailNodes = nodes
      .filter((n) => n.type?.includes("email"))
      .map((n) => ({
        id: n.id,
        type: n.type,
        label: n.data?.label,
        emailId: n.data?.emailId,
        emailName: n.data?.emailName,
        htmlPath: n.data?.htmlPath,
        storagePath: n.data?.storagePath,
        bucket: n.data?.bucket,
        subject: n.data?.subject,
        to_email: n.data?.to_email,
        from_email: n.data?.from_email,
        passedCount: n.data?.passedCount,
        _fullData: n.data, // for debugging
      }));

    return res.json({
      ok: true,
      flow: {
        id: flow.id,
        name: flow.name,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.data?.label || n.label,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        })),
      },
      email_nodes_detail: emailNodes,
      stats: {
        members: members?.length || 0,
        runs: runs?.length || 0,
        active_members: members?.filter((m) => m.status === "active")?.length || 0,
      },
      members: members || [],
      runs: runs || [],
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
