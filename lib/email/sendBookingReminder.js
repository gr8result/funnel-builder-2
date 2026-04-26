// /lib/email/sendBookingReminder.js
// FULL FILE — 24h Reminder Email

import sgMail from "@sendgrid/mail";

sgMail.setApiKey(
  process.env.SENDGRID_API_KEY ||
  process.env.GR8_MAIL_SEND_ONLY
);

function getBookingFromEmail() {
  return process.env.BOOKINGS_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";
}

export async function sendBookingReminder({
  clientEmail,
  clientName,
  providerName,
  serviceName,
  startDatetime,
  duration,
}) {
  const start = new Date(startDatetime);

  const formattedDate = start.toLocaleDateString();
  const formattedTime = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const msg = {
    to: clientEmail,
    from: getBookingFromEmail(),
    subject: `Reminder – ${serviceName} Tomorrow`,
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px;">
        <h2>Appointment Reminder</h2>
        <p>Hi ${clientName},</p>

        <p>This is a reminder that you have an upcoming booking.</p>

        <div style="margin:20px 0;padding:15px;border:1px solid #ddd;border-radius:8px;">
          <strong>Service:</strong> ${serviceName}<br/>
          <strong>Provider:</strong> ${providerName}<br/>
          <strong>Date:</strong> ${formattedDate}<br/>
          <strong>Time:</strong> ${formattedTime}<br/>
          <strong>Duration:</strong> ${duration} minutes
        </div>

        <p>We look forward to seeing you.</p>
      </div>
    `,
  };

  await sgMail.send(msg);
}