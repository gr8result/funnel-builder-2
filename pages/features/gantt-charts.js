import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";
import { useState } from "react";

const A = "#3b82f6";

const TASKS = [
  { id: 1, name: "Discovery & requirements", owner: "Alice", start: 0, len: 3, phase: 0, status: "Done" },
  { id: 2, name: "Foundation & groundwork", owner: "Bob", start: 2, len: 4, phase: 1, status: "Done" },
  { id: 3, name: "Structural framing", owner: "Carlos", start: 5, len: 5, phase: 2, status: "In Progress" },
  { id: 4, name: "Roofing & weatherproofing", owner: "Alice", start: 9, len: 3, phase: 3, status: "Upcoming" },
  { id: 5, name: "Electrical & plumbing", owner: "Dana", start: 11, len: 4, phase: 3, status: "Upcoming" },
  { id: 6, name: "Interior fit-out", owner: "Bob", start: 14, len: 5, phase: 4, status: "Upcoming" },
  { id: 7, name: "Final inspection", owner: "Carlos", start: 18, len: 2, phase: 5, status: "Upcoming" },
];

const COLS = 20;
const PHASE_COLORS = ["#6366f1","#06b6d4","#3b82f6","#f59e0b","#10b981","#8b5cf6"];
const STATUS_COLOR = { Done: "#4ade80", "In Progress": A, Upcoming: "#334155" };

function GanttDemo() {
  const [hovered, setHovered] = useState(null);
  const t = hovered ? TASKS.find(ta => ta.id === hovered) : null;

  return (
    <div style={{ width: "100%", maxWidth: 520, background: "#060e18", border: `1px solid ${A}33`, borderRadius: 20, padding: "20px", boxShadow: `0 0 80px ${A}18`, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Home Build — Project Plan</div>
        <div style={{ fontSize: 12, color: "#475569" }}>Week view · {COLS} weeks</div>
      </div>

      {/* Week header */}
      <div style={{ display: "grid", gridTemplateColumns: `140px 1fr`, gap: 0, marginBottom: 6 }}>
        <div />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS},1fr)`, gap: 0 }}>
          {Array.from({ length: COLS }, (_, i) => (
            <div key={i} style={{ fontSize: 9, color: "#1e293b", textAlign: "center", paddingBottom: 4, borderLeft: "1px solid #0f1a2a" }}>W{i + 1}</div>
          ))}
        </div>
      </div>

      {/* Task rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {TASKS.map(task => (
          <div key={task.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 0, alignItems: "center" }}
            onMouseEnter={() => setHovered(task.id)} onMouseLeave={() => setHovered(null)}>
            <div style={{ fontSize: 11, color: hovered === task.id ? "#f1f5f9" : "#64748b", paddingRight: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.15s" }}>{task.name}</div>
            <div style={{ position: "relative", height: 22, display: "grid", gridTemplateColumns: `repeat(${COLS},1fr)` }}>
              {Array.from({ length: COLS }, (_, i) => (
                <div key={i} style={{ height: "100%", background: i % 2 === 0 ? "#070f1a" : "#060c18", borderLeft: "1px solid #0f1a2a" }} />
              ))}
              <div style={{
                position: "absolute", top: 2, bottom: 2,
                left: `${(task.start / COLS) * 100}%`,
                width: `${(task.len / COLS) * 100}%`,
                background: hovered === task.id ? PHASE_COLORS[task.phase] : `${PHASE_COLORS[task.phase]}aa`,
                borderRadius: 4,
                transition: "background 0.15s",
                boxShadow: hovered === task.id ? `0 0 16px ${PHASE_COLORS[task.phase]}88` : "none",
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      <div style={{ marginTop: 18, minHeight: 60, background: "#0c1524", border: `1px solid ${t ? A + "44" : "#1e293b"}`, borderRadius: 12, padding: "14px 16px", transition: "border-color 0.2s" }}>
        {t ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div><div style={{ fontSize: 11, color: "#334155" }}>Task</div><div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginTop: 3 }}>{t.name}</div></div>
            <div><div style={{ fontSize: 11, color: "#334155" }}>Owner</div><div style={{ fontSize: 13, fontWeight: 700, color: PHASE_COLORS[t.phase], marginTop: 3 }}>{t.owner}</div></div>
            <div><div style={{ fontSize: 11, color: "#334155" }}>Status</div><div style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[t.status], marginTop: 3 }}>{t.status}</div></div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#1e293b", textAlign: "center", paddingTop: 8 }}>← Hover a bar to see details</div>
        )}
      </div>
    </div>
  );
}

const FEATS = [
  { i: "📊", t: "Visual Gantt timeline", b: "See every task, every deadline, every dependency on one canvas. Drag to reschedule. Zoom from years to days." },
  { i: "👥", t: "Team assignments", b: "Assign tasks to team members or subcontractors. Everyone sees only their work — no confusion, no missed handoffs." },
  { i: "🔗", t: "Task dependencies", b: "Link tasks so that if Phase 1 slips, Phase 2 moves automatically. No manual date shuffling." },
  { i: "🚦", t: "Status tracking", b: "Not started, in progress, blocked, done. Update with one click. Managers see real-time progress at a glance." },
  { i: "📎", t: "Files & notes per task", b: "Attach plans, invoices, photos, and specs directly to each task. Everything in context, nothing lost in email." },
  { i: "📲", t: "Mobile progress updates", b: "Field teams update task status from their phone. No app installs, no logins — just a link." },
];

export default function GanttChartsFeaturePage() {
  return (
    <>
      <Head>
        <title>Gantt Charts — GR8 RESULT | Every project delivered on time</title>
        <meta name="description" content="Visual project timelines with task dependencies, team assignments, real-time progress, and mobile updates." />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#060c16;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}a{text-decoration:none}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:repeat(2,1fr)!important}.feat-grid{grid-template-columns:1fr!important}}`}</style>
      <FeaturesNav cta="Open Gantt →" ctaHref="/modules/gantt" />

      <section style={{ padding: "96px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${A}18`, border: `1px solid ${A}44`, borderRadius: 100, padding: "6px 16px", marginBottom: 28, fontSize: 13, fontWeight: 700, color: A, letterSpacing: "0.06em", textTransform: "uppercase" }}>📅 Gantt Charts</div>
            <h1 style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.03em", marginBottom: 24 }}>
              Every project.<br />Every deadline.<br /><span style={{ color: A }}>Always on track.</span>
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", lineHeight: 1.75, marginBottom: 40, maxWidth: 440 }}>Visual project timelines built for contractors, builders, and service businesses. Assign tasks, track progress, link dependencies, and see your whole project on one screen. No spreadsheet nightmares.</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/modules/gantt" style={{ background: A, color: "#fff", padding: "15px 32px", borderRadius: 12, fontSize: 17, fontWeight: 800, boxShadow: `0 12px 40px ${A}44`, display: "inline-block" }}>Plan my project →</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><GanttDemo /></div>
        </div>
      </section>

      <section style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", padding: "44px 32px" }}>
        <div className="stats-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[["40+","Stage types for any trade or service"],["Real-time","Progress visible to everyone, always"],["Auto","Dependencies shift when schedules change"],["📲","Field teams update from their phone"]].map(([n,l]) => (
            <div key={n}><div style={{ fontSize: 44, fontWeight: 900, color: A, letterSpacing: "-0.03em" }}>{n}</div><div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "96px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: "clamp(28px,3vw,46px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Stop managing projects<br />in your head.</h2>
          <p style={{ fontSize: 17, color: "#475569", maxWidth: 500, margin: "0 auto", lineHeight: 1.65 }}>Messy WhatsApp chains and shared spreadsheets have a way of making projects blow out. A visual timeline changes everything.</p>
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
        <h2 style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>Your next project,<br />delivered on time.</h2>
        <Link href="/modules/gantt" style={{ background: A, color: "#fff", padding: "18px 44px", borderRadius: 14, fontSize: 18, fontWeight: 800, boxShadow: `0 18px 54px ${A}44`, display: "inline-block" }}>Start my first Gantt →</Link>
        <div style={{ marginTop: 20, fontSize: 13, color: "#334155" }}>Included in all plans. Unlimited projects.</div>
      </section>
    </>
  );
}
