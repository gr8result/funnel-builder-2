import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { getCalendarPlanServer } from "../../../lib/calendar/getCalendarPlanServer";

async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { hasAccess } = await getCalendarPlanServer(req.user.id);
  if (!hasAccess) {
    return res.status(403).json({ error: "Calendar module is not active. Please choose a calendar plan in billing." });
  }

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Service ID required" });

  const { data: service } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("id", id)
    .eq("user_id", req.user.id)
    .single();

  if (!service) return res.status(404).json({ error: "Service not found" });

  const { data: futureBookings, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("service_id", id)
    .gte("start_datetime", new Date().toISOString());

  if (bookingError) return res.status(500).json({ error: bookingError.message });
  if (futureBookings && futureBookings.length > 0) {
    return res.status(400).json({ error: "Cannot delete service with future bookings" });
  }

  const { error } = await supabaseAdmin
    .from("services")
    .delete()
    .eq("id", id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
}

export default withWorkspace(handler, { roles: ["owner", "admin"] });