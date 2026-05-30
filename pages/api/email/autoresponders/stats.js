import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../../lib/withWorkspace";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  try {
    const { data: rows, error } = await supabase
      .from("email_autoresponder_queue")
      .select("autoresponder_id,status,sent_at");

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    const stats = {};

    for (const r of rows || []) {
      const id = r.autoresponder_id;
      if (!id) continue;

      if (!stats[id]) {
        stats[id] = {
          autoresponder_id: id,
          queued: 0,
          pending: 0,
          sent: 0,
          failed: 0,
          last_sent_at: null,
          opens_total: 0,
          opens_unique: 0,
        };
      }

      if (r.status === "queued") stats[id].queued++;
      if (r.status === "pending") stats[id].pending++;
      if (r.status === "failed") stats[id].failed++;

      if (r.status === "sent") {
        stats[id].sent++;
        if (
          r.sent_at &&
          (!stats[id].last_sent_at ||
            new Date(r.sent_at) > new Date(stats[id].last_sent_at))
        ) {
          stats[id].last_sent_at = r.sent_at;
        }
      }
    }

    return res.json({
      ok: true,
      data: Object.values(stats),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || String(e),
    });
  }
}

export default withAuth(handler);
