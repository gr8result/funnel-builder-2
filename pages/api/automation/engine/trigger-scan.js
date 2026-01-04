// /pages/api/automation/engine/trigger-scan.js
// FULL REPLACEMENT
//
// ✅ Scans time-based triggers and enrolls eligible leads
// ✅ Supports: lead_inactive_days
//
// POST: { }  (no body required)
//
// How it works:
// - Finds flows whose triggerType = lead_inactive_days
// - For each flow, enrolls leads whose updated_at (or last_activity_at if you have it) is older than X days
// - Uses /engine/enroll forced mode so it creates runs and doesn't duplicate

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function safeJson(x, fallback) {
  try {
    if (Array.isArray(x)) return x;
    if (typeof x === "string") return JSON.parse(x || "[]");
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - Number(days || 0));
  return d.toISOString();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ ok: false, error: "POST only" });

    // Load flows
    const { data: flows, error } = await supabase
      .from("automation_flows")
      .select("id,name,nodes,user_id");

    if (error) throw error;

    const inactiveFlows = (flows || [])
      .map((f) => {
        const nodes = safeJson(f.nodes, []);
        const trig = nodes.find((n) => n?.type === "trigger");
        const t = String(trig?.data?.triggerType || "");
        const inactiveDays = Number(trig?.data?.inactiveDays || 14);
        return t === "lead_inactive_days"
          ? { flow_id: f.id, user_id: f.user_id, inactiveDays }
          : null;
      })
      .filter(Boolean);

    if (!inactiveFlows.length) {
      return res.json({ ok: true, scanned: 0, note: "No inactive-day triggers found." });
    }

    let totalEnrolled = 0;

    for (const f of inactiveFlows) {
      const cutoff = daysAgoIso(f.inactiveDays);

      // ✅ Choose the best activity column you have.
      // If you later add leads.last_activity_at, swap it in here.
      const { data: leads, error: leadsErr } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", f.user_id)
        .lt("updated_at", cutoff)
        .limit(500);

      if (leadsErr) continue;

      for (const l of leads || []) {
        // Force enroll into this flow
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/automation/engine/enroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: l.id,
            flow_id: f.flow_id,
            event: "lead_inactive_days",
          }),
        }).catch(() => null);

        totalEnrolled++;
      }
    }

    return res.json({
      ok: true,
      scanned: inactiveFlows.length,
      enrolled: totalEnrolled,
      note: "Trigger scan complete.",
    });
  } catch (err) {
    console.error("trigger-scan error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
