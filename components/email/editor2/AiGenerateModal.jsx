// components/email/editor2/AiGenerateModal.jsx
// Full-email AI generator modal
import { useState } from "react";

const GOALS = [
  { value: "welcome",      label: "Welcome / Onboarding" },
  { value: "promotional",  label: "Promotion / Sale" },
  { value: "announcement", label: "Announcement / Launch" },
  { value: "newsletter",   label: "Newsletter" },
  { value: "follow-up",    label: "Follow-up / Re-engage" },
  { value: "event",        label: "Event Invite" },
  { value: "transactional",label: "Transactional / Receipt" },
  { value: "general",      label: "General" },
];

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly",     label: "Friendly" },
  { value: "casual",       label: "Casual" },
  { value: "playful",      label: "Playful" },
  { value: "urgent",       label: "Urgent" },
  { value: "inspirational",label: "Inspirational" },
];

export default function AiGenerateModal({ onClose, onInsert, userId }) {
  const [brandName, setBrandName]       = useState("");
  const [goal, setGoal]                 = useState("general");
  const [tone, setTone]                 = useState("professional");
  const [description, setDescription]   = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [mode, setMode]                 = useState("replace");
  const [generateImages, setGenImages]  = useState(true);
  const [progressStep, setProgressStep] = useState("");

  async function generate() {
    if (!description.trim()) { setError("Please describe what the email is about."); return; }
    setError("");
    setLoading(true);
    setProgressStep("\u270d\ufe0f Writing email copy\u2026");
    try {
      const resp = await fetch("/api/email/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, brandName, goal, tone, generateImages: generateImages && !!userId, userId }),
      });
      if (generateImages && userId) setProgressStep("\uD83C\uDFA8 Generating images\u2026 (this may take ~30s)");
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "AI generation failed");
      setProgressStep("\u2705 Done!");
      setTimeout(() => {
        onInsert(data.blocks, mode, data.subject || "");
        onClose();
      }, 400);
    } catch (e) {
      setError(e.message || "Something went wrong");
      setProgressStep("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "#0f172a", border: "1px solid #334155", borderRadius: 16,
        padding: "32px 36px", width: 540, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
        color: "#f1f5f9", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <span style={{ fontSize: 28 }}>✨</span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Generate Email with AI</h2>
        </div>

        <Label>Brand / Company Name</Label>
        <input
          value={brandName}
          onChange={e => setBrandName(e.target.value)}
          placeholder="e.g. Gr8 Result, Nike, my startup…"
          style={inputStyle}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <Label>Email Goal</Label>
            <select value={goal} onChange={e => setGoal(e.target.value)} style={selectStyle}>
              {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Tone</Label>
            <select value={tone} onChange={e => setTone(e.target.value)} style={selectStyle}>
              {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <Label>Describe the email</Label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={"e.g. A Black Friday sale email for our online fitness course. 50% off this weekend only. Include 3 key benefits, a countdown urgency section, and a strong CTA to buy now."}
          rows={5}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
        />

        {/* Image generation toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px" }}>
          <div
            onClick={() => setGenImages(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11, cursor: "pointer", position: "relative",
              background: generateImages ? "linear-gradient(135deg,#7c3aed,#2563eb)" : "#334155",
              transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 3, transition: "left 0.2s",
              left: generateImages ? 21 : 3,
            }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Auto-generate images with DALL-E 3</div>
            <div style={{ fontSize: 16, color: "#64748b", marginTop: 2 }}>{userId ? "Images will be generated and uploaded automatically (~30s)" : "Sign in required to generate images"}</div>
          </div>
        </div>

        <Label>Insert Mode</Label>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[["replace", "Replace current email"], ["append", "Append to current email"]].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)} style={{
              flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer",
              background: mode === v ? "#2563eb" : "#1e293b",
              color: mode === v ? "#fff" : "#94a3b8",
              border: mode === v ? "2px solid #3b82f6" : "2px solid #334155",
            }}>{l}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: "#450a0a", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 16, color: "#fca5a5" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", borderRadius: 10, background: "#1e293b",
            color: "#94a3b8", border: "1px solid #334155", fontWeight: 600, fontSize: 16, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={generate} disabled={loading} style={{
            flex: 2, padding: "11px 0", borderRadius: 10,
            background: loading ? "#1e40af" : "linear-gradient(135deg,#7c3aed,#2563eb)",
            color: "#fff", border: "none", fontWeight: 600, fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexDirection: "column",
          }}>
            {loading ? (
              <><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner /> {progressStep || "Generating\u2026"}</div></>
            ) : (
              <><span style={{ fontSize: 18 }}>✨</span> Generate Email</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{children}</div>;
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <path d="M12 2 A10 10 0 0 1 22 12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #334155",
  background: "#1e293b", color: "#f1f5f9", fontSize: 16, marginBottom: 16,
  outline: "none", boxSizing: "border-box",
};

const selectStyle = {
  ...inputStyle, marginBottom: 0, cursor: "pointer", appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
};
