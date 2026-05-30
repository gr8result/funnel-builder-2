// Fix SMS queue - delete failed rows and update sender_id case
import { createClient } from "@supabase/supabase-js";
import { withAdmin } from "../../lib/withAdmin";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const action = req.query.action || "all";

    const results = {};

    // 1. Delete failed queue rows with wrong origin
    if (action === "all" || action === "clear-queue") {
      const { data: deleted, error: delErr } = await supabaseAdmin
        .from("sms_queue")
        .delete()
        .eq("status", "failed")
        .eq("origin", "gr8result");

      if (delErr) throw delErr;
      results.deleted_queue_rows = deleted?.length || 0;
    }

    // 2. Fix sender_id case in accounts table
    if (action === "all" || action === "fix-sender-case") {
      const correctSenderId = req.query.sender_id || "WaitandSea";
      
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("accounts")
        .update({ sender_id: correctSenderId })
        .eq("user_id", "3c921040-cd45-4a05-ba74-60db34591091");

      if (updateErr) throw updateErr;
      results.fixed_sender_id = correctSenderId;
    }

    return res.status(200).json({
      ok: true,
      ...results,
      message: "Fixed! Now queue a new campaign and it should work.",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export default withAdmin(handler);
