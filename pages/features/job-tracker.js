import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState, useEffect, useRef } from "react";

const A = "#ef4444";

const INITIAL_CARDS = {
  new: [
    { id: "c1", title: "Kitchen reno quote", client: "J. Harrison", value: "$4,200" },
    { id: "c2", title: "Deck installation", client: "M. Park", value: "$9,800" },
    { id: "c3", title: "Bathroom refit", client: "C. Nguyen", value: "$3,100" },
  ],
  progress: [
    { id: "c4", title: "Fence & gate build", client: "A. Smith", value: "$2,600" },
    { id: "c5", title: "Roof repair", client: "P. Wilson", value: "$1,400" },
  ],
  payment: [
    { id: "c6", title: "Pergola install", client: "B. Torres", value: "$6,500" },
  ],
  complete: [
    { id: "c7", title: "Driveway paving", client: "R. Davis", value: "$5,200" },
    { id: "c8", title: "Insulation job", client: "L. Evans", value: "$1,900" },
  ],
};

const COLS = [
  { key: "new", label: "New Quote", color: "#64748b" },
  { key: "progress", label: "In Progress", color: A },
  { key: "payment", label: "Awaiting Payment", color: "#f59e0b" },
  { key: "complete", label: "Complete", color: "#10b981" },
];

const MOVE_SEQUENCE = [
  { cardId: "c1", from: "new", to: "progress", delay: 1200 },
  { cardId: "c4", from: "progress", to: "payment", delay: 2600 },
  { cardId: "c6", from: "payment", to: "complete", delay: 4000 },
  { cardId: "c2", from: "new", to: "progress", delay: 5400 },
];

function KanbanDemo() {
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [moving, setMoving] = useState(null);
  const stepRef = useRef(0);

  function moveCard(cardId, from, to) {
    setMoving(cardId);
    setTimeout(() => {
      setCards(prev => {
        const card = prev[from].find(c => c.id === cardId);
        if (!card) return prev;
        return {
          ...prev,
          [from]: prev[from].filter(c => c.id !== cardId),
          [to]: [card, ...prev[to]],
        };
      });
      setMoving(null);
    }, 300);
  }

  useEffect(() => {
    let timeouts = [];
    MOVE_SEQUENCE.forEach(step => {
      const t = setTimeout(() => moveCard(step.cardId, step.from, step.to), step.delay);
      timeouts.push(t);
    });
    const reset = setTimeout(() => {
      setCards(INITIAL_CARDS);
    }, 7000);
    timeouts.push(reset);
    return () => timeouts.forEach(clearTimeout);
  }, [cards === INITIAL_CARDS ? "init" : "running"]);

  return (
    <div style={{ width: "100%", maxWidth: 520, overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,130px)", gap: 10, minWidth: 560 }}>
        {COLS.map(col => (
          <div key={col.key} style={{ background: "#070e18", border: `1px solid ${col.color}33`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${col.color}22`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: col.color }}>{col.label}</div>
              <div style={{ fontSize: 11, background: `${col.color}18`, color: col.color, borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>{cards[col.key].length}</div>
            </div>
            <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: 7, minHeight: 200 }}>
              {cards[col.key].map(card => (
                <div key={card.id} style={{
                  background: "#0c1524", border: `1px solid ${moving === card.id ? col.color : "#1e293b"}`,
                  borderRadius: 9, padding: "10px 10px", fontSize: 11, transition: "all 0.3s",
                  transform: moving === card.id ? "scale(0.95)" : "scale(1)",
                  opacity: moving === card.id ? 0.6 : 1,
                  boxShadow: moving === card.id ? `0 0 14px ${col.color}44` : "none",
                }}>
                  <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 4, lineHeight: 1.3 }}>{card.title}</div>
                  <div style={{ color: "#475569", marginBottom: 6 }}>{card.client}</div>
                  <div style={{ color: col.color, fontWeight: 800 }}>{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#334155" }}>Jobs move automatically as you update their status</div>
    </div>
  );
}

const FEATS = [
  { i: "📋", t: "Instant job cards", b: "New quote request? Create a job card in 20 seconds. Client, scope, value, deadline — all in one place." },
  { i: "🔄", t: "Pipeline stages", b: "Customise your columns to match exactly how you work. New lead → Quoted → Approved → In progress → Invoiced → Paid." },
  { i: "💰", t: "Payment stage tracking", b: "Never forget an unpaid invoice. The 'Awaiting Payment' column keeps every outstanding job front of mind." },
  { i: "📎", t: "Files, photos & notes", b: "Attach before/after photos, contracts, and notes to each job card. Everything in one place, always." },
  { i: "🔔", t: "Deadline alerts", b: "Set a due date on any job. Get notified before it slips. Clients get automatic status updates." },
  { i: "📊", t: "Revenue dashboard", b: "See total value in each pipeline stage. Know exactly how much is quoted, in progress, and in the bank." },
];

export default function JobTrackerFeaturePage() {
  return (
    <>
      <Head>
        <title>Job Tracker — GR8 RESULT | Every job tracked. Zero missed invoices.</title>
        <meta name="description" content="Visual Kanban pipeline for service businesses. Track jobs from quote to payment. Never lose a job or invoice again." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Job Tracker →" ctaHref="/modules/jobs" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>🔧 Job Tracker</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Every job tracked.<br />Every invoice paid.<br /><span style={{ color: A }}>Nothing falls through.</span>
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 440 }}>A visual pipeline built for trade and service businesses. See every job from quote to completion, track payments, attach files and photos, and never lose a job in an email chain again.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/modules/jobs" style={{ background: A, color: "#fff", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>Track my jobs →</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><KanbanDemo /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["0","Jobs lost in email threads ever again"],["40+","Custom pipeline stages for any trade"],["$0","Missed invoices when payment stage is tracked"],["20s","To create a new job card from scratch"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Stop running your business<br />from your memory.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 500, margin: "0 auto", lineHeight: 1.65 }}>Every job you're juggling right now — from "I emailed a quote" to "waiting on final payment" — needs to live somewhere you can actually see it.</p>
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
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>Your jobs, organised.<br />Your invoices, paid.</h2>
        <Link href="/modules/jobs" style={{ background: A, color: "#fff", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>Start tracking →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>Included in all plans. Unlimited jobs.</div>
      </section>
    </>
  );
}
