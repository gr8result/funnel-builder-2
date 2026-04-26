// pages/api/stripe/webhook.js
// Handles Stripe checkout.session.completed for booking payments.
// Saves the booking to Supabase + sends confirmation/notification emails.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  sendBookingConfirmation,
  sendProviderBookingNotification,
} from "../../../lib/email/sendBookingConfirmation";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Only handle completed checkouts
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const meta = session.metadata || {};

  // Only handle booking purchases
  if (meta.gr8_type !== "booking_purchase") {
    return res.status(200).json({ received: true });
  }

  const {
    serviceId,
    providerUserId,
    clientName,
    clientEmail,
    clientPhone,
    selectedSlot,
    duration,
    customFieldData,
  } = meta;

  if (!serviceId || !providerUserId || !clientEmail || !selectedSlot) {
    console.error("Webhook: missing booking metadata", meta);
    return res.status(400).json({ error: "Missing booking metadata" });
  }

  try {
    const startDatetime = new Date(selectedSlot);
    const endDatetime = new Date(startDatetime.getTime() + Number(duration) * 60000);

    // Idempotency: check if booking already exists for this payment intent
    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("payment_intent_id", session.payment_intent)
      .maybeSingle();

    if (existing) {
      console.log("Webhook: booking already exists, skipping");
      return res.status(200).json({ received: true });
    }

    // Save booking
    const { error: insertError } = await supabase.from("bookings").insert({
      user_id: providerUserId,
      service_id: serviceId,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || null,
      start_datetime: startDatetime.toISOString(),
      end_datetime: endDatetime.toISOString(),
      status: "confirmed",
      amount_paid: session.amount_total,
      payment_intent_id: session.payment_intent,
      custom_field_data: customFieldData ? JSON.parse(customFieldData) : {},
    });

    if (insertError) {
      console.error("Webhook: booking insert error:", insertError);
      return res.status(500).json({ error: insertError.message });
    }

    // Get service details
    const { data: service } = await supabase
      .from("services")
      .select("name, price")
      .eq("id", serviceId)
      .maybeSingle();

    const serviceName = service?.name || "Appointment";
    const price = service?.price || session.amount_total / 100;

    // Get provider profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, email")
      .eq("id", providerUserId)
      .maybeSingle();

    let providerEmail = profile?.email;
    if (!providerEmail) {
      const { data: authData } = await supabase.auth.admin.getUserById(providerUserId);
      providerEmail = authData?.user?.email;
    }

    const providerName = profile?.username || "Provider";

    // Send emails (don't let email failure break the webhook response)
    try {
      await sendBookingConfirmation({
        clientEmail,
        clientName,
        providerName,
        serviceName,
        startDatetime: startDatetime.toISOString(),
        duration,
        price,
      });
    } catch (e) {
      console.error("Webhook: confirmation email failed:", e.message);
    }

    if (providerEmail) {
      try {
        await sendProviderBookingNotification({
          providerEmail,
          providerName,
          clientName,
          clientEmail,
          clientPhone,
          serviceName,
          startDatetime: startDatetime.toISOString(),
          duration,
        });
      } catch (e) {
        console.error("Webhook: provider notification failed:", e.message);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: err.message });
  }
}
