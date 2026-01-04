// /pages/api/cron/process-campaign-queue.js
// FULL REPLACEMENT — cron wrapper (calls internal queue worker)
// ✅ Protects endpoint with CRON_SECRET
// ✅ Calls /api/email/process-campaign-queue

export default async function handler(req, res) {
  const secret = req.headers["x-cron-secret"] || req.query?.secret || "";
  if (!process.env.CRON_SECRET) {
    return res.status(500).json({ ok: false, error: "Missing CRON_SECRET env var" });
  }
  if (String(secret) !== String(process.env.CRON_SECRET)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const limit = Number(req.query?.limit || 25);

  const base = process.env.APP_URL || "http://localhost:3000";
  const url = `${base}/api/email/process-campaign-queue`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });

  const text = await r.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  return res.status(r.status).json(data || { ok: r.ok });
}
