// /pages/api/calendar/create-custom-field.js

import { createClient } from "@supabase/supabase-js";
import { getCalendarPlanServer } from "../../../lib/calendar/getCalendarPlanServer";
import { withAuth } from "../../../lib/withWorkspace";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== "POST") {
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
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: "Invalid user" });
  }

  const { config, hasAccess } = await getCalendarPlanServer(user.id);

  if (!hasAccess) {
    return res.status(403).json({
      error: "Calendar module is not active. Please choose a calendar plan in billing.",
    });
  }

  if (!config.customFields) {
    return res.status(403).json({
      error: "Custom fields require Growth plan or higher.",
    });
  }

  const { service_id, label, field_type, required } = req.body;

  if (!service_id || !label || !field_type) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const { error } = await supabaseAdmin
    .from("calendar_custom_fields")
    .insert({
      user_id: user.id,
      service_id,
      label,
      field_type,
      required: required || false,
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}

export default withAuth(handler);
