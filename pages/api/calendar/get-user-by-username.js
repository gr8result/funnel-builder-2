import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: "Username required" });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      username,
      calendar_enabled,
      calendar_buffer_minutes,
      calendar_refund_cutoff_hours,
      calendar_max_daily_bookings
    `)
    .eq("username", username)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "User not found" });
  }

  if (!data.calendar_enabled) {
    return res.status(403).json({ error: "Calendar disabled" });
  }

  return res.status(200).json({ user: data });
}