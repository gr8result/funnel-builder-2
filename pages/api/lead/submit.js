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
      list_id = null,
      funnel_id = null,
      page_id = null,
      source = "form",
      tags = [],
    } = req.body || {};

    if (!email)
      return res.status(400).json({ error: "Email is required" });

    // Insert or update lead
    const leadData = {
      name,
      email,
      phone,
      list,
      funnel_id,
      page_id,
      source,
      tags,
    };

    // Add list_id if provided
    if (list_id) {
      leadData.list_id = list_id;
    }

    const { data, error } = await sb
      .from("leads")
      .upsert([leadData], { onConflict: "email" })
      .select();

    if (error) throw error;

    const lead = data?.[0];
    if (!lead) throw new Error("Lead creation failed");

    // Auto-enroll in automation flows if list_id is provided
    if (list_id && lead.id) {
      try {
        console.log(`🔄 Auto-enrolling lead ${lead.id} in list ${list_id} flows...`);
        await fetch(`${process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/automation/engine/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            event: 'list_subscribed',
            list_id: list_id
          })
        });
        console.log(`✅ Auto-enrollment request sent for lead ${lead.id}`);
      } catch (enrollErr) {
        console.error("⚠️  Auto-enrollment failed, but lead created:", enrollErr.message);
        // Don't fail lead creation if enrollment fails
      }
    }

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
