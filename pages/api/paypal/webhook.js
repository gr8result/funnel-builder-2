// /pages/api/paypal/webhook.js
// Handles PayPal payment completions and records affiliate + platform payouts.

import { supabase } from "../../../utils/supabase-client";

export const config = {
  api: {
    bodyParser: false, // raw body needed for PayPal verification
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBody = await buffer(req);
    const body = JSON.parse(rawBody.toString());

    const eventType = body.event_type;
    const resource = body.resource;

    // Only handle completed captures (successful payments)
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const productId = resource.custom_id || resource.supplementary_data?.related_ids?.order_id;
      const affiliateId = resource.invoice_id; // store affiliate ID in invoice field if used
      const saleTotal = parseFloat(resource.amount?.value || 0);

      // Fetch product commission from Supabase
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("commission")
        .eq("id", productId)
        .single();

      if (productError || !product) {
        throw new Error("Product not found in Supabase.");
      }

      const commissionRate = product.commission || 0;
      const affiliateEarnings = (saleTotal * commissionRate) / 100;
      const platformEarnings = affiliateEarnings * 0.5; // your 50% share
      const totalDeduction = affiliateEarnings + platformEarnings;

      // Save payout record
      const { error: payoutError } = await supabase.from("payouts").insert([
        {
          sale_total: saleTotal,
          affiliate_id: affiliateId,
          product_id: productId,
          affiliate_earnings: affiliateEarnings,
          platform_earnings: platformEarnings,
          total_deduction: totalDeduction,
          source: "paypal",
        },
      ]);

      if (payoutError) throw payoutError;

      console.log("✅ PayPal Payout Recorded:", {
        saleTotal,
        affiliateEarnings,
        platformEarnings,
      });

      return res.status(200).json({ success: true });
    }

    return res.status(200).send("Event not handled.");
  } catch (err) {
    console.error("❌ PayPal webhook error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Helper — read raw request body
import { Readable } from "stream";
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
