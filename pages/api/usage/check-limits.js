// /pages/api/usage/check-limits.js
// Check and return usage limits for email, SMS, and subscribers

import { getUsageStats, canSendEmail, canSendSms, canAddToList } from "../../../lib/usageTracking";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { Authorization } = req.headers;
    if (!Authorization) {
      return res.status(401).json({ error: "Missing authorization" });
    }

    const token = Authorization.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get full usage stats
    const stats = await getUsageStats(user.id);
    if (!stats) {
      return res.status(400).json({ error: "Could not fetch account info" });
    }

    // Check specific limits if requested
    const { check = "" } = req.query;
    let checks = {};

    if (check.includes("email") || !check) {
      checks.email = await canSendEmail(user.id);
    }

    if (check.includes("sms") || !check) {
      checks.sms = await canSendSms(user.id);
    }

    if (check.includes("list") || !check) {
      const listId = req.query.listId;
      if (listId) {
        checks.list = await canAddToList(user.id, listId);
      }
    }

    return res.status(200).json({
      ok: true,
      stats,
      checks,
    });
  } catch (err) {
    console.error("Usage check error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withAuth(handler);
