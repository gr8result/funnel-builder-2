// Handles Stripe webhooks for store checkouts + course purchases

import Stripe from "stripe";
import { buffer } from "micro";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: false }, // Stripe needs raw body
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Server-side Supabase client using SERVICE ROLE key
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const meta = session.metadata || {};

        // ==========================================================
        // ✅ A) COURSE PURCHASES (new, does NOT clash with store)
        // We detect via: meta.gr8_type === "course_purchase"
        // ==========================================================
        if (meta.gr8_type === "course_purchase") {
          const courseId = meta.courseId;
          const scope = meta.scope; // full_course | module
          const moduleId = meta.moduleId || null;
          const userId = meta.userId;

          if (!courseId || !scope || !userId) {
            console.error("Course purchase missing metadata:", meta);
            break;
          }

          if (scope === "full_course") {
            // Insert full entitlement if not exists
            const { data: exists } = await supabase
              .from("course_entitlements")
              .select("id")
              .eq("course_id", courseId)
              .eq("user_id", userId)
              .eq("entitlement_type", "full_course")
              .maybeSingle();

            if (!exists) {
              const { error: entErr } = await supabase.from("course_entitlements").insert({
                course_id: courseId,
                user_id: userId,
                module_id: null,
                entitlement_type: "full_course",
              });

              if (entErr) console.error("Error inserting full entitlement:", entErr);

              await supabase.from("course_enrolments").upsert(
                { course_id: courseId, user_id: userId, access_level: "full" },
                { onConflict: "course_id,user_id" }
              );
            }
          }

          if (scope === "module" && moduleId) {
            const { data: exists } = await supabase
              .from("course_entitlements")
              .select("id")
              .eq("course_id", courseId)
              .eq("user_id", userId)
              .eq("entitlement_type", "module")
              .eq("module_id", moduleId)
              .maybeSingle();

            if (!exists) {
              const { error: entErr } = await supabase.from("course_entitlements").insert({
                course_id: courseId,
                user_id: userId,
                module_id: moduleId,
                entitlement_type: "module",
              });

              if (entErr) console.error("Error inserting module entitlement:", entErr);

              await supabase.from("course_enrolments").upsert(
                { course_id: courseId, user_id: userId, access_level: "modules" },
                { onConflict: "course_id,user_id" }
              );
            }
          }

          console.log("✅ Course entitlement processed:", { courseId, scope, moduleId, userId });
          break;
        }

        // ==========================================================
        // ✅ B) STORE CHECKOUTS (your existing logic unchanged)
        // ==========================================================
        const checkoutId = meta.app_checkout_session_id;
        const userId = meta.app_user_id;
        const contactId = meta.app_contact_id;
        const productId = meta.app_product_id;

        const amountCents = session.amount_total ?? 0;
        const currency = (session.currency || "aud").toUpperCase();

        // 1) Mark checkout_sessions as paid
        if (checkoutId) {
          const { error } = await supabase
            .from("checkout_sessions")
            .update({
              status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", checkoutId);

          if (error) console.error("Error updating checkout_sessions:", error);
          else console.log("✅ checkout_sessions marked paid:", checkoutId);
        }

        // 2) Create an order row
        if (userId) {
          const { error } = await supabase.from("orders").insert({
            user_id: userId,
            amount_cents: amountCents,
            currency,
            status: "paid",
            created_at: new Date().toISOString(),
          });

          if (error) console.error("Error inserting order:", error);
          else console.log("✅ Order row inserted");
        }

        // 3) Log automation event
        if (contactId) {
          const { error } = await supabase.from("automation_events").insert({
            contact_id: contactId,
            event_type: "order_completed",
            payload: {
              product_id: productId,
              amount_cents: amountCents,
              currency,
              stripe_checkout_session_id: session.id,
            },
          });

          if (error) console.error("Error inserting automation_event:", error);
          else console.log("✅ automation_events: order_completed inserted");
        }

        break;
      }

      default:
        console.log(`ℹ️ Unhandled Stripe event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Error handling Stripe webhook:", err);
    return res.status(500).json({ error: "Internal webhook error" });
  }
}
