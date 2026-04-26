// /pages/modules/calendar/settings.js
// Combined: Calendar Settings + Availability
// (availability.js redirects here)

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import ICONS from "../../../components/iconMap";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const S = {
  page:        { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "0 20px 48px", fontFamily: "system-ui,sans-serif" },
  shell:       { maxWidth: 1320, margin: "0 auto" },
  banner:      { maxWidth: 1320, margin: "16px auto 28px", background: "#84cc16", borderRadius: 16, padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  bannerLeft:  { display: "flex", alignItems: "center", gap: 16 },
  bannerTitle: { fontSize: 48, fontWeight: 600, color: "#fff", margin: 0 },
  bannerSub:   { fontSize: 18, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  backBtn:     { fontSize: 18, fontWeight: 600, background: "rgb(255, 255, 255)", color: "#000000", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 9, cursor: "pointer" },
  twoCol:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" },
  card:        { background: "#161e2b", border: "1px solid #243047", borderRadius: 16, padding: "24px 26px", marginBottom: 20 },
  sectionTitle:{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 20, marginTop: 0 },
  label:       { fontSize: 16, color: "#9CA3AF", marginBottom: 6, display: "block" },
  input:       { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  field:       { marginBottom: 20 },
  saveBtn:     { padding: "11px 28px", background: "#84cc16", border: "none", borderRadius: 9, color: "#fff", fontWeight: 600, fontSize: 18, cursor: "pointer" },
  dayBtn: (a) => ({ padding: "9px 14px", borderRadius: 8, border: a ? "2px solid #84cc16" : "1px solid #374151", background: a ? "rgba(132,204,22,0.2)" : "rgba(255,255,255,0.04)", color: a ? "#84cc16" : "#9CA3AF", fontWeight: 600, fontSize: 16, cursor: "pointer" }),
  slotRow:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #243047", fontSize: 16 },
  slotDay:     { fontWeight: 600, color: "#fff" },
  slotTime:    { color: "#9CA3AF" },
  deleteBtn:   { padding: "6px 16px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, color: "#FCA5A5", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  toggle:      { display: "flex", alignItems: "center", gap: 12 },
  toggleBox:   { width: 20, height: 20, cursor: "pointer" },
  empty:       { color: "#6B7280", fontSize: 16, padding: "12px 0" },
  hint:        { fontSize: 16, color: "#6B7280", marginTop: 4 },
  saved:       { fontSize: 16, color: "#6EE7B7", marginLeft: 14 },
};

export default function CalendarSettingsAndAvailability() {
  // Settings state
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [refundHours, setRefundHours]     = useState(24);
  const [maxDaily, setMaxDaily]           = useState(10);
  const [enabled, setEnabled]             = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Availability state
  const [availability, setAvailability]   = useState([]);
  const [selectedDays, setSelectedDays]   = useState([]);
  const [startTime, setStartTime]         = useState("09:00");
  const [endTime, setEndTime]             = useState("17:00");

  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }
    const uid = session.user.id;

    const [profileRes, availRes] = await Promise.all([
      supabase.from("profiles")
        .select("calendar_buffer_minutes,calendar_refund_cutoff_hours,calendar_max_daily_bookings,calendar_enabled")
        .eq("user_id", uid).single(),
      supabase.from("provider_availability")
        .select("*").eq("user_id", uid).order("day_of_week", { ascending: true }),
    ]);

    if (profileRes.data) {
      setBufferMinutes(profileRes.data.calendar_buffer_minutes ?? 0);
      setRefundHours(profileRes.data.calendar_refund_cutoff_hours ?? 24);
      setMaxDaily(profileRes.data.calendar_max_daily_bookings ?? 10);
      setEnabled(profileRes.data.calendar_enabled ?? true);
    }
    setAvailability(availRes.data || []);
    setLoading(false);
  }

  async function saveSettings() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase.from("profiles").update({
      calendar_buffer_minutes: Number(bufferMinutes),
      calendar_refund_cutoff_hours: Number(refundHours),
      calendar_max_daily_bookings: Number(maxDaily),
      calendar_enabled: enabled,
    }).eq("user_id", session.user.id);
    if (error) { alert("Error saving settings"); return; }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  function toggleDay(i) {
    setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]);
  }

  async function addAvailability(e) {
    e.preventDefault();
    if (!selectedDays.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("provider_availability").insert(
      selectedDays.map(day => ({ user_id: user.id, day_of_week: day, start_time: startTime, end_time: endTime }))
    );
    setSelectedDays([]);
    const { data } = await supabase.from("provider_availability").select("*").eq("user_id", user.id).order("day_of_week", { ascending: true });
    setAvailability(data || []);
  }

  async function deleteAvailability(id) {
    await supabase.from("provider_availability").delete().eq("id", id);
    setAvailability(prev => prev.filter(s => s.id !== id));
  }

  if (loading) return <div style={{ padding: 40, color: "#fff", background: "#0c121a", minHeight: "100vh" }}>Loading…</div>;

  return (
    <div style={S.page}>
      <div style={S.banner}>
        <div style={S.bannerLeft}>
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "12px 14px", fontSize: 24 }}>⚙️</div>
          <div>
            <h1 style={S.bannerTitle}>Settings &amp; Availability</h1>
            <div style={S.bannerSub}>Configure your booking rules and set your available hours</div>
          </div>
        </div>
        <Link href="/modules/calendar/dashboard">
          <button style={S.backBtn}>← Calendar Dashboard</button>
        </Link>
      </div>

      <div style={S.shell}>
        <div style={S.twoCol}>

          {/* LEFT — Availability */}
          <div>
            <div style={S.card}>
              <p style={S.sectionTitle}>🕐 Add Available Hours</p>
              <form onSubmit={addAvailability}>
                <div style={S.field}>
                  <label style={S.label}>Select Days</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {DAYS.map((day, i) => (
                      <button type="button" key={i} style={S.dayBtn(selectedDays.includes(i))} onClick={() => toggleDay(i)}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <div style={S.field}>
                    <label style={S.label}>Start Time</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={S.input} />
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>End Time</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={S.input} />
                  </div>
                </div>
                <button type="submit" style={{ ...S.saveBtn, opacity: selectedDays.length ? 1 : 0.4 }}>
                  + Add Slots
                </button>
              </form>
            </div>

            <div style={S.card}>
              <p style={S.sectionTitle}>📋 Current Availability</p>
              {availability.length === 0
                ? <div style={S.empty}>No availability set yet.</div>
                : availability.map(slot => (
                  <div key={slot.id} style={S.slotRow}>
                    <div>
                      <span style={S.slotDay}>{DAYS[slot.day_of_week]}</span>
                      <span style={{ ...S.slotTime, marginLeft: 12 }}>{slot.start_time} – {slot.end_time}</span>
                    </div>
                    <button style={S.deleteBtn} onClick={() => deleteAvailability(slot.id)}>Remove</button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* RIGHT — Settings */}
          <div style={S.card}>
            <p style={S.sectionTitle}>⚙️ Booking Settings</p>

            <div style={S.field}>
              <label style={S.label}>Buffer Between Bookings (minutes)</label>
              <input type="number" min="0" value={bufferMinutes} onChange={e => setBufferMinutes(e.target.value)} style={S.input} />
              <div style={S.hint}>Gap added after each appointment before the next can start</div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Refund Cutoff (hours before booking)</label>
              <input type="number" min="0" value={refundHours} onChange={e => setRefundHours(e.target.value)} style={S.input} />
              <div style={S.hint}>Clients can only cancel/refund if booking is more than this many hours away</div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Max Daily Bookings</label>
              <input type="number" min="1" value={maxDaily} onChange={e => setMaxDaily(e.target.value)} style={S.input} />
              <div style={S.hint}>Maximum number of bookings accepted per day</div>
            </div>

            <div style={{ ...S.field, ...S.toggle }}>
              <input type="checkbox" id="cal-enabled" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={S.toggleBox} />
              <label htmlFor="cal-enabled" style={{ fontSize: 16, color: "#9CA3AF", cursor: "pointer" }}>
                Calendar enabled (clients can book)
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
              <button style={S.saveBtn} onClick={saveSettings}>Save Settings</button>
              {settingsSaved && <span style={S.saved}>✓ Saved</span>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


