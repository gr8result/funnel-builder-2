// pages/api/calendar/confirm-booking.js
// Called after a FREE booking is saved client-side.
// Sends confirmation email to client + notification to provider.

import { createClient } from "@supabase/supabase-js";
import {
  sendBookingConfirmation,
  sendProviderBookingNotification,
} from "../../../lib/email/sendBookingConfirmation";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    clientEmail,
    clientName,
    clientPhone,
    providerUserId,
    serviceId,
    serviceName,
    startDatetime,
    endDatetime,
    duration,
    price,
    customFieldData,
  } = req.body;

  if (!clientEmail || !clientName || !providerUserId || !serviceName || !startDatetime) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Save the booking server-side (bypasses RLS)
    if (serviceId && startDatetime && endDatetime) {
      const { error: insertErr } = await supabase.from("bookings").insert({
        user_id:        providerUserId,
        service_id:     serviceId || null,
        client_name:    clientName,
        client_email:   clientEmail,
        start_datetime: startDatetime,
        end_datetime:   endDatetime,
        status:         "confirmed",
      });
      if (insertErr) {
        console.error("bookings insert error", insertErr);
        return res.status(500).json({ error: "Failed to save booking: " + insertErr.message });
      }
    }
    // Get provider details
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, email")
      .eq("user_id", providerUserId)
      .maybeSingle();

    let providerEmail = profile?.email;
    if (!providerEmail) {
      // Fall back to auth email
      const { data: authData } = await supabase.auth.admin.getUserById(providerUserId);
      providerEmail = authData?.user?.email;
    }

    const providerName = profile?.username || "Your Provider";

    // Send confirmation to client (with .ics calendar invite)
    const clientEmailResult = await sendBookingConfirmation({
      clientEmail,
      clientName,
      providerName,
      serviceName,
      startDatetime,
      duration,
      price,
    });

    const clientEmailSent = !!clientEmailResult?.ok;
    const clientEmailError = clientEmailResult?.ok ? "" : (clientEmailResult?.error || "Confirmation email failed to send.");

    // Send notification to provider
    let providerEmailSent = false;
    let providerEmailError = "";
    if (providerEmail) {
      const providerEmailResult = await sendProviderBookingNotification({
        providerEmail,
        providerName,
        clientName,
        clientEmail,
        clientPhone,
        serviceName,
        startDatetime,
        duration,
      });
      providerEmailSent = !!providerEmailResult?.ok;
      providerEmailError = providerEmailResult?.ok ? "" : (providerEmailResult?.error || "Provider notification failed to send.");
    }

    return res.status(200).json({
      ok: true,
      emailSent: clientEmailSent,
      emailError: clientEmailError,
      providerEmailSent,
      providerEmailError,
    });
  } catch (err) {
    console.error("confirm-booking error:", err);
    // Return 200 anyway — the booking was already saved, don't surface email errors to client
    return res.status(200).json({ ok: true, emailError: err.message });
  }
}
