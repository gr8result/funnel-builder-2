// /pages/api/calendar/reschedule-booking.js
// FULL FILE — Secure booking reschedule
// - Token based
// - No refund
// - No new payment
// - Conflict protected
// - Cutoff enforced

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, newStartISO } = req.body;

  if (!token || !newStartISO) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {

    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .maybeSingle();

    if (!booking) {
      return res.status(404).json({ error: "Invalid token" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Cannot reschedule cancelled booking" });
    }

    // Get service rules
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes, cancellation_cutoff_hours")
      .eq("id", booking.service_id)
      .single();

    const duration = service?.duration_minutes || 30;
    const cutoffHours = service?.cancellation_cutoff_hours ?? 24;

    const now = new Date();
    const originalStart = new Date(booking.start_datetime);

    const hoursUntilOriginal =
      (originalStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Enforce cutoff
    if (hoursUntilOriginal < cutoffHours) {
      return res.status(400).json({
        error: "Reschedule window has closed"
      });
    }

    const newStart = new Date(newStartISO);
    const newEnd = new Date(
      newStart.getTime() + duration * 60000
    );

    // Prevent past reschedule
    if (newStart < now) {
      return res.status(400).json({
        error: "Cannot reschedule to past time"
      });
    }

    // Conflict protection
    const { data: conflict } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", booking.user_id)
      .eq("start_datetime", newStart.toISOString())
      .neq("id", booking.id)
      .maybeSingle();

    if (conflict) {
      return res.status(400).json({
        error: "Selected time is no longer available"
      });
    }

    await supabase
      .from("bookings")
      .update({
        start_datetime: newStart.toISOString(),
        end_datetime: newEnd.toISOString(),
        rescheduled_at: new Date().toISOString(),
        reschedule_count: (booking.reschedule_count || 0) + 1,
      })
      .eq("id", booking.id);

    return res.json({
      success: true,
      new_start: newStart.toISOString(),
    });

  } catch (err) {
    console.error("Reschedule error:", err);
    return res.status(500).json({
      error: "Internal reschedule error"
    });
  }
}