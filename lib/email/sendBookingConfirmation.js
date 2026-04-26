// lib/email/sendBookingConfirmation.js
import { sendEmail } from "../sendEmail";

function getBookingFromEmail() {
  return process.env.BOOKINGS_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";
}

function generateICS({ startDatetime, duration, serviceName, providerName, clientEmail }) {
  const start = new Date(startDatetime);
  const end = new Date(start.getTime() + duration * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GR8 Platform//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@gr8`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${serviceName}`,
    `DESCRIPTION:Booking with ${providerName}`,
    `ORGANIZER;CN=${providerName}:MAILTO:${clientEmail}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export async function sendBookingConfirmation({
  clientEmail,
  clientName,
  providerName,
  serviceName,
  startDatetime,
  duration,
  price,
}) {
  const start = new Date(startDatetime);
  const formattedDate = start.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const formattedTime = start.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  const priceText = price && Number(price) > 0 ? `$${Number(price).toFixed(2)}` : "Free";
  const icsContent = generateICS({ startDatetime, duration, serviceName, providerName, clientEmail });

  return sendEmail({
    to: clientEmail,
    from: getBookingFromEmail(),
    subject: `Booking Confirmed – ${serviceName} with ${providerName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden;">
        <div style="background:#84cc16;padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:26px;">Booking Confirmed ✓</h1>
        </div>
        <div style="padding:32px;">
          <p style="font-size:16px;margin-top:0;">Hi ${clientName},</p>
          <p style="font-size:16px;">Your appointment is confirmed. A calendar invite is attached.</p>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;margin:24px 0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;width:120px;">Service</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:600;font-size:16px;">${serviceName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Provider</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:16px;">${providerName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Date</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:16px;">${formattedDate}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Time</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:16px;">${formattedTime}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Duration</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:16px;">${duration} minutes</td></tr>
              <tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Price</td><td style="padding:10px 0;font-size:16px;font-weight:600;">${priceText}</td></tr>
            </table>
          </div>
          <p style="font-size:14px;color:#6b7280;">You will receive a reminder 24 hours before your appointment. To reschedule or cancel, contact your provider.</p>
        </div>
        <div style="background:#f3f4f6;padding:16px;text-align:center;font-size:12px;color:#9ca3af;">Powered by GR8</div>
      </div>
    `,
    attachments: [
      { content: Buffer.from(icsContent).toString("base64"), filename: "booking.ics", type: "text/calendar", disposition: "attachment" },
    ],
  });
}

export async function sendProviderBookingNotification({
  providerEmail,
  providerName,
  clientName,
  clientEmail,
  clientPhone,
  serviceName,
  startDatetime,
  duration,
}) {
  const start = new Date(startDatetime);
  const formattedDate = start.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const formattedTime = start.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

  return sendEmail({
    to: providerEmail,
    from: getBookingFromEmail(),
    subject: `New Booking – ${clientName} booked ${serviceName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden;">
        <div style="background:#111827;padding:32px;text-align:center;">
          <h1 style="color:#84cc16;margin:0;font-size:24px;">New Booking Received</h1>
        </div>
        <div style="padding:32px;">
          <p style="font-size:16px;margin-top:0;">Hi ${providerName},</p>
          <p style="font-size:16px;">You have a new appointment booking:</p>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;margin:24px 0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;width:120px;">Client</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:600;font-size:16px;">${clientName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Email</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:16px;">${clientEmail}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:16px;">${clientPhone || "Not provided"}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Service</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:16px;">${serviceName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Date</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:16px;">${formattedDate}</td></tr>
              <tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:10px 0;font-size:16px;">${formattedTime} (${duration} min)</td></tr>
            </table>
          </div>
          <p style="font-size:14px;color:#6b7280;">Log in to your calendar dashboard to view and manage this booking.</p>
        </div>
        <div style="background:#f3f4f6;padding:16px;text-align:center;font-size:12px;color:#9ca3af;">Powered by GR8</div>
      </div>
    `,
  });
}