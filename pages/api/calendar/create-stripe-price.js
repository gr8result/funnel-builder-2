// /pages/api/calendar/create-stripe-price.js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid user" });

  const { service_id } = req.body;
  if (!service_id) return res.status(400).json({ error: "Service ID required" });

  const { data: service, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", service_id)
    .eq("user_id", user.id)
    .single();

  if (error || !service) return res.status(404).json({ error: "Service not found" });
  if (!service.price || service.price <= 0) return res.status(400).json({ error: "Service must have a price > 0" });

  const product = await stripe.products.create({ name: service.name });
  const price = await stripe.prices.create({
    unit_amount: Math.round(service.price * 100), // cents
    currency: "aud",
    product: product.id,
  });

  await supabase
    .from("services")
    .update({ stripe_price_id: price.id })
    .eq("id", service.id)
    .eq("user_id", user.id);

  return res.status(200).json({ success: true, stripe_price_id: price.id });
}
