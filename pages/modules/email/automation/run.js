// /pages/api/automation/run.js
// ✅ Executes an automation flow
// ✅ Creates email_flow_runs + email_flow_steps entries
// ✅ Can be triggered from forms, webhooks, or manual test runs

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service key required for server-side inserts
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { automation_id, subscriber_id, trigger_data } = req.body;

    if (!automation_id || !subscriber_id)
      return res
        .status(400)
        .json({ error: "automation_id and subscriber_id are required." });

    // 🧠 Step 1: Load automation details (nodes + edges)
    const { data: automation, error: autoErr } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automation_id)
      .single();

    if (autoErr || !automation)
      return res.status(404).json({ error: "Automation not found." });

    // 🧱 Step 2: Create new run record
    const { data: run, error: runErr } = await supabase
      .from("email_flow_runs")
      .insert([
        {
          automation_id,
          subscriber_id,
          status: "running",
        },
      ])
      .select()
      .single();

    if (runErr) throw runErr;

    // 🧩 Step 3: Extract nodes + edges from automation JSON
    const nodes = Array.isArray(automation.nodes) ? automation.nodes : [];
    const edges = Array.isArray(automation.edges) ? automation.edges : [];

    // Identify the first trigger node
    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!triggerNode)
      return res.status(400).json({ error: "No trigger node found." });

    // 🧾 Log first step
    await logStep(run.id, triggerNode, "Triggered", supabase);

    // 🌀 Step 4: Process next connected nodes
    const nextEdges = edges.filter((e) => e.source === triggerNode.id);

    for (const edge of nextEdges) {
      const nextNode = nodes.find((n) => n.id === edge.target);
      if (!nextNode) continue;

      switch (nextNode.type) {
        case "email":
          await processEmailNode(run.id, nextNode, supabase);
          break;
        case "delay":
          await processDelayNode(run.id, nextNode, supabase);
          break;
        case "condition":
          await processConditionNode(run.id, nextNode, supabase);
          break;
        default:
          await logStep(run.id, nextNode, "Skipped (no handler)", supabase);
      }
    }

    // ✅ Step 5: Finish run
    await supabase
      .from("email_flow_runs")
      .update({ status: "completed" })
      .eq("id", run.id);

    res.status(200).json({
      message: "Automation executed successfully.",
      run_id: run.id,
    });
  } catch (err) {
    console.error("Automation run error:", err);
    res.status(500).json({ error: err.message });
  }
}

/* ---------- Helper Functions ---------- */

async function logStep(flowRunId, node, outcome, supabase) {
  await supabase.from("email_flow_steps").insert([
    {
      flow_run_id: flowRunId,
      node_id: node.id,
      node_type: node.type,
      outcome,
    },
  ]);
}

async function processEmailNode(flowRunId, node, supabase) {
  await logStep(flowRunId, node, "Email step processed", supabase);

  // ⚙️ Here you can later integrate:
  // - SendGrid / Resend / Postmark API call
  // - Load selected template HTML
  // - Personalise with subscriber data
}

async function processDelayNode(flowRunId, node, supabase) {
  const { amount = 1, unit = "hours" } = node.data || {};
  await logStep(
    flowRunId,
    node,
    `Delay: ${amount} ${unit} (scheduled, not yet implemented)`,
    supabase
  );

  // ⏱️ In production: create a scheduled job (Edge Function / Supabase cron)
}

async function processConditionNode(flowRunId, node, supabase) {
  await logStep(
    flowRunId,
    node,
    `Condition checked: ${node.data?.condition || "unknown"}`,
    supabase
  );

  // 🧩 Later: evaluate Yes/No branches based on stored subscriber data
}
