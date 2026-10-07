// /pages/api/stripe/create-checkout-session.js
import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getRequestDemoState, requestWorkspaceId, demoSimulationResult } from "../../../lib/demoWorkspace";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { priceId } = req.body;
  if (!priceId) {
    return res.status(400).json({ error: "Missing priceId" });
  }

  try {
    const workspaceId = requestWorkspaceId(req);
    const demoState = await getRequestDemoState(req);
    if (demoState.isDemo) {
      const simulated = await demoSimulationResult({
        workspaceId,
        actionType: "stripe-checkout-session",
        provider: "stripe",
        target: priceId,
        payload: { priceId },
        message: "Demo Stripe Checkout simulated - no Stripe session created.",
      });
      return res.status(200).json({ ...simulated, url: `/checkout/success?demo=1&workspace_id=${encodeURIComponent(workspaceId)}` });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: err.message });
  }
}
