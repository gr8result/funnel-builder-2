// /pages/reschedule/[token].js
// FULL FILE — Public Reschedule Page
// - Token based
// - Uses existing availability + booking logic
// - Conflict safe
// - Cutoff enforced server side

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function generateSlots(startTime, endTime, duration) {
  const slots = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let current = new Date();
  current.setHours(startH, startM, 0, 0);

  const end = new Date();
  end.setHours(endH, endM, 0, 0);

  while (current < end) {
    slots.push(new Date(current));
    current = new Date(current.getTime() + duration * 60000);
  }

  return slots;
}

export default function ReschedulePage() {

  const router = useRouter();
  const { token } = router.query;

  const [booking, setBooking] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) loadBooking();
  }, [token]);

  async function loadBooking() {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .single();

    if (!data) {
      setStatus("error");
      setError("Invalid reschedule link.");
      return;
    }

    setBooking(data);

    const { data: availabilityData } = await supabase
      .from("provider_availability")
      .select("*")
      .eq("user_id", data.user_id);

    setAvailability(availabilityData || []);
    setStatus("ready");
  }

  useEffect(() => {
    if (!selectedDate || !booking) return;
    loadBookingsForDay();
  }, [selectedDate]);

  async function loadBookingsForDay() {

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", booking.user_id)
      .gte("start_datetime", startOfDay.toISOString())
      .lte("start_datetime", endOfDay.toISOString());

    setBookings(data || []);
  }

  useEffect(() => {
    if (!selectedDate || !booking) return;

    const dateObj = new Date(selectedDate);
    const dayOfWeek = dateObj.getDay();

    const dayAvailability = availability.filter(
      (a) => a.day_of_week === dayOfWeek
    );

    let allSlots = [];

    dayAvailability.forEach((block) => {
      const generated = generateSlots(
        block.start_time,
        block.end_time,
        30 // fallback duration
      );

      generated.forEach((slot) => {
        const fullDate = new Date(selectedDate);
        fullDate.setHours(slot.getHours(), slot.getMinutes(), 0, 0);

        if (fullDate > new Date()) {
          allSlots.push(fullDate);
        }
      });
    });

    const filtered = allSlots.filter((slot) => {
      return !bookings.some((b) => {
        return (
          new Date(b.start_datetime).getTime() === slot.getTime()
        );
      });
    });

    setSlots(filtered);

  }, [selectedDate, bookings]);

  async function submitReschedule() {

    if (!selectedSlot) return;

    setStatus("submitting");

    const res = await fetch("/api/calendar/reschedule-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        newStartISO: selectedSlot.toISOString(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setError(data.error || "Reschedule failed.");
      return;
    }

    setStatus("success");
  }

  if (status === "loading") return <div style={{ padding: 40 }}>Loading...</div>;

  if (status === "error")
    return (
      <div style={{ padding: 40 }}>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );

  if (status === "success")
    return (
      <div style={{ padding: 40 }}>
        <h1>Rescheduled Successfully</h1>
        <p>Your booking has been updated.</p>
      </div>
    );

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: "auto" }}>

      <h1>Reschedule Booking</h1>

      <h3>Select New Date</h3>
      <input
        type="date"
        min={new Date().toISOString().split("T")[0]}
        onChange={(e) => setSelectedDate(e.target.value)}
      />

      {selectedDate && (
        <>
          <h3>Select Time</h3>
          {slots.length === 0 && <p>No availability this day.</p>}
          {slots.map((slot, index) => (
            <button
              key={index}
              onClick={() => setSelectedSlot(slot)}
              style={{ margin: 5, padding: 10 }}
            >
              {slot.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </button>
          ))}
        </>
      )}

      {selectedSlot && (
        <div style={{ marginTop: 20 }}>
          <button onClick={submitReschedule}>
            Confirm Reschedule
          </button>
        </div>
      )}

    </div>
  );
}