// pages/api/checkout-complete.js
// Called when an order is PAID

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { session_id, user_id, contact_id, amount_cents, currency } = req.body;

  // Fetch Stripe session to get product metadata
  let productMeta = {};
  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session && session.metadata) {
        productMeta = session.metadata;
      }
    } catch (err) {
      console.error("Error fetching Stripe session for metadata:", err);
    }
  }

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


  // 2) create an order (using your existing orders table) and get the new order's id
  const { data: orderData, error: orderErr } = await supabase.from("orders").insert({
    user_id,
    amount_cents: amount_cents || 0,
    currency: currency || "AUD",
    status: "paid",
    created_at: new Date().toISOString(),
  }).select().single();

  const order_id = orderData?.id;

  if (orderErr) {
    console.error(orderErr);
    // we won't fail the response, but note this
  }

  // 2b) Insert into sales table (customize fields as needed)
  await supabase.from("sales").insert([{
    amount: (amount_cents || 0) / 100,
    currency: currency || "AUD",
    user_id,
    order_id,
    link_id: session_id,
    product_type: productMeta.product_type || "unknown",
    product_id: productMeta.product_id || null,
    product_name: productMeta.product_name || null,
    product_tag: productMeta.product_tag || null,
    // The following fields can be filled in as you expand your integration:
    course_id: null,
    course_title: null,
    shipping_address: null,
    shipped_at: null,
    download_url: null,
    license_key: null,
    stream: productMeta.product_type ? (
      productMeta.product_type === "physical" ? "Physical Products" :
      productMeta.product_type === "digital" ? "Digital Products" :
      productMeta.product_type === "online_course" ? "Online Courses" :
      productMeta.product_type === "module_bundle" ? "Online Courses" :
      "Other"
    ) : "Unknown",
    metadata: productMeta,
    created_at: new Date().toISOString(),
  }]);

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
