// /pages/api/email/campaigns/worker.js
// FULL REPLACEMENT — STUB (disabled so it can’t break anything)
// ✅ This endpoint is NOT used. We use /pages/api/email/process-campaign-queue.js instead.
// ✅ Prevents accidental calls / confusion.

export default function handler(req, res) {
  return res.status(410).json({
    ok: false,
    error:
      "Deprecated. Use POST /api/email/process-campaign-queue (or Supabase Edge Function process-email-queue).",
  });
}
