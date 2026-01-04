// /pages/api/lead/submit.js
// ✅ Universal Lead Capture Endpoint
// Accepts POSTs from website forms, funnels, and integrations
// Inserts leads into Supabase "leads" table and links to "lead_lists"

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""; // server-only
const sb = createClient(url, serviceKey);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      name = "",
      email = "",
      phone = "",
      list = "default",
      funnel_id = null,
      page_id = null,
      source = "form",
      tags = [],
    } = req.body || {};

    if (!email)
      return res.status(400).json({ error: "Email is required" });

    // Insert or update lead
    const { data, error } = await sb
      .from("leads")
      .upsert(
        [
          {
            name,
            email,
            phone,
            list,
            funnel_id,
            page_id,
            source,
            tags,
          },
        ],
        { onConflict: "email" } // update if email exists
      )
      .select();

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      message: "Lead added successfully",
      data,
    });
  } catch (e) {
    console.error("❌ Lead submit error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Lead submission failed" });
  }
}
