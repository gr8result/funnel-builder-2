// /pages/api/billing/create-session.js
// ✅ FINAL version — validated payload, works forever with checkout page
// Supports multiple modules, proper AUD conversion, and clear error logging.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { lineItems, metadata = {} } = req.body;

    // 🛡 Validate payload
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      console.error("❌ No valid line items received:", req.body);
      return res.status(400).json({ error: "No modules provided" });
    }

    // 🧮 Convert data for Stripe
    const formattedItems = lineItems
      .filter((item) => item && item.name && !isNaN(item.amount))
      .map((item) => ({
        price_data: {
          currency: "aud",
          product_data: { name: item.name },
          unit_amount: Math.round(Number(item.amount) * 100), // cents
        },
        quantity: 1,
      }));

    if (formattedItems.length === 0) {
      console.error("❌ Invalid or empty formattedItems:", lineItems);
      return res.status(400).json({ error: "No valid items for checkout" });
    }

    // 🧾 Create Stripe session
    const successParts = ["session_id={CHECKOUT_SESSION_ID}"];
    if (metadata.emailPlan) {
      successParts.push(`emailPlan=${encodeURIComponent(String(metadata.emailPlan))}`);
    }
    if (metadata.smsPlan) {
      successParts.push(`smsPlan=${encodeURIComponent(String(metadata.smsPlan))}`);
    }
    if (metadata.calendarPlan) {
      successParts.push(`calendarPlan=${encodeURIComponent(String(metadata.calendarPlan))}`);
    }
    if (metadata.socialPlan) {
      successParts.push(`socialPlan=${encodeURIComponent(String(metadata.socialPlan))}`);
    }
    if (metadata.selected) {
      successParts.push(`selected=${encodeURIComponent(String(metadata.selected))}`);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: formattedItems,
      metadata: {
        emailPlan: metadata.emailPlan ? String(metadata.emailPlan) : "",
        smsPlan: metadata.smsPlan ? String(metadata.smsPlan) : "",
        calendarPlan: metadata.calendarPlan ? String(metadata.calendarPlan) : "",
        socialPlan: metadata.socialPlan ? String(metadata.socialPlan) : "",
        selected: metadata.selected ? String(metadata.selected) : "",
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?${successParts.join("&")}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancel`,
    });

    console.log("✅ Stripe session created successfully:", session.id);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
}
