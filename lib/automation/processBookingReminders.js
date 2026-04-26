// /lib/automation/processBookingReminders.js
// FULL FILE — Booking Reminder Processor

import { createClient } from "@supabase/supabase-js";
import { sendBookingReminder } from "../email/sendBookingReminder";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function processBookingReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const windowStart = new Date(in24h.getTime() - 15 * 60000);
  const windowEnd = new Date(in24h.getTime() + 15 * 60000);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .gte("start_datetime", windowStart.toISOString())
    .lte("start_datetime", windowEnd.toISOString())
    .is("reminder_sent_at", null);

  for (const booking of bookings || []) {
    const { data: providerProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", booking.user_id)
      .single();

    await sendBookingReminder({
      clientEmail: booking.client_email,
      clientName: booking.client_name,
      providerName: providerProfile?.username || "Provider",
      serviceName: "Your Booking",
      startDatetime: booking.start_datetime,
      duration:
        (new Date(booking.end_datetime) -
          new Date(booking.start_datetime)) /
        60000,
    });

    await supabase
      .from("bookings")
      .update({
        reminder_sent_at: new Date().toISOString(),
      })
      .eq("id", booking.id);
  }
}