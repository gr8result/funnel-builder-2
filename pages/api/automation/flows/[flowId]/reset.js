// /pages/api/automation/flows/[flowId]/reset.js
// Dangerous endpoint - completely resets a flow's data
// Deletes: runs, email queue, members, logs for THIS flow only
// ⚠️ CANNOT BE UNDONE - requires confirmation header

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { flowId } = req.query;
  const { confirm_deletion } = req.body;

  if (!flowId) {
    return res.status(400).json({ error: "Missing flowId" });
  }

  // Safety check - must explicitly confirm deletion
  if (confirm_deletion !== true) {
    return res.status(400).json({
      error: "Deletion not confirmed",
      message: "You must set confirm_deletion: true to proceed",
      warning: "This action CANNOT be undone. All flow data will be permanently deleted.",
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Verify flow exists
    const { data: flow, error: flowErr } = await supabase
      .from("automation_flows")
      .select("id, name")
      .eq("id", flowId)
      .single();

    if (flowErr || !flow) {
      return res.status(404).json({ error: "Flow not found" });
    }

    const debug = {
      flow_id: flowId,
      flow_name: flow.name,
      deleted: {
        runs: 0,
        queue_emails: 0,
        members: 0,
        logs: 0,
      },
      errors: [],
    };

    // 1. Delete automation_flow_runs
    try {
      const { data: runs, error: runsErr } = await supabase
        .from("automation_flow_runs")
        .delete()
        .eq("flow_id", flowId)
        .select("id");

      if (runsErr) {
        debug.errors.push(`Runs delete error: ${runsErr.message}`);
      } else {
        debug.deleted.runs = runs?.length || 0;
      }
    } catch (err) {
      debug.errors.push(`Runs delete failed: ${err.message}`);
    }

    // 2. Delete automation_email_queue entries for this flow
    try {
      const { data: queued, error: queueErr } = await supabase
        .from("automation_email_queue")
        .delete()
        .eq("flow_id", flowId)
        .select("id");

      if (queueErr) {
        debug.errors.push(`Queue delete error: ${queueErr.message}`);
      } else {
        debug.deleted.queue_emails = queued?.length || 0;
      }
    } catch (err) {
      debug.errors.push(`Queue delete failed: ${err.message}`);
    }

    // 3. Delete automation_flow_members
    try {
      const { data: members, error: membersErr } = await supabase
        .from("automation_flow_members")
        .delete()
        .eq("flow_id", flowId)
        .select("id");

      if (membersErr) {
        debug.errors.push(`Members delete error: ${membersErr.message}`);
      } else {
        debug.deleted.members = members?.length || 0;
      }
    } catch (err) {
      debug.errors.push(`Members delete failed: ${err.message}`);
    }

    // 4. Delete automation_logs for this flow
    try {
      const { data: logs, error: logsErr } = await supabase
        .from("automation_logs")
        .delete()
        .eq("flow_id", flowId)
        .select("id");

      if (logsErr) {
        debug.errors.push(`Logs delete error: ${logsErr.message}`);
      } else {
        debug.deleted.logs = logs?.length || 0;
      }
    } catch (err) {
      debug.errors.push(`Logs delete failed: ${err.message}`);
    }

    return res.status(200).json({
      ok: true,
      message: `Flow "${flow.name}" completely reset`,
      debug,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
