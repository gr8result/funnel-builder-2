// /pages/api/webhooks/stripe.js
// FULL REPLACEMENT (SAFE)
// Same logic preserved
// Adds custom_field_data storage for booking_purchase

import Stripe from "stripe";
import { buffer } from "micro";
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import crypto from "crypto";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {

        
        const session = event.data.object;
        const meta = session.metadata || {};


        // ==========================================================
        // AFFILIATE SALE TRACKING
        // ==========================================================

        const affiliateRef = meta.affiliate_ref || null;
   
        if (affiliateRef) {

          const saleAmount = (session.amount_total || 0) / 100;

          const { error } = await supabase
            .from("affiliate_sales")
            .insert({
              affiliate_id: affiliateRef,
              product_id: productId,
              sale_amount: saleAmount,
              stripe_session_id: session.id
            });

          if (error) {
            console.error("Affiliate sale insert failed:", error);
          } else {
            console.log("Affiliate sale recorded:", affiliateRef);
          }

        }



        // ==========================================================
        // CALENDAR SUBSCRIPTION
        // ==========================================================
        if (meta.gr8_type === "calendar_subscription") {

          const subscriptionId = session.subscription;
          const userId = meta.userId;

          if (subscriptionId && userId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            await supabase
              .from("profiles")
              .update({
                calendar_subscription_status: "active",
                calendar_subscription_id: subscriptionId,
                calendar_subscription_current_period_end:
                  new Date(subscription.current_period_end * 1000).toISOString(),
              })
              .eq("id", userId);
          }

          break;
        }

        // ==========================================================
        // BOOKING PURCHASE (EMAIL + CANCEL TOKEN + CUSTOM FIELDS)
        // ==========================================================
        if (meta.gr8_type === "booking_purchase") {

          const {
            serviceId,
            providerUserId,
            clientName,
            clientEmail,
            selectedSlot,
            duration,
            customFieldData, // ✅ NEW
          } = meta;

          if (!serviceId || !providerUserId || !selectedSlot) break;

          const { data: existingBySession } = await supabase
            .from("bookings")
            .select("id")
            .eq("stripe_session_id", session.id)
            .maybeSingle();

          if (existingBySession) break;

          const start = new Date(selectedSlot);
          const end = new Date(
            start.getTime() + Number(duration) * 60000
          );

          const { data: conflict } = await supabase
            .from("bookings")
            .select("id")
            .eq("user_id", providerUserId)
            .eq("start_datetime", start.toISOString())
            .maybeSingle();

          if (conflict) break;

          const cancelToken = crypto.randomBytes(32).toString("hex");

          await supabase.from("bookings").insert({
            user_id: providerUserId,
            service_id: serviceId,
            client_name: clientName,
            client_email: clientEmail,
            start_datetime: start.toISOString(),
            end_datetime: end.toISOString(),
            status: "confirmed",
            stripe_session_id: session.id,
            cancel_token: cancelToken,
            created_at: new Date().toISOString(),
            custom_field_data: customFieldData
              ? JSON.parse(customFieldData)
              : {}, // ✅ SAFE ADDITION
          });

          const formattedDate = start.toLocaleString("en-AU", {
            dateStyle: "full",
            timeStyle: "short",
          });

          const cancelUrl =
            `${process.env.NEXT_PUBLIC_SITE_URL}/cancel/${cancelToken}`;

          await sgMail.send({
            to: clientEmail,
            from: process.env.DEFAULT_FROM_EMAIL,
            subject: "Booking Confirmed",
            html: `
              <h2>Booking Confirmed</h2>
              <p>Hi ${clientName || "there"},</p>
              <p>Your booking has been confirmed.</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><a href="${cancelUrl}">Cancel Booking</a></p>
            `,
          });

          break;
        }

        // ==========================================================
        // COURSE PURCHASES
        // ==========================================================
        if (meta.gr8_type === "course_purchase") {

          const { courseId, scope, moduleId, userId } = meta;
          if (!courseId || !scope || !userId) break;

          if (scope === "full_course") {
            await supabase.from("course_entitlements").insert({
              course_id: courseId,
              user_id: userId,
              module_id: null,
              entitlement_type: "full_course",
            });

            await supabase.from("course_enrolments").upsert(
              { course_id: courseId, user_id: userId, access_level: "full" },
              { onConflict: "course_id,user_id" }
            );
          }

          if (scope === "module" && moduleId) {
            await supabase.from("course_entitlements").insert({
              course_id: courseId,
              user_id: userId,
              module_id: moduleId,
              entitlement_type: "module",
            });

            await supabase.from("course_enrolments").upsert(
              { course_id: courseId, user_id: userId, access_level: "modules" },
              { onConflict: "course_id,user_id" }
            );
          }

          break;
        }

        // ==========================================================
        // STORE CHECKOUTS
        // ==========================================================
        const checkoutId = meta.app_checkout_session_id;
        const userId = meta.app_user_id;
        const contactId = meta.app_contact_id;
        const productId = meta.app_product_id;

        const amountCents = session.amount_total ?? 0;
        const currency = (session.currency || "aud").toUpperCase();

        if (checkoutId) {
          await supabase
            .from("checkout_sessions")
            .update({
              status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", checkoutId);
        }

        if (userId) {
          await supabase.from("orders").insert({
            user_id: userId,
            amount_cents: amountCents,
            currency,
            status: "paid",
            created_at: new Date().toISOString(),
          });
        }

        if (contactId) {
          await supabase.from("automation_events").insert({
            contact_id: contactId,
            event_type: "order_completed",
            payload: {
              product_id: productId,
              amount_cents: amountCents,
              currency,
              stripe_checkout_session_id: session.id,
            },
          });
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;

        await supabase
          .from("profiles")
          .update({
            calendar_subscription_status: subscription.status,
            calendar_subscription_current_period_end:
              new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("calendar_subscription_id", subscription.id);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        await supabase
          .from("profiles")
          .update({
            calendar_subscription_status: "cancelled",
            calendar_subscription_id: null,
            calendar_subscription_current_period_end: null,
          })
          .eq("calendar_subscription_id", subscription.id);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        await supabase
          .from("profiles")
          .update({
            calendar_subscription_status: "past_due",
          })
          .eq("calendar_subscription_id", invoice.subscription);

        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return res.json({ received: true });

  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Internal webhook error" });
  }
}