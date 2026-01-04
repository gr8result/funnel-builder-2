// /scripts/sync-stripe-products.js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); // ensure it loads your keys


// ====== Setup ======
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncModules() {
  console.log("🔄 Syncing modules with Stripe...");

  const { data: modules, error } = await supabase
    .from("modules")
    .select("*")
    .eq("active", true);

  if (error) throw error;

  for (const mod of modules) {
    console.log(`➡️ Processing: ${mod.name} (${mod.id})`);

    // Skip if already synced
    if (mod.stripe_price_id) {
      console.log(`   ✅ Already has Stripe price ID: ${mod.stripe_price_id}`);
      continue;
    }

    // 1️⃣ Create Stripe Product
    const product = await stripe.products.create({
      name: mod.name,
      active: true,
    });

    // 2️⃣ Create recurring Price (monthly)
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: mod.price_cents,
      currency: "aud",
      recurring: { interval: "month" },
    });

    // 3️⃣ Save IDs to Supabase
    const { error: updateErr } = await supabase
      .from("modules")
      .update({ stripe_price_id: price.id })
      .eq("id", mod.id);

    if (updateErr) console.error("❌ Update error:", updateErr.message);
    else console.log(`   💾 Saved Stripe price ID: ${price.id}`);
  }

  console.log("✅ Stripe sync complete!");
}

syncModules().catch((err) => {
  console.error("❌ Sync failed:", err.message);
});
