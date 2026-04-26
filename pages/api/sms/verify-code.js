// /pages/api/sms/verify-code.js
// User enters the SMS sender code they received via email, activating SMS sending

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { userId, senderCode } = req.body;

    if (!userId || !senderCode) {
      return res.status(400).json({ ok: false, error: "Missing userId or senderCode" });
    }

    // Trim and validate sender code format (alphanumeric, 5-20 chars)
    const trimmedCode = String(senderCode || "").trim();
    if (!/^[a-zA-Z0-9]{5,20}$/.test(trimmedCode)) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid sender code format. Must be 5-20 alphanumeric characters." 
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Update profiles with sender_id and mark as verified
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          sender_id: trimmedCode,
          sms_verified: true,
          sms_verified_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      if (error.message?.includes("profiles")) {
        return res.status(500).json({ 
          ok: false, 
          error: "Profiles table not set up. Contact support." 
        });
      }
      throw error;
    }

    console.log(`✅ SMS verified for user ${userId} with sender code: ${trimmedCode}`);

    return res.status(200).json({
      ok: true,
      message: "✅ SMS activated! You can now send SMS from your campaigns.",
      sender_id: trimmedCode,
    });
  } catch (error) {
    console.error("SMS verify error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to verify SMS code",
    });
  }
}
