import { timingSafeEqual } from "node:crypto";
import { retryPendingFunnelSubmissions } from "../../../lib/funnels/formSubmissions";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const secret = process.env.CRON_SECRET || "";
  const supplied = Buffer.from(String(req.headers.authorization || ""));
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  try {
    const results = await retryPendingFunnelSubmissions();
    return res.status(200).json({ ok: true, attempted: results.length, synced: results.filter((result) => result.ok).length });
  } catch (error) {
    console.error("[funnels/cron-sync]", error.message);
    return res.status(500).json({ ok: false, error: "Retry failed" });
  }
}
