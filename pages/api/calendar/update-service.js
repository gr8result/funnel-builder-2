import { createClient } from "@supabase/supabase-js";
import { getCalendarPlanServer } from "../../../lib/calendar/getCalendarPlanServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "PUT") {
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

  const { hasAccess } = await getCalendarPlanServer(user.id);
  if (!hasAccess) {
    return res.status(403).json({
      error: "Calendar module is not active. Please choose a calendar plan in billing.",
    });
  }

  const { id, name, duration_minutes, price, stripe_price_id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Service ID required" });
  }

  // Ensure service belongs to user
  const { data: existing } = await supabase
    .from("services")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return res.status(404).json({ error: "Service not found" });
  }

  const { error } = await supabase
    .from("services")
    .update({
      name,
      duration_minutes: duration_minutes
        ? parseInt(duration_minutes)
        : undefined,
      price: price ? parseInt(price) : 0,
      stripe_price_id: stripe_price_id || null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}