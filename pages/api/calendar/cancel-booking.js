// /pages/api/calendar/cancel-booking.js
// FULL FILE — Cancellation + conditional refund + email notifications
// Production Hardened

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import { guardEmailSend } from "../../../lib/emailValidation";

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
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, reason } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Missing cancellation token" });
  }

  try {
    let usage = null;
    let notificationsSuppressed = false;

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .maybeSingle();

    if (bookingError) {
      return res.status(500).json({ error: "Database error" });
    }

    if (!booking) {
      return res.status(404).json({ error: "Invalid or expired token" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Booking already cancelled" });
    }

    // Get cancellation cutoff
    const { data: service } = await supabase
      .from("services")
      .select("cancellation_cutoff_hours")
      .eq("id", booking.service_id)
      .single();

    const cutoffHours = service?.cancellation_cutoff_hours ?? 24;

    const now = new Date();
    const bookingStart = new Date(booking.start_datetime);

    const hoursUntilBooking =
      (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundId = null;
    let refunded = false;

    // Conditional refund
    if (
      booking.stripe_session_id &&
      !booking.refunded_at &&
      hoursUntilBooking >= cutoffHours
    ) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          booking.stripe_session_id
        );

        if (session.payment_intent) {
          const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent,
          });

          refundId = refund.id;
          refunded = true;

          await supabase
            .from("bookings")
            .update({
              refunded_at: new Date().toISOString(),
              refund_id: refund.id,
            })
            .eq("id", booking.id);
        }
      } catch (stripeErr) {
        console.error("Stripe refund error:", stripeErr);
      }
    }

    // Mark cancelled
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason?.substring(0, 500) || null,
      })
      .eq("id", booking.id)
      .eq("status", booking.status); // race protection

    const formattedDate = bookingStart.toLocaleString("en-AU", {
      dateStyle: "full",
      timeStyle: "short",
    });

    // Client email
    try {
      usage = await guardEmailSend(booking.user_id, 1);
      const { data: clientSendRow } = await supabase
        .from("email_sends")
        .insert({
          user_id: booking.user_id,
          email: booking.client_email,
          recipient_email: booking.client_email,
          email_type: "calendar_cancellation",
          subject: "Booking Cancelled",
          status: "processing",
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      await sgMail.send({
        to: booking.client_email,
        from: process.env.DEFAULT_FROM_EMAIL,
        subject: "Booking Cancelled",
        html: `
          <h2>Your booking has been cancelled</h2>
          <p><strong>Date:</strong> ${formattedDate}</p>
          ${refunded ? "<p>Your payment has been refunded.</p>" : ""}
        `,
      });
      if (clientSendRow?.id) {
        await supabase
          .from("email_sends")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", clientSendRow.id);
      }
    } catch (mailErr) {
      if (mailErr?.code === "EMAIL_LIMIT_EXCEEDED") {
        notificationsSuppressed = true;
      }
      console.error("Client email error:", mailErr);
    }

    // Provider notification (FIXED user_id match)
    const { data: provider } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", booking.user_id)
      .maybeSingle();

    if (provider?.email) {
      try {
        usage = await guardEmailSend(booking.user_id, 1);
        const { data: providerSendRow } = await supabase
          .from("email_sends")
          .insert({
            user_id: booking.user_id,
            email: provider.email,
            recipient_email: provider.email,
            email_type: "calendar_cancellation",
            subject: "Booking Cancelled by Client",
            status: "processing",
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        await sgMail.send({
          to: provider.email,
          from: process.env.DEFAULT_FROM_EMAIL,
          subject: "Booking Cancelled by Client",
          html: `
            <h2>Booking Cancelled</h2>
            <p><strong>Client:</strong> ${booking.client_name}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
          `,
        });
        if (providerSendRow?.id) {
          await supabase
            .from("email_sends")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .eq("id", providerSendRow.id);
        }
      } catch (mailErr) {
        if (mailErr?.code === "EMAIL_LIMIT_EXCEEDED") {
          notificationsSuppressed = true;
        }
        console.error("Provider email error:", mailErr);
      }
    }

    return res.json({
      success: true,
      refunded,
      refund_id: refundId,
      usage: usage?.policy || null,
      notificationsSuppressed,
    });

  } catch (err) {
    console.error("Cancellation error:", err);
    return res.status(500).json({
      error: "Internal cancellation error"
    });
  }
}