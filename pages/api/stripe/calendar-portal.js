// /pages/api/stripe/calendar-portal.js
// FULL FILE

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = req.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("calendar_subscription_id")
    .eq("id", userId)
    .single();

  if (!profile?.calendar_subscription_id) {
    return res.status(400).json({ error: "No subscription found" });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.calendar_subscription_id,
    return_url: process.env.NEXT_PUBLIC_SITE_URL,
  });

  return res.json({ url: portal.url });
}

export default withAuth(handler);
