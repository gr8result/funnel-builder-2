import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { getCalendarPlanServer } from "../../../lib/calendar/getCalendarPlanServer";

async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { hasAccess } = await getCalendarPlanServer(req.user.id);
  if (!hasAccess) {
    return res.status(403).json({ error: "Calendar module is not active. Please choose a calendar plan in billing." });
  }

  const { id, name, duration_minutes, price, stripe_price_id } = req.body;
  if (!id) return res.status(400).json({ error: "Service ID required" });

  const { data: existing } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("id", id)
    .eq("user_id", req.user.id)
    .single();

  if (!existing) return res.status(404).json({ error: "Service not found" });

  const { error } = await supabaseAdmin
    .from("services")
    .update({
      name,
      duration_minutes: duration_minutes ? parseInt(duration_minutes) : undefined,
      price: price ? parseInt(price) : 0,
      stripe_price_id: stripe_price_id || null,
    })
    .eq("id", id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
}

export default withWorkspace(handler, { roles: ["owner", "admin"] });