// /pages/api/automation/email/queue-status.js
// View automation email queue status
// GET /api/automation/email/queue-status?flow_id=xxx

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

export default async function handler(req, res) {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const flowId = req.query.flow_id ? String(req.query.flow_id) : null;

  try {
    let query = supabase.from("automation_email_queue").select("status, COUNT(*) as count");
    
    if (flowId) {
      query = query.eq("flow_id", flowId);
    }

    // Get counts by status
    const { data: statusCounts } = await supabase
      .from("automation_email_queue")
      .select("status")
      .eq("flow_id", flowId || "");

    const counts = {
      pending: 0,
      sent: 0,
      failed: 0,
      bounced: 0,
    };

    statusCounts?.forEach((row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });

    // Get recent pending emails
    const { data: pending } = await supabase
      .from("automation_email_queue")
      .select("id, to_email, subject, created_at")
      .eq("status", "pending")
      .eq("flow_id", flowId || "")
      .order("created_at", { ascending: true })
      .limit(10);

    // Get recent failures
    const { data: failed } = await supabase
      .from("automation_email_queue")
      .select("id, to_email, subject, last_error, created_at")
      .eq("status", "failed")
      .eq("flow_id", flowId || "")
      .order("created_at", { ascending: false })
      .limit(5);

    return res.json({
      ok: true,
      flow_id: flowId || "all",
      counts,
      pending: pending || [],
      failed: failed || [],
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
}
