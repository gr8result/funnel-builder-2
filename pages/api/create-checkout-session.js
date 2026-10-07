// /pages/api/create-checkout-session.js
// Stripe Checkout session creation endpoint

import Stripe from "stripe";
import { demoSimulationResult, getRequestDemoState, requestWorkspaceId } from "../../lib/demoWorkspace";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
      const origin = req.headers.origin || "http://localhost:3000";
      const result = await demoSimulationResult({
        workspaceId,
        actionType: "checkout-session",
        provider: "stripe",
        target: priceId,
        payload: { priceId },
        message: "Demo checkout simulated - no Stripe session created.",
      });
      return res.status(200).json({
        ...result,
        id: `demo_checkout_${Date.now()}`,
        url: `${origin}/checkout/success?demo=1&workspace_id=${encodeURIComponent(workspaceId)}`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin || "http://localhost:3000"}/checkout/success`,
      cancel_url: `${req.headers.origin || "http://localhost:3000"}/checkout/cancel`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
