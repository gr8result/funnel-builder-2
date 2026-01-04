// /pages/api/email/log-broadcast.js
// FULL REPLACEMENT
// Logs a sent/queued broadcast into email_broadcasts.
// NOTE: API routes must NOT import CSS.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST only" });
  }

  try {
    const { userId, subject = "", html = "", audience = "", form = {} } =
      req.body || {};

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing userId" });
    }

    // Keep fields conservative: only write what we’re sure exists.
    // If your table has different columns, this will still fail gracefully.
    const insert = {
      user_id: userId,
      subject: subject || null,
      title: (form?.name || subject || "Broadcast").slice(0, 200),
      html_content: html || null,
      to_field: audience || null,
      from_name: form?.fromName || null,
      from_email: form?.fromEmail || null,
      reply_to: form?.replyTo || null,
      preheader: form?.preheader || null,
      audience_type: form?.audienceType || "emails",
      list_id:
        form?.audienceType === "list" && form?.audience
          ? Number(form.audience) || form.audience
          : null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("email_broadcasts")
      .insert(insert)
      .select("id")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Insert failed",
      });
    }

    return res.status(200).json({ success: true, id: data?.id || null });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: e?.message || "Server error" });
  }
}
