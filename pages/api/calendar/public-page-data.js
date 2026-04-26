// Public booking page data — uses service role key to bypass RLS on availability
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  const [{ data: services, error: sErr }, { data: availability, error: aErr }] = await Promise.all([
    supabaseAdmin.from("services").select("*").eq("user_id", user_id).eq("active", true).order("created_at", { ascending: true }),
    supabaseAdmin.from("provider_availability").select("*").eq("user_id", user_id),
  ]);

  if (sErr) console.error("services error", sErr);
  if (aErr) console.error("availability error", aErr);

  return res.status(200).json({
    services:     services     || [],
    availability: availability || [],
  });
}
