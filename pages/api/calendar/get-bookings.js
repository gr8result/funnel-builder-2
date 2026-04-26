import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: "Invalid user" });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
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
    .eq("user_id", user.id)
    .order("start_datetime", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const upcoming = data.filter(
    (b) => b.start_datetime >= now && b.status !== "cancelled"
  );

  const past = data.filter(
    (b) => b.start_datetime < now && b.status !== "cancelled"
  );

  const cancelled = data.filter((b) => b.status === "cancelled");

  return res.status(200).json({
    upcoming,
    past,
    cancelled,
  });
}