// /pages/api/telephony/sms-status.js
import supabaseAdmin from "../../../utils/supabase-admin";
import { s } from "./_twilio";

const ok = (res, body) => res.status(200).json(body);
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });

/**
 * Twilio Status Callback webhook for SMS delivery.
 *
 * Set this URL in Twilio Messaging:
 *  Status callback: https://<yourdomain>/api/telephony/sms-status
 *
 * Twilio sends form-encoded fields like:
 *  MessageSid, MessageStatus, ErrorCode, To, From
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method not allowed");

  // Twilio sends x-www-form-urlencoded by default
  const sid = s(req.body?.MessageSid || req.body?.SmsSid || req.body?.sid);
  const status = s(req.body?.MessageStatus || req.body?.SmsStatus || req.body?.status);
  const errorCode = req.body?.ErrorCode != null ? String(req.body.ErrorCode) : null;

  if (!sid) return bad(res, 400, "Missing MessageSid");
  if (!status) return bad(res, 400, "Missing MessageStatus");

  try {
    const { error } = await supabaseAdmin
      .from("telephony_messages")
      .update({
        status,
        error_code: errorCode,
        updated_at: new Date().toISOString(),
      })
      .eq("twilio_sid", sid);

    if (error) return bad(res, 500, error.message || "DB update failed");
    return ok(res, { ok: true });
  } catch (e) {
    return bad(res, 500, e?.message || "Unexpected error");
  }
}
