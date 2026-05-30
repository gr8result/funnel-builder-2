// /pages/api/calendar/process-reminders.js
// Processes scheduled booking reminders

import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { guardEmailSend } from "../../../lib/emailValidation";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function handler(req, res) {
  try {
    const now = new Date().toISOString();
    let suppressed = 0;
    let sent = 0;

    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .lte("reminder_scheduled_for", now)
      .eq("reminder_sent", false)
      .eq("status", "confirmed");

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({ processed: 0 });
    }

    for (const booking of bookings) {

      const start = new Date(booking.start_datetime);
      const formattedDate = start.toLocaleString("en-AU", {
        dateStyle: "full",
        timeStyle: "short",
      });

      try {
        await guardEmailSend(booking.user_id, 1);
        const { data: sendRow } = await supabase
          .from("email_sends")
          .insert({
            user_id: booking.user_id,
            email: booking.client_email,
            recipient_email: booking.client_email,
            email_type: "calendar_reminder",
            subject: "Appointment Reminder",
            status: "processing",
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        await sgMail.send({
          to: booking.client_email,
          from: process.env.DEFAULT_FROM_EMAIL,
          subject: "Appointment Reminder",
          html: `
            <h2>Appointment Reminder</h2>
            <p>This is a reminder for your upcoming booking.</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
          `,
        });

        if (sendRow?.id) {
          await supabase
            .from("email_sends")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .eq("id", sendRow.id);
        }
      } catch (mailErr) {
        if (mailErr?.code === "EMAIL_LIMIT_EXCEEDED") {
          suppressed += 1;
          continue;
        }
        throw mailErr;
      }

      await supabase
        .from("bookings")
        .update({ reminder_sent: true })
        .eq("id", booking.id);
      sent += 1;
    }

    return res.status(200).json({ processed: sent, suppressed, scanned: bookings.length });

  } catch (err) {
    console.error("Reminder processing error:", err);
    return res.status(500).json({ error: "Reminder processing failed" });
  }
}

function withCronSecret(h) {
  return async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers['x-cron-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return h(req, res);
  };
}

export default withCronSecret(handler);
