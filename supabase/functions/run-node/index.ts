// supabase/functions/run-node/index.ts
// ✅ Executes automation nodes: send email, delay, condition, etc.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    const queue_id = body.queue_id ?? null;
    const node_id = body.node_id ?? null;

    if (!queue_id || !node_id) {
      return new Response(JSON.stringify({ error: "Missing queue_id or node_id" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Load queue
    const { data: queue, error: qErr } = await supabase
      .from("automation_queue")
      .select("*")
      .eq("id", queue_id)
      .single();
    if (qErr || !queue) throw qErr || new Error("Queue not found");

    // Load flow
    const { data: flow, error: fErr } = await supabase
      .from("automation_flows")
      .select("nodes, edges")
      .eq("id", queue.flow_id)
      .single();
    if (fErr || !flow) throw fErr || new Error("Flow not found");

    const nodes = typeof flow.nodes === "string" ? JSON.parse(flow.nodes) : flow.nodes;
    const edges = typeof flow.edges === "string" ? JSON.parse(flow.edges) : flow.edges;
    const node = nodes.find((n: any) => n.id === node_id);
    if (!node) throw new Error("Node not found");

    // Execute by type
    switch (node.type) {
      case "email":
        await supabase.from("automation_actions").insert({
          queue_id,
          action_type: "send_email",
          payload: node.data.params ?? {},
          scheduled_at: new Date().toISOString(),
        });
        break;

      case "delay":
        const delayMs = (node.data.params?.amount ?? 1) * 1000 * 60 * 60 * 24; // days → ms
        const runAt = new Date(Date.now() + delayMs).toISOString();
        await supabase.from("automation_actions").insert({
          queue_id,
          action_type: "delay",
          payload: node.data.params ?? {},
          scheduled_at: runAt,
        });
        break;

      case "condition":
        const eventType = node.data.params?.event_type ?? "purchase";
        const { data: event } = await supabase
          .from("automation_events")
          .select("*")
          .eq("contact_id", queue.contact_id)
          .eq("event_type", eventType)
          .maybeSingle();

        // Branch logic
        const nextNodeId = event
          ? node.data.params?.true_path
          : node.data.params?.false_path;

        await supabase
          .from("automation_queue")
          .update({
            current_node: nextNodeId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", queue_id);
        break;

      default:
        console.log("Unknown node type:", node.type);
        break;
    }

    // Find next node (for email and delay types)
    if (node.type !== "condition") {
      const nextEdge = edges.find((e: any) => e.source === node_id);
      const nextNodeId = nextEdge?.target ?? null;
      if (nextNodeId) {
        await supabase
          .from("automation_queue")
          .update({
            current_node: nextNodeId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", queue_id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("run-node error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
