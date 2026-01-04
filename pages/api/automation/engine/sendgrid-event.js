// /pages/api/automation/engine/sendgrid-event.js
// FULL FILE — receives SendGrid event webhook and wakes automation runs
// ✅ Looks for customArgs: automation_run_id, automation_node_id, event_token
// ✅ On open/click: sets automation_flow_runs.status="active" and records last_event_type

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
  if (t === "open") return "open";
  if (t === "click") return "click";
  return null;
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

      if (!runId || !token) continue;

      // wake run only if it matches waiting token
      const { data: run, error: runErr } = await supabase
        .from("automation_flow_runs")
        .select("id,status,waiting_for,waiting_token,waiting_node_id")
        .eq("id", runId)
        .single();

      if (runErr || !run) continue;

      // Only wake if it was waiting_event and token matches
      if (run.status !== "waiting_event") continue;
      if (String(run.waiting_token || "") !== token) continue;

      // If it's waiting_for open but we received click, still wake (click implies open-ish)
      const waitingFor = String(run.waiting_for || "").toLowerCase();
      if (waitingFor && waitingFor !== type && !(waitingFor === "open" && type === "click")) {
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
