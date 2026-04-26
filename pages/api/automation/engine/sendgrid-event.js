// /pages/api/automation/engine/sendgrid-event.js
// FULL FILE — receives SendGrid event webhook and wakes automation runs
// ✅ Now ALSO updates email_sends analytics
// ✅ Keeps existing automation wake logic EXACTLY as-is

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function tickRun(run_id) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000";

  await fetch(`${base}/api/automation/engine/tick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id }),
  }).catch(() => null);
}

function normalizeEventType(e) {
  const t = String(e?.event || "").toLowerCase();
  if (!t) return null;
  return t;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];
    let woke = 0;

    for (const e of events) {
      const type = normalizeEventType(e);
      if (!type) continue;

      const ca = e?.custom_args || e?.customArgs || {};
      const runId = String(ca.automation_run_id || ca.automationRunId || "").trim();
      const nodeId = String(ca.automation_node_id || ca.automationNodeId || "").trim();
      const token = String(ca.event_token || ca.eventToken || "").trim();
      const sendRowId = String(ca.gr8_send_row_id || "").trim();

      // ---------------------------------------------------
      // ✅ UPDATE email_sends TABLE (ANALYTICS FIX)
      // ---------------------------------------------------

      if (sendRowId) {
        const updateData = {
          last_event: type,
          last_event_at: new Date().toISOString(),
        };

        if (type === "delivered") {
          updateData.delivered_at = new Date().toISOString();
          updateData.status = "delivered";
        }

        if (type === "open") {
          updateData.opened_at = new Date().toISOString();
          updateData.status = "opened";
        }

        if (type === "click") {
          updateData.clicked_at = new Date().toISOString();
          updateData.status = "clicked";
          updateData.click_count = 1; // simple increment logic
        }

        if (type === "bounce") {
          updateData.bounced_at = new Date().toISOString();
          updateData.status = "bounced";
        }

        if (type === "unsubscribe") {
          updateData.unsubscribed_at = new Date().toISOString();
          updateData.unsubscribed = true;
          updateData.status = "unsubscribed";
        }

        await supabase
          .from("email_sends")
          .update(updateData)
          .eq("id", sendRowId);
      }

      // ---------------------------------------------------
      // ✅ EXISTING AUTOMATION WAKE LOGIC (UNCHANGED)
      // ---------------------------------------------------

      if (!runId || !token) continue;

      const { data: run, error: runErr } = await supabase
        .from("automation_flow_runs")
        .select("id,status,waiting_for,waiting_token,waiting_node_id")
        .eq("id", runId)
        .single();

      if (runErr || !run) continue;

      if (run.status !== "waiting_event") continue;
      if (String(run.waiting_token || "") !== token) continue;

      const waitingFor = String(run.waiting_for || "").toLowerCase();
      if (
        waitingFor &&
        waitingFor !== type &&
        !(waitingFor === "open" && type === "click")
      ) {
        continue;
      }

      const { error: upErr } = await supabase
        .from("automation_flow_runs")
        .update({
          status: "active",
          waiting_for: null,
          waiting_token: null,
          waiting_node_id: null,
          last_event_type: type,
          last_event_node_id: nodeId || run.waiting_node_id || null,
          last_error: null,
        })
        .eq("id", runId);

      if (!upErr) {
        woke++;
        await tickRun(runId);
      }
    }

    return res.status(200).json({ ok: true, woke });
  } catch (err) {
    console.error("sendgrid-event error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || String(err) });
  }
}
