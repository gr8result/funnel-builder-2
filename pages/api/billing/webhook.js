// /pages/api/billing/webhook.js
import Stripe from "stripe";
import { priceToSlugMap } from "../../../services/modules";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// Secure Supabase service client (server-only)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Utility to read raw body (needed for Stripe signature verification)
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(Buffer.from(data)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const sig = req.headers["stripe-signature"];
  const buf = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Bad webhook signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // =========================================================
    // ✅ CHECKOUT COMPLETED
    // =========================================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const subscriptionId = session.subscription;
      const customerId = session.customer;
      const email = session.customer_details?.email || "";

      console.log("💳 Checkout complete for:", email);

      // Lookup user_id from profiles or accounts
      let userId = null;
      if (email) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("email", email)
          .maybeSingle();
        userId = prof?.user_id || null;

        // fallback: check accounts table
        if (!userId) {
          const { data: acct } = await supabaseAdmin
            .from("accounts")
            .select("user_id")
            .eq("email", email)
            .maybeSingle();
          userId = acct?.user_id || null;
        }
      }

      // Map modules to slugs
      const priceMap = priceToSlugMap();
      let slugs = [];
      if (session.metadata?.module_slugs) {
        slugs = session.metadata.module_slugs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        slugs = (sub.items?.data || [])
          .map((it) => priceMap[it.price?.id])
          .filter(Boolean);
      }

      // ✅ Grant entitlements
      if (userId && slugs.length) {
        const now = new Date().toISOString();
        for (const slug of slugs) {
          await supabaseAdmin
            .from("entitlements")
            .upsert(
              {
                user_id: userId,
                module_slug: slug,
                active: true,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                updated_at: now,
              },
              { onConflict: "user_id,module_slug" }
            );
        }

        // ✅ Mark account as active/paid
        await supabaseAdmin
          .from("accounts")
          .update({
            subscription_status: "active",
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        console.log("✅ Entitlements and account activated for", email);
      }
    }

    // =========================================================
    // 🔁 SUBSCRIPTION UPDATED
    // =========================================================
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const priceMap = priceToSlugMap();
      const items = sub.items?.data || [];
      const slugs = items.map((it) => priceMap[it.price?.id]).filter(Boolean);

      const active = ["active", "trialing", "past_due"].includes(sub.status);
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      const { data: ent } = await supabaseAdmin
        .from("entitlements")
        .select("user_id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();

      const userId = ent?.user_id || null;

      if (userId && slugs.length) {
        for (const slug of slugs) {
          await supabaseAdmin
            .from("entitlements")
            .upsert(
              {
                user_id: userId,
                module_slug: slug,
                active,
                stripe_customer_id: sub.customer,
                stripe_subscription_id: sub.id,
                current_period_end: periodEnd,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,module_slug" }
            );
        }

        // update subscription status
        await supabaseAdmin
          .from("accounts")
          .update({
            subscription_status: active ? "active" : "inactive",
            status: active ? "active" : "inactive",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        console.log(`🔁 Subscription updated → ${sub.status}`);
      }
    }

    // =========================================================
    // 🧨 SUBSCRIPTION DELETED / CANCELLED
    // =========================================================
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      await supabaseAdmin
        .from("entitlements")
        .update({
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);

      // mark user inactive
      await supabaseAdmin
        .from("accounts")
        .update({
          subscription_status: "cancelled",
          status: "inactive",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);

      console.log("🛑 Subscription cancelled for:", sub.id);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("🔥 Webhook handler error:", err);
    res.status(500).send("Webhook handler error");
  }
}
