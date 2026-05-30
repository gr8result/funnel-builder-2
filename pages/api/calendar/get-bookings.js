import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      *,
      services (
        id,
        name,
        duration_minutes,
        price
      )
    `)
    .eq("user_id", req.user.id)
    .order("start_datetime", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const upcoming = data.filter((b) => b.start_datetime >= now && b.status !== "cancelled");
  const past = data.filter((b) => b.start_datetime < now && b.status !== "cancelled");
  const cancelled = data.filter((b) => b.status === "cancelled");

  return res.status(200).json({ upcoming, past, cancelled });
}

export default withWorkspace(handler);