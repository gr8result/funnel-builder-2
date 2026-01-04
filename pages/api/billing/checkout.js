// pages/api/billing/checkout.js
import Stripe from "stripe";
import { slugsToPriceIds } from "../../../services/modules";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    let { priceIds, slugs, successUrl, cancelUrl } = req.body || {};

    // Support either slugs or priceIds (or both). This keeps your existing UI working.
    if ((!Array.isArray(priceIds) || priceIds.length === 0) && Array.isArray(slugs) && slugs.length > 0) {
      priceIds = slugsToPriceIds(slugs);
    }

    if (!Array.isArray(priceIds) || priceIds.length === 0) {
      return res.status(400).json({ error: "No modules selected." });
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const line_items = priceIds.map((price) => ({ price, quantity: 1 }));

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      success_url: successUrl || `${base}/billing?success=1`,
      cancel_url: cancelUrl || `${base}/billing?cancel=1`,
      customer_creation: "if_required",
      allow_promotion_codes: true,
      // keep any slugs you passed for easier mapping in the webhook
      metadata: { module_slugs: Array.isArray(slugs) ? slugs.join(",") : "" },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Checkout failed" });
  }
}
