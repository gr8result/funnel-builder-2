// /pages/api/automation/nodes/[nodeId]/details.js
// Get comprehensive details about a specific node including:
// - Queued emails
// - Sent emails
// - Current leads at this node
// - Unsubscribed leads
// - Failed sends

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { nodeId } = req.query;
  const flowId = req.query.flow_id;

  if (!nodeId || !flowId) {
    return res.status(400).json({ error: "Missing nodeId or flow_id" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Get current leads at this node
    const { data: currentRuns, error: runsErr } = await supabase
      .from("automation_flow_runs")
      .select(`
        id,
        lead_id,
        status,
        available_at,
        last_error,
        leads!inner(id, email, name, unsubscribed)
      `)
      .eq("flow_id", flowId)
      .eq("current_node_id", nodeId)
      .order("available_at", { ascending: true });

    if (runsErr) throw runsErr;

    // Get queued emails for this node
    const { data: queuedEmails, error: queueErr } = await supabase
      .from("automation_email_queue")
      .select(`
        id,
        to_email,
        subject,
        status,
        created_at,
        sent_at,
        last_error,
        open_count,
        click_count,
        lead_id,
        leads!inner(id, email, name, unsubscribed)
      `)
      .eq("flow_id", flowId)
      .eq("node_id", nodeId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (queueErr) throw queueErr;

    // Get sent emails from email_sends table
    const { data: sentEmails, error: sentErr } = await supabase
      .from("email_sends")
      .select(`
        id,
        email,
        recipient_email,
        variant,
        sent_at,
        open_count,
        click_count,
        unsubscribed,
        bounced
      `)
      .eq("automation_id", flowId)
      .contains("metadata", { node_id: nodeId })
      .order("sent_at", { ascending: false })
      .limit(100);

    // Aggregate stats
    const stats = {
      current_leads: currentRuns?.length || 0,
      unsubscribed: currentRuns?.filter((r) => r.leads?.unsubscribed)?.length || 0,
      queued: queuedEmails?.filter((e) => e.status === "pending")?.length || 0,
      sent: queuedEmails?.filter((e) => e.status === "sent")?.length || 0,
      failed: queuedEmails?.filter((e) => e.status === "failed")?.length || 0,
      total_opens: queuedEmails?.reduce((sum, e) => sum + (e.open_count || 0), 0) || 0,
      total_clicks: queuedEmails?.reduce((sum, e) => sum + (e.click_count || 0), 0) || 0,
    };

    return res.status(200).json({
      ok: true,
      node_id: nodeId,
      flow_id: flowId,
      stats,
      current_leads: currentRuns || [],
      queued_emails: queuedEmails || [],
      sent_emails: sentEmails || [],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
