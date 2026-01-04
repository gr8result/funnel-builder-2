// /pages/api/twilio/recording-status.js
// Optional: Twilio hits this when recording completes (we don't need to store anything yet).
// Keeps Twilio happy and gives you a hook to store to Supabase later.

export default async function handler(req, res) {
  // Twilio posts form-encoded data; Next parses it into req.body if bodyParser is on.
  // We just acknowledge.
  return res.status(200).json({ ok: true });
}
