// ============================================
// /pages/api/telephony/sms-delivery-webhook.js
// ============================================
/**
 * Delivery Receipt webhook endpoint.
 *
 * IMPORTANT:
 * - SMSGlobal may POST/GET delivery receipts here depending on your account/route.
 * - Twilio can also send status callbacks here if you ever swap providers.
 *
 * For now we just log and return OK so you can confirm it’s being hit.
 * Later we can store into Supabase (sms_delivery table) once you confirm schema.
 */

export default async function handler(req, res) {
  const method = req.method || "GET";

  // SMSGlobal might send as querystring (GET) or body (POST)
  const payload = method === "GET" ? req.query : req.body;

  // Keep this noisy for now so you can see it in your server console
  console.log("[sms-delivery-webhook]", method, JSON.stringify(payload));

  // Always 200 so providers don't retry forever
  return res.status(200).json({ ok: true });
}
