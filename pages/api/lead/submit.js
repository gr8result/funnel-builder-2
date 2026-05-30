// /pages/api/lead/submit.js
// ✅ Public lead capture endpoint — called from website forms, funnels, embeds.
// workspace_id MUST be supplied so the lead lands in the correct workspace.
// No auth token required (public-facing), but workspace_id is mandatory.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

import { checkRateLimit, getIp } from "../../../lib/rateLimit";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const rl = checkRateLimit(`lead:${getIp(req)}`, 20, 60 * 1000);
  if (!rl.ok) return res.status(429).json({ error: "Too many requests." });

  try {
    const {
      workspace_id,
      name = "",
      email = "",
      phone = "",
      list = "default",
      funnel_id = null,
      page_id = null,
      source = "form",
      tags = [],
      lead_source,
    } = req.body || {};

    // workspace_id is mandatory for public submissions
    if (!workspace_id) {
      return res.status(400).json({ error: "workspace_id is required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Verify the workspace exists before accepting the lead
    const { data: ws, error: wsErr } = await sb
      .from("workspaces")
      .select("id")
      .eq("id", workspace_id)
      .maybeSingle();

    if (wsErr || !ws) {
      return res.status(400).json({ error: "Invalid workspace_id" });
    }

    const { data, error } = await sb
      .from("leads")
      .upsert(
        [
          {
            workspace_id,
            name,
            email,
            phone,
            list,
            funnel_id,
            page_id,
            source,
            lead_source: lead_source || source,
            tags,
            lead_status: "new",
          },
        ],
        { onConflict: "email,workspace_id" }
      )
      .select("id");

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      message: "Lead added successfully",
      data,
    });
  } catch (e) {
    console.error("❌ Lead submit error:", e);
    return res.status(500).json({ error: e.message || "Lead submission failed" });
  }
}

