// /pages/api/stripe/create-connect-link.js
import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // Find or create a Stripe account for the user
    // You should store the accountId in your DB for future reference
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { userId },
    });

    // Generate the onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account`,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account`,
      type: "account_onboarding",
    });

    res.status(200).json({ url: accountLink.url });
  } catch (err) {
    console.error("Stripe Connect error:", err);
    res.status(500).json({ error: err.message });
  }
}
