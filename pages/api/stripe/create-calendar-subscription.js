// /pages/api/stripe/create-calendar-subscription.js
// FULL FILE

import Stripe from "stripe";
import { withAuth } from "../../../lib/withWorkspace";
import { demoSimulationResult } from "../../../lib/demoWorkspace";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const userId = req.user.id;

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    if (req.isDemoWorkspace) {
      const result = await demoSimulationResult({
        workspaceId: req.workspaceId,
        actionType: "calendar-subscription",
        provider: "stripe",
        target: userId,
        payload: { price: process.env.STRIPE_CALENDAR_PRICE_ID },
        userId,
        message: "Demo calendar subscription simulated - no Stripe session created.",
      });
      return res.json({
        ...result,
        id: `demo_calendar_subscription_${Date.now()}`,
        url: `${baseUrl}/modules/calendar/dashboard?sub=success&demo=1`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_CALENDAR_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/modules/calendar/dashboard?sub=success`,
      cancel_url: `${baseUrl}/modules/calendar/dashboard?sub=cancel`,
      metadata: {
        gr8_type: "calendar_subscription",
        userId,
      },
    });

    return res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Subscription failed" });
  }
}

export default withAuth(handler);
