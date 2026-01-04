// /pages/api/sales/webhook.js
// Handles Stripe checkout completions and records affiliate + platform payouts.

import Stripe from "stripe";
import { supabase } from "../../../utils/supabase-client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
      const productId = session.metadata?.product_id;
      const affiliateId = session.metadata?.affiliate_id;
      const saleTotal = parseFloat(session.amount_total / 100);

      // Fetch product details
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("commission")
        .eq("id", productId)
        .single();

      if (productError || !product) {
        throw new Error("Product not found or Supabase query failed.");
      }

      const commissionRate = product.commission || 0;

      // ✅ Commission calculations
      const affiliateEarnings = (saleTotal * commissionRate) / 100;
      const platformEarnings = affiliateEarnings * 0.5; // your 50% share
      const totalDeduction = affiliateEarnings + platformEarnings;

      // ✅ Record in payouts
      const { error: payoutError } = await supabase.from("payouts").insert([
        {
          sale_total: saleTotal,
          affiliate_id: affiliateId,
          product_id: productId,
          affiliate_earnings: affiliateEarnings,
          platform_earnings: platformEarnings,
          total_deduction: totalDeduction,
        },
      ]);

      if (payoutError) throw payoutError;

      console.log("✅ Payout recorded:", {
        saleTotal,
        affiliateEarnings,
        platformEarnings,
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("❌ Error recording payout:", err.message);
      return res.status(500).json({ error: err.message });
    }
  } else {
    return res.status(200).send("Event type not handled.");
  }
}

// Helper to get raw body (needed by Stripe)
import { Readable } from "stream";
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
