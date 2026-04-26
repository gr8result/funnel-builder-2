// /pages/api/email/send-booking.js
// Booking confirmation email using existing SendGrid structure

export const config = {
  api: {
    bodyParser: { sizeLimit: "5mb" },
  },
};

import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";
import { guardEmailSend } from "../../../lib/emailValidation";

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

export default async function handler(req, res) {
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
      clientEmail,
      clientName,
      serviceName,
      dateTime,
    } = req.body || {};

    if (!clientEmail || !serviceName || !dateTime)
      return res.status(400).json({
        success: false,
        error: "Missing booking data",
      });

    const subject = `Booking Confirmed — ${serviceName}`;

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

    const html = `
      <h2>Booking Confirmed</h2>
      <p>Hi ${clientName || "there"},</p>
      <p>Your booking for <strong>${serviceName}</strong> is confirmed.</p>
      <p><strong>Date & Time:</strong> ${dateTime}</p>
      <br/>
      <p>We look forward to seeing you.</p>
    `;

    // Log entry
    const { data: row } = await supabaseAdmin
      .from("email_sends")
      .insert({
        user_id: user.id,
        email: clientEmail,
        recipient_email: clientEmail,
        email_type: "booking",
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