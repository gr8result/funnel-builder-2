// /pages/api/email/campaigns/worker.js
// FULL REPLACEMENT — STUB (disabled so it can’t break anything)
// ✅ This endpoint is NOT used. We use /pages/api/email/process-campaign-queue.js instead.
// ✅ Prevents accidental calls / confusion.

async function handler(req, res) {
  return res.status(410).json({
    ok: false,
    error:
      "Deprecated. Use POST /api/email/process-campaign-queue (or Supabase Edge Function process-email-queue).",
  });
}

function withCronSecret(h) {
  return async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers['x-cron-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return h(req, res);
  };
}

export default withCronSecret(handler);
