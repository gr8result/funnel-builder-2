// /pages/api/automation/engine/reset-runs.js
// Quick endpoint to reset failed runs to pending

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

const CRON_SECRET =
  (process.env.AUTOMATION_CRON_SECRET || "").trim() ||
  (process.env.AUTOMATION_CRON_KEY || "").trim() ||
  (process.env.CRON_SECRET || "").trim();

function okAuth(req) {
  const h = (req.headers.authorization || "").trim();
  const bearer = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  const q = (req.query.key || "").toString().trim();
  const x = (req.headers["x-cron-key"] || "").toString().trim();
  const secret = CRON_SECRET;
  if (!secret) return true;
  return bearer === secret || q === secret || x === secret;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!okAuth(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const flow_id = (req.body?.flow_id || req.query.flow_id || "").toString().trim();
  if (!flow_id) return res.status(400).json({ ok: false, error: "Missing flow_id" });

  try {
    // Reset all failed/pending runs to pending with cleared errors
    const { data, error } = await supabase
      .from("automation_flow_runs")
      .update({
        status: "pending",
        last_error: null,
        available_at: new Date().toISOString(),
      })
      .eq("flow_id", flow_id)
      .select("id, lead_id, status");

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({
      ok: true,
      reset_count: data?.length || 0,
      runs: data || [],
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
