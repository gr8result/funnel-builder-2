// /pages/api/email/save-template.js
// Saves Unlayer design + HTML into email_templates
// Expects JSON body: { id, design, html, name? }

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
if (supabaseUrl && serviceKey) {
  supabaseAdmin = createClient(supabaseUrl, serviceKey);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST for this endpoint." });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({
      ok: false,
      error: "Supabase admin client not configured. Check env vars.",
    });
  }

  try {
    const { id, design, html, name } = req.body || {};

    if (!id || !design || !html) {
      return res.status(400).json({
        ok: false,
        error: "Missing id, design or html in request body.",
      });
    }

    const designString = JSON.stringify(design);

    // Adjust these column names if your table uses different ones
    const upsertPayload = {
      id,
      name: name || null,
      design_json: designString,
      html,
    };

    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .upsert(upsertPayload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[save-template] Supabase error:", error);
      return res.status(500).json({
        ok: false,
        error: error.message || "Supabase error while saving template.",
      });
    }

    return res.status(200).json({
      ok: true,
      template: data,
    });
  } catch (err) {
    console.error("[save-template] Unexpected error:", err);
    return res.status(500).json({
      ok: false,
      error: "Unexpected server error in save-template.",
    });
  }
}
