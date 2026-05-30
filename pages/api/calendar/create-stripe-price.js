// /pages/api/calendar/create-stripe-price.js
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { service_id } = req.body;
  if (!service_id) return res.status(400).json({ error: "Service ID required" });

  const { data: service, error } = await supabaseAdmin
    .from("services")
    .select("*")
    .eq("id", service_id)
    .eq("user_id", req.user.id)
    .single();

  if (error || !service) return res.status(404).json({ error: "Service not found" });
  if (!service.price || service.price <= 0) return res.status(400).json({ error: "Service must have a price > 0" });

  const product = await stripe.products.create({ name: service.name });
  const price = await stripe.prices.create({
    unit_amount: Math.round(service.price * 100),
    currency: "aud",
    product: product.id,
  });

  await supabaseAdmin
    .from("services")
    .update({ stripe_price_id: price.id })
    .eq("id", service.id)
    .eq("user_id", req.user.id);

  return res.status(200).json({ success: true, stripe_price_id: price.id });
}

export default withWorkspace(handler, { roles: ["owner", "admin"] });
