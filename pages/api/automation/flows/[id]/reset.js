// /pages/api/automation/flows/[id]/reset.js

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ ok: false, error: "Missing flow id" });
    }

    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

    const SERVICE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing Supabase env variables",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1️⃣ Delete flow runs
    const { error: runsErr } = await supabase
      .from("automation_flow_runs")
      .delete()
      .eq("flow_id", id);

    if (runsErr) throw runsErr;

    // 2️⃣ Delete flow members
    const { error: membersErr } = await supabase
      .from("automation_flow_members")
      .delete()
      .eq("flow_id", id);

    if (membersErr) throw membersErr;

    // 3️⃣ Delete queued emails
    const { error: queueErr } = await supabase
      .from("automation_email_queue")
      .delete()
      .eq("flow_id", id);

    if (queueErr) throw queueErr;

    return res.json({ ok: true });
  } catch (err) {
    console.error("Reset failed:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
}
