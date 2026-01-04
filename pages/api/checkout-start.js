// pages/api/checkout-start.js
// Called when someone REACHES the checkout page

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // In real life you’ll send these from your frontend
  const { user_id, contact_id, cart_items } = req.body;

  if (!user_id || !contact_id) {
    return res.status(400).json({ error: "Missing user_id or contact_id" });
  }

  // 1) create a checkout_session row
  const { data: session, error: sessionErr } = await supabase
    .from("checkout_sessions")
    .insert({
      user_id,
      contact_id,
      status: "open",
      cart_items: cart_items || null,
    })
    .select()
    .single();

  if (sessionErr) {
    console.error(sessionErr);
    return res.status(500).json({ error: sessionErr.message });
  }

  // 2) log an event (optional, but nice)
  const { error: eventErr } = await supabase
    .from("automation_events")
    .insert({
      contact_id,
      event_type: "checkout_started",
      payload: { session_id: session.id, cart_items: cart_items || null },
    });

  if (eventErr) {
    console.error(eventErr);
    // not fatal, we already created the session
  }

  return res.status(200).json({ ok: true, session_id: session.id });
}
