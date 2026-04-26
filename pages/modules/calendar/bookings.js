// /pages/modules/calendar/bookings.js
// FINAL VERSION — Unified Cancellation via API
// • Cancel via secure backend
// • Reschedule
// • Conflict prevention
// • Email notifications handled server-side
// • Future-only filter

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

export default function BookingsDashboard() {
  const [bookings, setBookings] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("bookings")
      .select(`*, services ( name, duration_minutes )`)
      .eq("user_id", user.id)
      .order("start_datetime", { ascending: true });

    if (data) {
      const future = data.filter(
        (b) => new Date(b.start_datetime) >= new Date()
      );
      setBookings(future);
    }
  }

  async function cancelBooking(booking) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const response = await fetch("/api/calendar/cancel-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId: booking.id,
        userId: user.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Cancellation failed");
      return;
    }

    loadBookings();
  }

  async function rescheduleBooking(booking) {
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!newDate || !newTime) return;

    const newStart = new Date(`${newDate}T${newTime}`);
    const newEnd = new Date(
      newStart.getTime() +
        booking.services.duration_minutes * 60000
    );

    const { data: conflicts } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", booking.user_id)
      .neq("id", booking.id)
      .gte("start_datetime", new Date(newDate).toISOString())
      .lte(
        "start_datetime",
        new Date(
          new Date(newDate).setHours(23, 59, 59)
        ).toISOString()
      );

    const conflict = conflicts?.some((b) => {
      return (
        new Date(b.start_datetime).getTime() ===
        newStart.getTime()
      );
    });

    if (conflict) {
      setError("Time already booked.");
      return;
    }

    await supabase
      .from("bookings")
      .update({
        start_datetime: newStart,
        end_datetime: newEnd,
        status: "confirmed",
      })
      .eq("id", booking.id);

    await fetch("/api/email/send-booking-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        type: "reschedule",
        clientEmail: booking.client_email,
        clientName: booking.client_name,
        serviceName: booking.services?.name,
        startDateTime: newStart,
        endDateTime: newEnd,
      }),
    });

    setEditing(null);
    setNewDate("");
    setNewTime("");
    loadBookings();
  }

  const S = {
    page:       { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "0 20px 48px", fontFamily: "system-ui,sans-serif" },
    shell:      { maxWidth: 1320, margin: "0 auto" },
    banner:     { maxWidth: 1320, margin: "16px auto 28px", background: "#84cc16", borderRadius: 16, padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
    bannerLeft: { display: "flex", alignItems: "center", gap: 16 },
    bannerTitle:{ fontSize: 48, fontWeight: 600, color: "#fff", margin: 0 },
    bannerSub:  { fontSize: 18, color: "rgba(255,255,255,0.85)", marginTop: 4 },
    backBtn:    { fontSize: 18, fontWeight: 600, background: "rgb(0, 0, 0)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 9, cursor: "pointer" },
    card:       { background: "#161e2b", border: "1px solid #243047", borderRadius: 16, padding: "22px 24px", marginBottom: 14 },
    sectionTitle:{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 20, marginTop: 0 },
    bookingMeta:{ fontSize: 16, color: "#9CA3AF", marginTop: 4 },
    bookingName:{ fontSize: 18, fontWeight: 600, color: "#fff" },
    statusPill: (s) => ({
      display: "inline-block", padding: "3px 12px", borderRadius: 20, fontSize: 16, fontWeight: 600,
      background: s === "cancelled" ? "rgba(239,68,68,0.15)" : "rgba(110,231,183,0.15)",
      color: s === "cancelled" ? "#FCA5A5" : "#6EE7B7",
      textTransform: "uppercase", letterSpacing: 0.5,
    }),
    actionRow:  { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" },
    reschedBtn: { fontSize: 16, fontWeight: 600, padding: "8px 18px", borderRadius: 8, border: "1px solid #4B5563", background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer" },
    cancelBtn:  { fontSize: 16, fontWeight: 600, padding: "8px 18px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.2)", color: "#FCA5A5", cursor: "pointer" },
    saveBtn:    { fontSize: 16, fontWeight: 600, padding: "8px 18px", borderRadius: 8, border: "none", background: "#84cc16", color: "#fff", cursor: "pointer" },
    inputStyle: { background: "rgba(0,0,0,0.4)", border: "1px solid #374151", borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: 16, outline: "none", fontFamily: "inherit" },
    empty:      { textAlign: "center", padding: "40px 0", color: "#6B7280", fontSize: 16 },
  };

  return (
    <div style={S.page}>
      {/* Banner */}
      <div style={S.banner}>
        <div style={S.bannerLeft}>
          <CalendarDays size={42} color="white" />
          <div>
            <h1 style={S.bannerTitle}>Bookings</h1>
            <div style={S.bannerSub}>View, reschedule and cancel upcoming appointments</div>
          </div>
        </div>
        <Link href="/modules/calendar/dashboard">
          <button style={S.backBtn}>← Calendar Dashboard</button>
        </Link>
      </div>

      <div style={S.shell}>
        <div style={{ background: "#161e2b", border: "1px solid #243047", borderRadius: 16, padding: "24px 26px" }}>
          <p style={S.sectionTitle}>📋 Upcoming Bookings ({bookings.length})</p>

          {bookings.length === 0 && (
            <div style={S.empty}>No upcoming bookings.</div>
          )}

          {bookings.map((booking) => (
            <div key={booking.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={S.bookingName}>{booking.services?.name || "Appointment"}</div>
                  <div style={S.bookingMeta}>
                    📅 {new Date(booking.start_datetime).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                    {booking.services?.duration_minutes && ` · ${booking.services.duration_minutes} min`}
                  </div>
                  <div style={S.bookingMeta}>
                    👤 {booking.client_name} &mdash; {booking.client_email}
                  </div>
                </div>
                <span style={S.statusPill(booking.status)}>
                  {booking.status === "cancelled" ? "Cancelled" : "Confirmed"}
                </span>
              </div>

              {editing === booking.id ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      style={S.inputStyle}
                    />
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      style={S.inputStyle}
                    />
                    <button style={S.saveBtn} onClick={() => rescheduleBooking(booking)}>Save</button>
                    <button style={S.reschedBtn} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                  {error && <div style={{ color: "#FCA5A5", marginTop: 10, fontSize: 16 }}>{error}</div>}
                </div>
              ) : (
                booking.status !== "cancelled" && (
                  <div style={S.actionRow}>
                    <button style={S.reschedBtn} onClick={() => setEditing(booking.id)}>📅 Reschedule</button>
                    <button style={S.cancelBtn} onClick={() => cancelBooking(booking)}>✕ Cancel Booking</button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}