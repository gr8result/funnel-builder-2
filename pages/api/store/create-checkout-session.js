// pages/api/store/create-checkout-session.js
// SIMPLE TEST VERSION
// - Does NOT use the products table yet
// - Always creates a checkout for "Test Product" ($20 AUD)
// - Still logs checkout_sessions for abandoned-cart tracking

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { product_id, user_id, contact_id, quantity = 1 } = req.body;

    // For this simple test, product_id is optional – we won't look it up in Supabase yet
    if (!user_id || !contact_id) {
      return res
        .status(400)
        .json({ error: "Missing user_id or contact_id" });
    }

    // --- SIMPLE TEST PRODUCT DATA (no DB lookup) ---
    const unitAmountCents = 2000; // $20.00
    const currency = "AUD";
    const productName = "Test Product";
    const productDescription = "Testing store checkout";

    // 1) Create our own checkout_sessions row (for abandoned cart tracking)
    const cart_items = {
      items: [
        {
          product_id: product_id || "test-product",
          name: productName,
          price_cents: unitAmountCents,
          currency,
          quantity,
        },
      ],
    };

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("checkout_sessions")
      .insert({
        user_id,      // which account / store this belongs to
        contact_id,   // which lead is buying
        status: "open",
        cart_items,
      })
      .select()
      .single();

    if (sessionErr || !sessionRow) {
      console.error("checkout_sessions insert error:", sessionErr);
      return res
        .status(500)
        .json({ error: "Failed to create checkout session" });
    }

    // 2) Create Stripe Checkout Session (hosted Stripe page)
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancelled`,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: unitAmountCents,
          },
          quantity,
        },
      ],
      metadata: {
        app_checkout_session_id: sessionRow.id,
        app_user_id: user_id,
        app_contact_id: contact_id,
        app_product_id: product_id || "test-product",
      },
    });

    return res.status(200).json({ url: stripeSession.url });
  } catch (err) {
    console.error("Error creating store checkout session:", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
}
