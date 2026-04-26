// pages/u/[username].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function generateSlots(startTime, endTime, duration, dateStr) {
  const slots = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  // Use the selected date as the base, not today
  const base = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const current = new Date(base);
  current.setHours(startH, startM, 0, 0);
  const end = new Date(base);
  end.setHours(endH, endM, 0, 0);
  while (current < end) {
    slots.push(new Date(current));
    current.setTime(current.getTime() + duration * 60000);
  }
  return slots;
}

export default function PublicBooking() {
  const router = useRouter();
  const { username, service: serviceParam } = router.query;

  const [profile, setProfile] = useState(null);
  const [bookingSettings, setBookingSettings] = useState(null);
  const [servicePageSettings, setServicePageSettings] = useState({}); // keyed by service_id
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);

  const [customFields, setCustomFields] = useState([]);
  const [customFieldData, setCustomFieldData] = useState({});

  const [step, setStep] = useState("service"); // service | date | time | details
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeInput, setPhoneCodeInput] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsSendError, setSmsSendError] = useState("");
  const [phoneVerifyError, setPhoneVerifyError] = useState("");

  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationEmailIssue, setConfirmationEmailIssue] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (username) loadUser();
  }, [username]);

  async function loadUser() {
    // Profile — anon client is fine (profiles are publicly readable)
    const { data: profileData, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single();

    if (profileErr || !profileData) {
      setLoadError("Booking page not found.");
      return;
    }
    setProfile(profileData);

    const uid = profileData.user_id;

    // Services and availability — use admin API (bypasses RLS) passing user_id directly
    let svcs = [], avail = [];
    try {
      const res = await fetch(`/api/calendar/public-page-data?user_id=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const body = await res.json();
        svcs  = body.services     || [];
        avail = body.availability || [];
      } else {
        // Fallback: anon client
        const [sRes, aRes] = await Promise.all([
          supabase.from("services").select("*").eq("user_id", uid).eq("active", true).order("created_at"),
          supabase.from("provider_availability").select("*").eq("user_id", uid),
        ]);
        svcs  = sRes.data || [];
        avail = aRes.data || [];
      }
    } catch {
      const [sRes, aRes] = await Promise.all([
        supabase.from("services").select("*").eq("user_id", uid).eq("active", true).order("created_at"),
        supabase.from("provider_availability").select("*").eq("user_id", uid),
      ]);
      svcs  = sRes.data || [];
      avail = aRes.data || [];
    }

    setServices(svcs);
    setAvailability(avail);

    // Load page config from storage — no SQL tables required
    try {
      const { data: { publicUrl: configUrl } } = supabase.storage
        .from("assets")
        .getPublicUrl(`${profileData.user_id}/booking-page-config.json`);
      const cfgRes = await fetch(configUrl + "?t=" + Date.now());
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setBookingSettings(cfg.global || {});
        setServicePageSettings(cfg.services || {});
      }
    } catch { /* no config yet — defaults used */ }

    // Deep-link to a specific service via ?service=id
    if (serviceParam) {
      const match = svcs.find((s) => s.id === serviceParam);
      if (match) { setSelectedService(match); setStep("date"); return; }
    }
    // Skip picker if only one service
    if (svcs.length === 1) {
      setSelectedService(svcs[0]);
      setStep("date");
    }
  }

  useEffect(() => {
    if (selectedService) {
      supabase
        .from("calendar_custom_fields")
        .select("*")
        .eq("service_id", selectedService.id)
        .then(({ data }) => {
          setCustomFields(data || []);
          setCustomFieldData({});
        });
    }
  }, [selectedService]);

  useEffect(() => {
    if (!selectedDate || !selectedService || !availability.length || !profile) return;
    loadSlotsForDate();
  }, [selectedDate, selectedService, profile]);

  async function loadSlotsForDate() {
    setLoadingSlots(true);
    setSlots([]);

    // Load existing bookings for this date to prevent double-booking
    const dayStart = new Date(selectedDate + "T00:00:00");
    const dayEnd = new Date(selectedDate + "T23:59:59");

    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("start_datetime, end_datetime")
      .eq("user_id", profile.user_id)
      .neq("status", "cancelled")
      .gte("start_datetime", dayStart.toISOString())
      .lte("start_datetime", dayEnd.toISOString());

    // Find availability for this day of week
    const dayOfWeek = new Date(selectedDate + "T12:00:00").getDay();
    const dayAvailability = availability.find((a) => a.day_of_week === dayOfWeek);

    if (!dayAvailability) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }

    const allSlots = generateSlots(
      dayAvailability.start_time,
      dayAvailability.end_time,
      selectedService.duration_minutes,
      selectedDate
    );

    const buffer = selectedService.buffer_minutes || 0;
    const now = new Date();

    const filtered = allSlots.filter((slot) => {
      if (slot <= now) return false; // no past slots
      return !(existingBookings || []).some((b) => {
        const bStart = new Date(b.start_datetime);
        const bEnd = new Date(b.end_datetime);
        const bufferedStart = new Date(bStart.getTime() - buffer * 60000);
        const bufferedEnd = new Date(bEnd.getTime() + buffer * 60000);
        return slot >= bufferedStart && slot < bufferedEnd;
      });
    });

    setSlots(filtered);
    setLoadingSlots(false);
  }

  async function sendPhoneCode() {
    if (!phone) return;
    setSmsSendError("");
    setSmsSending(true);
    setCodeSent(false);
    setPhoneVerified(false);
    setPhoneCodeInput("");
    try {
      const res = await fetch("/api/calendar/send-verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSmsSendError(data.error || "Failed to send SMS. Check the number and try again.");
      } else {
        setPhoneCode(data.code);
        setCodeSent(true);
      }
    } catch {
      setSmsSendError("Failed to send SMS. Check the number and try again.");
    }
    setSmsSending(false);
  }

  function verifyCode(e) {
    e.preventDefault();
    setPhoneVerifyError("");
    if (phoneCodeInput === phoneCode) {
      setPhoneVerified(true);
      setPhoneCode("");
    } else {
      setPhoneVerifyError("Incorrect code. Try again.");
    }
  }

  async function confirmBooking() {
    if (!selectedSlot || !name.trim() || !email.trim() || !phoneVerified) return;
    for (const field of customFields) {
      if (field.required && !customFieldData[field.id]) {
        setBookingError(`Please complete: ${field.label}`);
        return;
      }
    }

    setBooking(true);
    setBookingError("");
    setConfirmationEmailIssue("");

    const endTime = new Date(selectedSlot.getTime() + selectedService.duration_minutes * 60000);

    if (!selectedService.price || selectedService.price === 0) {
      // Free booking — save and send confirmation emails via server-side API (bypasses RLS)
      const res = await fetch("/api/calendar/confirm-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail:     email,
          clientName:      name,
          clientPhone:     phone,
          providerUserId:  profile.user_id,
          serviceId:       selectedService.id,
          serviceName:     selectedService.name,
          startDatetime:   selectedSlot.toISOString(),
          endDatetime:     endTime.toISOString(),
          duration:        selectedService.duration_minutes,
          price:           0,
          customFieldData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || "Failed to save booking. Please try again.");
        setBooking(false);
        return;
      }
      if (data?.emailSent === false || data?.emailError) {
        setConfirmationEmailIssue(data?.emailError || "Your booking was saved, but the confirmation email with calendar invite did not send.");
      }
      setConfirmed(true);
      setBooking(false);
      return;
    }

    // Paid booking — redirect to Stripe checkout
    const res = await fetch("/api/stripe/create-booking-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId:       selectedService.id,
        providerUserId:  profile.user_id,
        serviceName:     selectedService.name,
        price:           selectedService.price,
        clientName:      name,
        clientEmail:     email,
        clientPhone:     phone,
        selectedSlot:    selectedSlot.toISOString(),
        duration:        selectedService.duration_minutes,
        customFieldData,
      }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setBookingError(data.error || "Could not create checkout. Please try again.");
      setBooking(false);
    }
  }


  // Service-specific settings override global when a service is selected
  const activeSps = selectedService ? (servicePageSettings[selectedService.id] || null) : null;

  const accent      = activeSps?.accentColor || bookingSettings?.accentColor || "#84cc16";
  const headerTitle = activeSps?.pageTitle   || bookingSettings?.pageTitle   || `Book with ${profile?.username}`;
  const headerBio   = activeSps?.pageBio     || bookingSettings?.pageBio     || "Select a time that works for you";
  const logoUrl     = activeSps?.logoUrl     || bookingSettings?.logoUrl     || null;

  // --- Styles ---
  const S = {
    page:         { minHeight: "100vh", background: "#0c121a", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" },
    headerWrap:  { padding: "24px 20px 0", background: "#0c121a" },
    header:       { maxWidth: 1320, width: "100%", margin: "0 auto", background: accent, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 32px", borderRadius: 16, borderBottom: "2px solid rgba(0,0,0,.2)", boxSizing: "border-box" },
    headerLeft:   { display: "flex", alignItems: "center", gap: 18 },
    avatar:       { width: 60, height: 60, borderRadius: 8, background: "rgba(0,0,0,0.25)", border: "2px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden" },
    headerTitle:  { fontSize: 28, fontWeight: 600, letterSpacing: ".2px", color: "#fff", margin: 0 },
    headerSub:    { fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: 4, marginBottom: 0 },
    headerBack:   { background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, whiteSpace: "nowrap" },
    body:         { maxWidth: 640, margin: "0 auto", padding: "28px 20px 80px" },
    progress:     { display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 36, padding: "0 20px" },
    stepDot:      (active, done) => ({ width: 32, height: 32, borderRadius: "50%", background: done ? "#84cc16" : active ? "#fff" : "#1e293b", border: done ? "2px solid #84cc16" : active ? "2px solid #84cc16" : "2px solid #374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: done ? "#fff" : active ? "#0c121a" : "#4b5563", flexShrink: 0 }),
    stepLine:     (done) => ({ flex: 1, height: 2, background: done ? "#84cc16" : "#1e293b", margin: "0 4px" }),
    sectionTitle: { fontSize: 20, fontWeight: 600, marginBottom: 20, color: "#fff" },
    card:         { background: "#161e2b", border: "1px solid #243047", borderRadius: 14, padding: "20px 22px", cursor: "pointer", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" },
    cardTitle:    { fontSize: 18, fontWeight: 600, color: "#fff" },
    cardSub:      { fontSize: 15, color: "#9CA3AF", marginTop: 4 },
    priceTag:     { fontSize: 20, fontWeight: 700, color: "#84cc16" },
    panel:        { background: "#161e2b", border: "1px solid #243047", borderRadius: 14, padding: 24 },
    input:        { width: "100%", padding: "13px 16px", background: "rgba(0,0,0,0.5)", border: "1px solid #374151", borderRadius: 10, color: "#fff", fontSize: 16, boxSizing: "border-box", outline: "none" },
    label:        { display: "block", fontSize: 14, fontWeight: 600, color: "#e0c720", marginBottom: 6, marginTop: 18 },
    dateInput:    { width: "100%", padding: "13px 16px", background: "rgba(0,0,0,0.5)", border: "1px solid #374151", borderRadius: 10, color: "#fff", fontSize: 16, boxSizing: "border-box", colorScheme: "dark" },
    slotGrid:     { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10, marginTop: 16 },
    slotBtn:      (sel) => ({ padding: "12px 8px", borderRadius: 10, border: sel ? `2px solid ${accent}` : "1px solid #374151", background: sel ? `${accent}20` : "rgba(0,0,0,0.3)", color: sel ? accent : "#e5e7eb", cursor: "pointer", fontSize: 15, fontWeight: sel ? 600 : 400 }),
    primaryBtn:   { width: "100%", padding: "16px", background: accent, border: "none", borderRadius: 12, color: "#fff", fontSize: 18, fontWeight: 600, cursor: "pointer", marginTop: 22 },
    disabledBtn:  { width: "100%", padding: "16px", background: "#d2b019", border: "none", borderRadius: 12, color: "#6B7280", fontSize: 18, fontWeight: 600, cursor: "not-allowed", marginTop: 22 },
    backBtn:      { background: "none", border: "none", color: "#ffffff", fontSize: 16, cursor: "pointer", padding: "0 0 20px", display: "flex", alignItems: "center", gap: 6 },
    summaryCard:  { background: "#0c121a", border: "1px solid #243047", borderRadius: 12, padding: "16px 20px", marginBottom: 20 },
    summaryRow:   { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e293b", fontSize: 15 },
    summaryLast:  { display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15 },
    summaryLabel: { color: "#d2b019" },
    summaryVal:   { fontWeight: 600, color: "#fff" },
    verifyRow:    { display: "flex", gap: 10, marginTop: 6 },
    codeInput:    { flex: 1, padding: "13px 16px", background: "rgba(0,0,0,0.5)", border: "1px solid #374151", borderRadius: 10, color: "#fff", fontSize: 20, textAlign: "center", letterSpacing: 6, boxSizing: "border-box" },
    verifyBtn:    { padding: "13px 20px", background: "#22c55e", border: "none", borderRadius: 10, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
    sendCodeBtn:  (sent) => ({ padding: "13px 16px", background: sent ? "#374151" : "#84cc16", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
    error:        { background: "#450a0a", border: "1px solid #dc2626", borderRadius: 10, padding: "12px 16px", fontSize: 15, marginBottom: 16, color: "#fca5a5" },
    noSlots:      { textAlign: "center", padding: "32px 0", fontSize: 16, color: "#6B7280" },
    successPage:  { minHeight: "100vh", background: "#0c121a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
    successCard:  { background: "#161e2b", border: "1px solid #243047", borderRadius: 20, padding: "48px 36px", maxWidth: 500, width: "100%", textAlign: "center" },
    checkRing:    { width: 72, height: 72, borderRadius: "50%", background: "rgba(132,204,22,0.12)", border: "2px solid #84cc16", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" },
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  // ─── Calendar data ─────────────────────────────────────────────────────────
  const calYear      = calMonth.getFullYear();
  const calMonthIdx  = calMonth.getMonth();
  const calFirstDow  = (new Date(calYear, calMonthIdx, 1).getDay() + 6) % 7; // Mon=0
  const calDaysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const calAvailDows = new Set((availability || []).map(a => a.day_of_week));
  const calToday     = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const calCells     = (() => {
    const c = [];
    for (let i = 0; i < calFirstDow; i++) c.push(null);
    for (let d = 1; d <= calDaysInMonth; d++) c.push(d);
    while (c.length % 7 !== 0) c.push(null);
    return c;
  })();
  const calMonthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const calMinMonth  = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

  if (loadError) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, color: "#f87171", marginBottom: 12 }}>{loadError}</div>
          <button onClick={() => { setLoadError(""); loadUser(); }} style={{ padding: "10px 24px", background: "#374151", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 15 }}>Try again</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 16, color: "#d2b019" }}>Loading…</div>
      </div>
    );
  }

  // ─── Confirmed ────────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div style={S.successPage}>
        <div style={S.successCard}>
          <div style={S.checkRing}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#2abae2", margin: "0 0 12px" }}>Booking Confirmed!</h1>
          {confirmationEmailIssue ? (
            <p style={{ fontSize: 16, color: "#fca5a5", margin: "0 0 28px" }}>
              Your booking was saved, but the confirmation email with calendar invite did not send to <strong style={{ color: "#fff" }}>{email}</strong>.<br />
              {confirmationEmailIssue}
            </p>
          ) : (
            <p style={{ fontSize: 16, color: "#9CA3AF", margin: "0 0 28px" }}>
              A confirmation email with a calendar invite has been sent to{" "}
              <strong style={{ color: "#fff" }}>{email}</strong>.
              You'll also receive a reminder 24 hours before.
            </p>
          )}
          <div style={S.summaryCard}>
            <div style={S.summaryRow}><span style={S.summaryLabel}>Service</span><span style={S.summaryVal}>{selectedService?.name}</span></div>
            <div style={S.summaryRow}><span style={S.summaryLabel}>Date</span><span style={S.summaryVal}>{selectedSlot ? new Date(selectedSlot).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : ""}</span></div>
            <div style={S.summaryLast}><span style={S.summaryLabel}>Time</span><span style={S.summaryVal}>{selectedSlot ? new Date(selectedSlot).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : ""}</span></div>
          </div>
        </div>
      </div>
    );
  }

  const stepOrder = ["service", "date", "time", "details"];
  const stepIdx = stepOrder.indexOf(step);

  // ─── Main render ─────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header — 1320px centred card with rounded corners */}
      <div style={S.headerWrap}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            {logoUrl && (
              <div style={S.avatar}>
                <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div>
              <h1 style={S.headerTitle}>{headerTitle}</h1>
              {headerBio && <p style={S.headerSub}>{headerBio}</p>}
            </div>
          </div>
          {stepIdx > 0 && (
            <button style={S.headerBack} onClick={() => setStep(stepOrder[stepIdx - 1])}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
          )}
        </div>
      </div>

      {/* Step progress */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 0" }}>
        <div style={S.progress}>
          {["Service", "Date", "Time", "Details"].map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={S.stepDot(i === stepIdx, i < stepIdx)}>
                  {i < stepIdx ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === stepIdx ? "#fff" : i < stepIdx ? "#84cc16" : "#4b5563", fontWeight: i === stepIdx ? 600 : 400 }}>{label}</span>
              </div>
              {i < 3 && <div style={S.stepLine(i < stepIdx)} />}
            </div>
          ))}
        </div>
      </div>

      <div style={S.body}>
        {/* ── STEP: SERVICE ── */}
        {step === "service" && (
          <>
            <div style={S.sectionTitle}>Choose a service</div>
            {services.length === 0 && <div style={S.noSlots}>No services available at this time.</div>}
            {services.map((svc) => (
              <div
                key={svc.id}
                style={S.card}
                onClick={() => { setSelectedService(svc); setStep("date"); }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#84cc16")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#243047")}
              >
                <div>
                  <div style={S.cardTitle}>{svc.name}</div>
                  <div style={S.cardSub}>{svc.duration_minutes} minutes</div>
                </div>
                <div style={S.priceTag}>{svc.price > 0 ? `$${svc.price.toFixed(2)}` : "Free"}</div>
              </div>
            ))}
          </>
        )}

        {/* ── STEP: DATE ── */}
        {step === "date" && (
          <>
            {services.length > 1 && (
              <button style={S.backBtn} onClick={() => { setStep("service"); setSelectedService(null); }}>← Back</button>
            )}
            <div style={S.sectionTitle}>Choose a date</div>
            <div style={S.panel}>
              {/* Service summary */}
              <div style={{ marginBottom: 20, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>{selectedService?.name}</span>
                <span style={{ fontSize: 14, color: "#9CA3AF" }}>{selectedService?.duration_minutes} min</span>
                {selectedService?.price > 0 && <span style={{ fontSize: 14, color: accent }}>${selectedService?.price?.toFixed(2)}</span>}
              </div>

              {/* Month navigation */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <button
                  onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth() - 1); if (d >= calMinMonth) setCalMonth(d); }}
                  style={{ background: "none", border: "none", color: calMonth <= calMinMonth ? "#374151" : "#9CA3AF", fontSize: 24, cursor: calMonth <= calMinMonth ? "default" : "pointer", padding: "2px 12px", lineHeight: 1 }}
                >‹</button>
                <span style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>{calMonthNames[calMonthIdx]} {calYear}</span>
                <button
                  onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth() + 1); setCalMonth(d); }}
                  style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 24, cursor: "pointer", padding: "2px 12px", lineHeight: 1 }}
                >›</button>
              </div>

              {/* Day-of-week headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#4B5563", padding: "4px 0" }}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {calCells.map((day, idx) => {
                  if (!day) return <div key={idx} />;
                  const date    = new Date(calYear, calMonthIdx, day);
                  const dow     = date.getDay();
                  const isPast  = date < calToday;
                  const isAvail = calAvailDows.has(dow);
                  const dateStr = `${calYear}-${String(calMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isSel   = selectedDate === dateStr;
                  const active  = !isPast && isAvail;
                  return (
                    <div
                      key={idx}
                      onClick={() => { if (!active) return; setSelectedDate(dateStr); setSelectedSlot(null); setStep("time"); }}
                      style={{
                        textAlign: "center",
                        padding: "11px 4px",
                        borderRadius: 8,
                        fontSize: 15,
                        fontWeight: isSel ? 700 : 400,
                        cursor: active ? "pointer" : "default",
                        background: isSel ? accent : active ? `${accent}14` : "transparent",
                        color: isSel ? "#0c121a" : active ? "#e5e7eb" : "#374151",
                        border: isSel ? `2px solid ${accent}` : active ? `1px solid ${accent}40` : "1px solid transparent",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => { if (active && !isSel) e.currentTarget.style.background = `${accent}28`; }}
                      onMouseLeave={(e) => { if (active && !isSel) e.currentTarget.style.background = `${accent}14`; }}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

              {calAvailDows.size === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#6B7280", fontSize: 15 }}>No availability set up yet.</div>
              )}
            </div>
          </>
        )}

        {/* ── STEP: TIME ── */}
        {step === "time" && (
          <>
            <button style={S.backBtn} onClick={() => { setStep("date"); setSelectedSlot(null); }}>← Back</button>
            <div style={S.sectionTitle}>
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div style={S.panel}>
              {loadingSlots ? (
                <div style={S.noSlots}>Checking available times…</div>
              ) : slots.length === 0 ? (
                <>
                  <div style={S.noSlots}>No available times on this date.</div>
                  <button style={S.primaryBtn} onClick={() => { setStep("date"); setSelectedDate(""); }}>Choose Another Date</button>
                </>
              ) : (
                <>
                  <div style={S.slotGrid}>
                    {slots.map((slot, i) => (
                      <button
                        key={i}
                        style={S.slotBtn(selectedSlot?.getTime() === slot.getTime())}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                  {selectedSlot && (
                    <button style={S.primaryBtn} onClick={() => setStep("details")}>Continue →</button>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── STEP: DETAILS ── */}
        {step === "details" && (
          <>
            <button style={S.backBtn} onClick={() => setStep("time")}>← Back</button>

            {/* Booking summary */}
            <div style={S.summaryCard}>
              <div style={S.summaryRow}><span style={S.summaryLabel}>Service</span><span style={S.summaryVal}>{selectedService?.name}</span></div>
              <div style={S.summaryRow}><span style={S.summaryLabel}>Date</span><span style={S.summaryVal}>{new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span></div>
              <div style={S.summaryRow}><span style={S.summaryLabel}>Time</span><span style={S.summaryVal}>{selectedSlot?.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <div style={S.summaryLast}><span style={S.summaryLabel}>Price</span><span style={{ ...S.summaryVal, color: "#84cc16" }}>{selectedService?.price > 0 ? `$${selectedService.price.toFixed(2)}` : "Free"}</span></div>
            </div>

            <div style={S.sectionTitle}>Your details</div>

            {bookingError && <div style={S.error}>{bookingError}</div>}

            <div style={S.panel}>
              <label style={S.label}>Full Name</label>
              <input placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} style={S.input} />

              <label style={S.label}>Email Address</label>
              <input type="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={S.input} />

              <label style={S.label}>Mobile Number</label>
              <div style={{ display: "flex", gap: 10, marginTop: 0 }}>
                <input
                  placeholder="+61 400 000 000"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setCodeSent(false); setPhoneVerified(false); }}
                  style={{ ...S.input, flex: 1 }}
                  disabled={phoneVerified}
                />
                {!phoneVerified && (
                  <button onClick={sendPhoneCode} disabled={smsSending || !phone} style={S.sendCodeBtn(codeSent)}>
                    {smsSending ? "Sending…" : codeSent ? "Resend" : "Send Code"}
                  </button>
                )}
              </div>
              {smsSendError && <div style={{ color: "#f87171", fontSize: 14, marginTop: 6 }}>{smsSendError}</div>}

              {codeSent && !phoneVerified && (
                <div style={{ marginTop: 16 }}>
                  <label style={S.label}>Enter the 6-digit code sent to your phone</label>
                  <form onSubmit={verifyCode} style={S.verifyRow}>
                    <input
                      placeholder="000000"
                      value={phoneCodeInput}
                      onChange={(e) => setPhoneCodeInput(e.target.value)}
                      maxLength={6}
                      style={S.codeInput}
                    />
                    <button type="submit" style={S.verifyBtn}>Verify</button>
                  </form>
                  {phoneVerifyError && <div style={{ color: "#f87171", fontSize: 14, marginTop: 6 }}>{phoneVerifyError}</div>}
                </div>
              )}

              {phoneVerified && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 15, color: "#22c55e" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Phone verified
                </div>
              )}

              {/* Custom fields */}
              {customFields.map((field) => (
                <div key={field.id}>
                  <label style={S.label}>{field.label}{field.required && " *"}</label>
                  {field.type === "select" ? (
                    <select
                      value={customFieldData[field.id] || ""}
                      onChange={(e) => setCustomFieldData((p) => ({ ...p, [field.id]: e.target.value }))}
                      style={{ ...S.input, appearance: "none" }}
                    >
                      <option value="">Select…</option>
                      {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      placeholder={field.placeholder || ""}
                      value={customFieldData[field.id] || ""}
                      onChange={(e) => setCustomFieldData((p) => ({ ...p, [field.id]: e.target.value }))}
                      style={{ ...S.input, marginTop: 0 }}
                    />
                  )}
                </div>
              ))}

              {/* Confirm button */}
              {(!name.trim() || !email.trim() || !phoneVerified) ? (
                <button style={S.disabledBtn} disabled>
                  {!phoneVerified ? "Verify your phone to continue" : "Fill in your details to continue"}
                </button>
              ) : (
                <button onClick={confirmBooking} disabled={booking} style={S.primaryBtn}>
                  {booking ? "Processing…" : selectedService?.price > 0 ? `Pay $${selectedService.price.toFixed(2)} & Confirm` : "Confirm Booking"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

