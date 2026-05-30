import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState } from "react";

const A = "#06b6d4";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const TIMES = ["9:00am","9:30am","10:00am","10:30am","11:00am","11:30am","2:00pm","2:30pm","3:00pm","3:30pm","4:00pm","4:30pm"];
const BOOKED = new Set(["9:00am","10:30am","2:00pm","4:00pm"]);

function BookingDemo() {
  const [selDay, setSelDay] = useState("Wed");
  const [selTime, setSelTime] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <div style={{ background: "#060e18", border: `1px solid ${A}44`, borderRadius: 20, padding: "48px 32px", textAlign: "center", width: "100%", maxWidth: 480, boxShadow: `0 0 80px ${A}20` }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Booking confirmed!</div>
        <div style={{ fontSize: 15, color: "#94a3b8", marginBottom: 24 }}>
          {selDay} at {selTime} — Confirmation sent to customer automatically.
        </div>
        <div style={{ fontSize: 13, color: "#0ea5e9", background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.3)", borderRadius: 10, padding: "10px 20px", marginBottom: 24 }}>
          📱 Reminder SMS will send 24h before
        </div>
        <button onClick={() => { setConfirmed(false); setSelTime(null); }} style={{ background: "none", border: `1px solid ${A}44`, color: A, borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Try another time</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#060e18", border: `1px solid ${A}44`, borderRadius: 20, overflow: "hidden", width: "100%", maxWidth: 480, boxShadow: `0 0 80px ${A}20` }}>
      <div style={{ background: `linear-gradient(135deg, ${A}22, #0c1a2e)`, padding: "20px 24px", borderBottom: "1px solid #0f2035" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: A, marginBottom: 4 }}>Book a session</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Strategy Call — 45 min · Free</div>
      </div>
      <div style={{ padding: "20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#475569", marginBottom: 12 }}>Select a day</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => { setSelDay(d); setSelTime(null); }}
              style={{ flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: selDay === d ? `1.5px solid ${A}` : "1px solid #1e293b", background: selDay === d ? `${A}20` : "#0b1626", color: selDay === d ? A : "#64748b", transition: "all 0.15s" }}>
              {d}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#475569", marginBottom: 12 }}>Available times</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 24 }}>
          {TIMES.map(t => {
            const busy = BOOKED.has(t);
            const sel = selTime === t;
            return (
              <button key={t} disabled={busy} onClick={() => setSelTime(t)}
                style={{ padding: "10px 6px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", border: sel ? `1.5px solid ${A}` : "1px solid #1e293b", background: busy ? "#0b1626" : sel ? `${A}20` : "#0f1e30", color: busy ? "#1e293b" : sel ? A : "#94a3b8", transition: "all 0.15s", textDecoration: busy ? "line-through" : "none" }}>
                {busy ? "—" : t}
              </button>
            );
          })}
        </div>
        <button disabled={!selTime} onClick={() => selTime && setConfirmed(true)}
          style={{ width: "100%", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: selTime ? "pointer" : "not-allowed", background: selTime ? A : "#0f1e30", color: selTime ? "#000" : "#1e293b", border: "none", transition: "all 0.2s" }}>
          {selTime ? `Confirm ${selDay} at ${selTime} →` : "Select a time above"}
        </button>
      </div>
    </div>
  );
}

const FEATS = [
  { i: "🗓️", t: "24/7 online booking", b: "Your page is always open. Clients book at 2am, midnight, or while you're on-site. No back and forth." },
  { i: "💳", t: "Take payment upfront", b: "Add Stripe to your booking flow. Clients pay when they confirm. No chasing deposits or last-minute cancellations." },
  { i: "⏰", t: "Automated reminders", b: "SMS and email reminders fire automatically before every appointment. Fewer no-shows guaranteed." },
  { i: "📋", t: "Smart availability rules", b: "Set your working hours, buffer time between jobs, and blackout dates. No double-bookings, ever." },
  { i: "🎯", t: "Multiple service types", b: "Different durations, prices, locations, team members. One booking page handles everything." },
  { i: "📊", t: "Booking analytics", b: "See which services book most, peak booking times, and which marketing channels send the most appointments." },
];

export default function CalendarFeaturePage() {
  return (
    <>
      <Head>
        <title>Calendar & Bookings — GR8 RESULT | 24/7 booking that takes payment upfront</title>
        <meta name="description" content="Let clients book and pay 24/7. Automated reminders cut no-shows by 80%. Works while you sleep." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Calendar →" ctaHref="/modules/calendar/dashboard" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>📅 Calendar & Bookings</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Let clients book<br />and pay you —<br /><span style={{ color: A }}>while you sleep.</span>
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 440 }}>Your booking page is live 24/7. It shows real-time availability. It takes payment upfront. It sends reminders automatically. You just show up.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/modules/calendar/dashboard" style={{ background: A, color: "#000", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>Set up my calendar →</Link>
              <Link href="/modules/calendar/services" style={{ color: "#94a3b8", padding: "15px 24px", borderRadius: 12, fontSize: 16, fontWeight: 600, border: "1px solid #1e293b", display: "inline-block" }}>Manage services</Link>
            </div>
            <div style={{ marginTop: 28, display: "flex", gap: 20, flexWrap: "wrap" }}>
              {["No double-bookings","Stripe payments","SMS reminders"].map(l => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#64748b" }}><span style={{ color: A }}>✓</span> {l}</div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><BookingDemo /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["80%","Fewer no-shows with automated reminders"],["24/7","Booking availability — no phone tag"],["2 min","To create a bookable service type"],["0","Invoices manually chased when paid upfront"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: A, marginBottom: 16 }}>What's included</div>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Stop running your schedule<br />through your DMs.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 500, margin: "0 auto", lineHeight: 1.65 }}>One booking link. Real-time availability. Automatic confirmations and reminders. Stripe payment at the point of booking.</p>
        </div>
        <div className="feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 24 }}>
          {FEATS.map(f => (
            <div key={f.t} style={{ background: "#0b1220", border: "1px solid #1e293b", borderRadius: 16, padding: "28px 24px" }}>
              <div style={{ fontSize: 34, marginBottom: 16 }}>{f.i}</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{f.t}</h3>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "80px 32px 100px", textAlign: "center", background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${A}12 0%, transparent 70%)` }}>
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>Your next booking<br />is 2 minutes away.</h2>
        <p style={{ fontSize: 18, color: "#475569", marginBottom: 40 }}>Set up your first service. Share the link. Done.</p>
        <Link href="/modules/calendar/dashboard" style={{ background: A, color: "#000", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>Start taking bookings →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>Included in all plans. No extra booking fees.</div>
      </section>
    </>
  );
}
