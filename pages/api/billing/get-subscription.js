// /pages/api/billing/get-subscription.js
// Returns the active base plan for the authenticated user.
// Uses supabaseAdmin to bypass RLS on the subscriptions table.

import { createClient } from "@supabase/supabase-js";
import { getUserPlan } from "../../../lib/planResolver";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { plan, workspacePlan, subscriptionPlan } = await getUserPlan(supabaseAdmin, user.id);

  return res.status(200).json({
    plan,
    workspacePlan,
    subscriptionPlan,
  });
}
