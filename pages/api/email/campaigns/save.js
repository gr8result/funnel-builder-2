// /pages/api/email/campaigns/save.js
// FULL REPLACEMENT — SAVE ONLY (does NOT send/queue)
// ✅ Matches your real campaign columns (email1_subject, subscriber_list_id, delays, etc.)
// ✅ Accepts: { userId, ...fields } OR { userId, campaign: {...} }
// ✅ Uses service role (server-side only)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env",
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = req.body || {};
    const userId = body.userId || body.user_id;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const campaign =
      body.campaign && typeof body.campaign === "object" ? body.campaign : body;

    const allowed = [
      "id",
      "name",
      "status",

      "from_name",
      "from_email",
      "reply_to",

      "subscriber_list_id",
      "subscriber_list_name",
      "send_to_all",
      "extra_recipients",

      "email1_subject",
      "email2_subject",
      "email3_subject",

      "email1_template_id",
      "email2_template_id",
      "email3_template_id",

      "delay1_minutes",
      "delay2_minutes",
      "delay3_minutes",
    ];

    const payload = {
      user_id: userId,
      ...pick(campaign, allowed),
    };

    if (!payload.name) payload.name = "Untitled campaign";
    if (payload.send_to_all === undefined) payload.send_to_all = false;

    const { data, error } = await supabaseAdmin
      .from("email_campaigns")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      console.error("campaign save error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, campaign: data });
  } catch (e) {
    console.error("campaign save exception:", e);
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e) || "Server error",
    });
  }
}
