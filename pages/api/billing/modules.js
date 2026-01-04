// /pages/api/billing/modules.js
// Fetch valid Stripe-linked modules from Supabase

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { selected } = req.body;

  if (!selected || !Array.isArray(selected) || selected.length === 0) {
    return res.status(400).json({ success: false, error: "No modules selected" });
  }

  const { data, error } = await supabase
    .from("modules")
    .select("id, name, price_cents, stripe_price_id")
    .in("id", selected);

  if (error) {
    console.error("Supabase error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }

  if (!data || data.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid module selection" });
  }

  return res.status(200).json({ success: true, modules: data });
}
