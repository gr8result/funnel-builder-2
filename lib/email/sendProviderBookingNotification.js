// /lib/email/sendProviderBookingNotification.js
// FULL FILE — Provider Booking Notification

import sgMail from "@sendgrid/mail";

sgMail.setApiKey(
  process.env.SENDGRID_API_KEY ||
  process.env.GR8_MAIL_SEND_ONLY
);

function getBookingFromEmail() {
  return process.env.BOOKINGS_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";
}

export async function sendProviderBookingNotification({
  providerEmail,
  providerName,
  clientName,
  clientEmail,
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
    to: providerEmail,
    from: getBookingFromEmail(),
    subject: `New Booking – ${serviceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px;">
        <h2>New Booking Received</h2>
        <p>Hi ${providerName},</p>
        <p>You have a new booking:</p>

        <div style="margin:20px 0;padding:15px;border:1px solid #ddd;border-radius:8px;">
          <strong>Service:</strong> ${serviceName}<br/>
          <strong>Client:</strong> ${clientName}<br/>
          <strong>Email:</strong> ${clientEmail}<br/>
          <strong>Date:</strong> ${formattedDate}<br/>
          <strong>Time:</strong> ${formattedTime}<br/>
          <strong>Duration:</strong> ${duration} minutes
        </div>

        <p>Please prepare accordingly.</p>
      </div>
    `,
  };

  await sgMail.send(msg);
}