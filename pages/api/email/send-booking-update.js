// /pages/api/email/send-booking-update.js
// Sends cancel OR reschedule email with optional calendar invite

export const config = {
  api: {
    bodyParser: { sizeLimit: "5mb" },
  },
};

import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";
import { guardEmailSend } from "../../../lib/emailValidation";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

const SENDGRID_KEY =
  process.env.SENDGRID_API_KEY || process.env.GR8_MAIL_SEND_ONLY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function getUserFromBearer(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

function generateICS({
  title,
  start,
  end,
  description,
  organizerEmail,
}) {
  const formatDate = (d) =>
    new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  return `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Your Platform//Booking//EN
BEGIN:VEVENT
UID:${Date.now()}@yourdomain.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:${title}
DESCRIPTION:${description}
ORGANIZER:MAILTO:${organizerEmail}
END:VEVENT
END:VCALENDAR
  `.trim();
}

async function handler(req, res) {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ success: false });

    if (!SENDGRID_KEY)
      return res
        .status(500)
        .json({ success: false, error: "Missing SendGrid key" });

    sgMail.setApiKey(SENDGRID_KEY);

    const user = await getUserFromBearer(req);
    if (!user)
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized" });

    const {
      type, // "cancel" or "reschedule"
      clientEmail,
      clientName,
      serviceName,
      startDateTime,
      endDateTime,
    } = req.body || {};

    if (!clientEmail || !serviceName)
      return res.status(400).json({
        success: false,
        error: "Missing required data",
      });

    let subject;
    let html;

    let emailGuard = null;
    try {
      emailGuard = await guardEmailSend(user.id, 1);
    } catch (limitErr) {
      return res.status(429).json({
        success: false,
        error: limitErr.message,
        code: limitErr.code,
        details: limitErr.details,
      });
    }

    if (type === "cancel") {
      subject = `Booking Cancelled — ${serviceName}`;
      html = `
        <h2>Booking Cancelled</h2>
        <p>Hi ${clientName || "there"},</p>
        <p>Your booking for <strong>${serviceName}</strong> has been cancelled.</p>
      `;
    } else {
      subject = `Booking Updated — ${serviceName}`;
      html = `
        <h2>Booking Rescheduled</h2>
        <p>Hi ${clientName || "there"},</p>
        <p>Your booking for <strong>${serviceName}</strong> has been updated.</p>
        <p><strong>New Date & Time:</strong> ${new Date(
          startDateTime
        ).toLocaleString()}</p>
      `;
    }

    const attachments =
      type === "reschedule"
        ? [
            {
              content: Buffer.from(
                generateICS({
                  title: serviceName,
                  start: startDateTime,
                  end: endDateTime,
                  description: "Booking confirmation",
                  organizerEmail: user.email,
                })
              ).toString("base64"),
              filename: "booking.ics",
              type: "text/calendar",
              disposition: "attachment",
            },
          ]
        : undefined;

    const { data: row } = await supabaseAdmin
      .from("email_sends")
      .insert({
        user_id: user.id,
        email: clientEmail,
        recipient_email: clientEmail,
        email_type: "booking_update",
        subject,
        status: "processing",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const response = await sgMail.send({
      to: clientEmail,
      from: user.email,
      subject,
      html,
      attachments,
    });

    const messageId =
      response?.[0]?.headers?.["x-message-id"] || null;

    await supabaseAdmin
      .from("email_sends")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sendgrid_message_id: messageId,
      })
      .eq("id", row.id);

    return res.status(200).json({ success: true, usage: emailGuard || null });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e?.message || "Server error",
    });
  }
}

export default withAuth(handler);
