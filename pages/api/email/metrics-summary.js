// /pages/api/email/metrics-summary.js
// Returns aggregate metrics from email_sends for a given broadcast/campaigns/automation.
// Usage:
//   /api/email/metrics-summary?type=broadcast&id=<uuid>
//   /api/email/metrics-summary?type=campaigns&id=<uuid>
//   /api/email/metrics-summary?type=automation&id=<uuid>

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET" });
  }

  const { type, id } = req.query || {};

  if (!type || !id) {
    return res
      .status(400)
      .json({ error: "Missing type or id. Example: ?type=broadcast&id=..." });
  }

  const match = {};
  if (type === "broadcast") {
    match.broadcast_id = id;
  } else if (type === "campaigns") {
    match.campaigns_id = id;
  } else if (type === "automation") {
    match.automation_id = id;
  } else {
    return res.status(400).json({ error: "Invalid type (broadcast|campaigns|automation)" });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("email_sends")
      .select("status, open_count, click_count, unsubscribed")
      .match(match);

    if (error) {
      console.error("[metrics-summary] select error:", error);
      return res.status(500).json({ error: "Error loading email_sends" });
    }

    if (!rows || rows.length === 0) {
      return res.json({
        type,
        id,
        sent: 0,
        delivered: 0,
        bounces: 0,
        opens: 0,
        unique_opens: 0,
        clicks: 0,
        unique_clicks: 0,
        unsubscribes: 0,
        spamreports: 0,
      });
    }

    let sent = rows.length;
    let delivered = 0;
    let bounces = 0;
    let opens = 0;
    let uniqueOpens = 0;
    let clicks = 0;
    let uniqueClicks = 0;
    let unsubscribes = 0;
    let spamreports = 0;

    for (const r of rows) {
      const status = r.status || "sent";
      const openCount = r.open_count || 0;
      const clickCount = r.click_count || 0;
      const unsub = !!r.unsubscribed;

      if (status === "bounced") {
        bounces += 1;
      } else {
        // treat everything else as delivered-ish
        delivered += 1;
      }

      if (status === "spamreport") {
        spamreports += 1;
      }

      if (openCount > 0) {
        uniqueOpens += 1;
      }
      opens += openCount;

      if (clickCount > 0) {
        uniqueClicks += 1;
      }
      clicks += clickCount;

      if (unsub) {
        unsubscribes += 1;
      }
    }

    return res.json({
      type,
      id,
      sent,
      delivered,
      bounces,
      opens,
      unique_opens: uniqueOpens,
      clicks,
      unique_clicks: uniqueClicks,
      unsubscribes,
      spamreports,
    });
  } catch (err) {
    console.error("[metrics-summary] unexpected error:", err);
    return res.status(500).json({
      error: String(err?.message || err),
    });
  }
}
