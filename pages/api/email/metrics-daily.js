import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = { api: { bodyParser: true } };

function key(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const { type, id, days = 30 } = req.query;

  const filter = {};
  if (type === "broadcast") filter.broadcast_id = id;
  if (type === "campaigns") filter.campaigns_id = id;
  if (type === "automation") filter.automation_id = id;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from("email_sends")
    .select("*")
    .match(filter)
    .gte("sent_at", since.toISOString());

  if (error) return res.status(500).json({ error: error.message });

  const daily = {};

  for (const r of data) {
    const k = key(r.sent_at);
    if (!daily[k]) daily[k] = { date: k, sent: 0, opens: 0, clicks: 0, bounces: 0 };

    daily[k].sent += 1;
    daily[k].opens += r.open_count || 0;
    daily[k].clicks += r.click_count || 0;
    daily[k].bounces += r.status === "bounced" ? 1 : 0;
  }

  const rows = Object.values(daily).sort((a, b) => (a.date < b.date ? -1 : 1));
  return res.json(rows);
}
