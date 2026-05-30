// /pages/api/paypal/webhook.js
// Handles PayPal payment completions and records affiliate + platform payouts.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: false, // raw body needed for PayPal verification
  },
};

/**
 * Verify the webhook came from PayPal using their verification endpoint.
 * Docs: https://developer.paypal.com/api/webhooks/v1/#verify-webhook-signature_post
 */
async function verifyPaypalWebhook(req, rawBody) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PAYPAL_WEBHOOK_ID not set — cannot verify webhook");
    return false;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const isLive = process.env.PAYPAL_ENV === "live";
  const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

  // Get PayPal access token
  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) return false;
  const { access_token } = await tokenRes.json();

  // Verify signature
  const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: req.headers["paypal-auth-algo"],
      cert_url: req.headers["paypal-cert-url"],
      transmission_id: req.headers["paypal-transmission-id"],
      transmission_sig: req.headers["paypal-transmission-sig"],
      transmission_time: req.headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody.toString()),
    }),
  });

  if (!verifyRes.ok) return false;
  const { verification_status } = await verifyRes.json();
  return verification_status === "SUCCESS";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBody = await buffer(req);

    // Reject unverified webhooks — prevents spoofed payment events
    const verified = await verifyPaypalWebhook(req, rawBody);
    if (!verified) {
      console.error("PayPal webhook signature verification failed");
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const body = JSON.parse(rawBody.toString());

    const eventType = body.event_type;
    const resource = body.resource;

    // Only handle completed captures (successful payments)
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const productId = resource.custom_id || resource.supplementary_data?.related_ids?.order_id;
      const affiliateId = resource.invoice_id; // store affiliate ID in invoice field if used
      const saleTotal = parseFloat(resource.amount?.value || 0);

      // Fetch product commission from Supabase
      const { data: product, error: productError } = await supabaseAdmin
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
      const { error: payoutError } = await supabaseAdmin.from("payouts").insert([
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
