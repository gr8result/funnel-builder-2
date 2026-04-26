// /pages/api/calendar/cancel-booking.js
// FULL FILE — Provider cancels booking

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { bookingId, userId } = req.body;

    if (!bookingId || !userId) {
      return res.status(400).json({ error: "Missing data" });
    }

    // Ensure booking belongs to provider
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, user_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking || booking.user_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Cancel booking error:", err);
    return res.status(500).json({ error: err.message });
  }
}