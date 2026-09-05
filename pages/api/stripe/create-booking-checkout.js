// /pages/api/stripe/create-booking-checkout.js 
// FULL FILE — Booking Stripe Checkout (Connect Compatible + Custom Field Safe)

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";
import { demoSimulationResult } from "../../../lib/demoWorkspace";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      serviceId,
      providerUserId,
      serviceName,
      price,
      clientName,
      clientEmail,
      selectedSlot,
      duration,
      customFieldData, // ✅ ADDED (SAFE)
    } = req.body;

    if (
      !serviceId ||
      !providerUserId ||
      !serviceName ||
      !price ||
      !clientName ||
      !clientEmail ||
      !selectedSlot ||
      !duration
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get provider stripe account
    const { data: provider } =
      await supabase.auth.admin.getUserById(providerUserId);

    const stripeAccountId =
      provider?.user?.user_metadata?.stripe_account_id || null;

    // stripeAccountId is optional — if absent, charge goes to the platform account directly

    const platformFeePercent = 10; // 🔥 change if needed
    const priceInCents = Math.round(Number(price) * 100);
    const platformFee = Math.round(
      (priceInCents * platformFeePercent) / 100
    );

    // Build Stripe session — works with OR without Stripe Connect
    const sessionParams = {
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: clientEmail,
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: { name: serviceName },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        gr8_type: "booking_purchase",
        serviceId,
        providerUserId,
        clientName,
        clientEmail,
        clientPhone: req.body.clientPhone || "",
        selectedSlot,
        duration,
        customFieldData: JSON.stringify(customFieldData || {}),
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/booking-success`,
      cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL}/booking-cancelled`,
    };

    // If the provider has Stripe Connect, split the payment
    if (stripeAccountId) {
      sessionParams.payment_intent_data = {
        application_fee_amount: platformFee,
        transfer_data: { destination: stripeAccountId },
      };
    }

    if (req.isDemoWorkspace) {
      const result = await demoSimulationResult({
        workspaceId: req.workspaceId,
        actionType: "booking-checkout",
        provider: "stripe",
        target: serviceId,
        payload: sessionParams.metadata,
        userId: req.user?.id,
        message: "Demo booking checkout simulated - no Stripe session created.",
      });
      return res.status(200).json({
        ...result,
        id: `demo_booking_checkout_${Date.now()}`,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/booking-success?demo=1&workspace_id=${encodeURIComponent(req.workspaceId || "")}`,
      });
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Booking checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
