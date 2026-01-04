// pages/api/checkout-complete.js
// Called when an order is PAID

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { session_id, user_id, contact_id, amount_cents, currency } = req.body;

  if (!session_id || !user_id || !contact_id) {
    return res
      .status(400)
      .json({ error: "Missing session_id, user_id or contact_id" });
  }

  // 1) mark checkout session as completed
  const { error: sessionErr } = await supabase
    .from("checkout_sessions")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", session_id);

  if (sessionErr) {
    console.error(sessionErr);
    return res.status(500).json({ error: sessionErr.message });
  }

  // 2) create an order (using your existing orders table)
  const { error: orderErr } = await supabase.from("orders").insert({
    user_id,
    amount_cents: amount_cents || 0,
    currency: currency || "AUD",
    status: "paid",
    created_at: new Date().toISOString(),
  });

  if (orderErr) {
    console.error(orderErr);
    // we won't fail the response, but note this
  }

  // 3) log an "order_completed" event
  const { error: eventErr } = await supabase
    .from("automation_events")
    .insert({
      contact_id,
      event_type: "order_completed",
      payload: { session_id, amount_cents, currency },
    });

  if (eventErr) {
    console.error(eventErr);
  }

  return res.status(200).json({ ok: true });
}
