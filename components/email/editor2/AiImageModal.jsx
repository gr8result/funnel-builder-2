// components/email/editor2/AiImageModal.jsx
// Generate an image with DALL-E 3 and insert it into a block
import { useState } from "react";
import { emailEditorFetch } from "./emailEditorApi";

const SIZES = [
  { value: "1024x1024", label: "Square (1024×1024)" },
  { value: "1792x1024", label: "Landscape (1792×1024)" },
  { value: "1024x1792", label: "Portrait (1024×1792)" },
];

export default function AiImageModal({ userId, onClose, onSelect }) {
  const [prompt, setPrompt]   = useState("");
  const [size, setSize]       = useState("1792x1024");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [preview, setPreview] = useState(null);

  async function generate() {
    if (!prompt.trim()) { setError("Enter a description for the image."); return; }
    setError("");
    setLoading(true);
    setPreview(null);
    try {
      const resp = await emailEditorFetch("/api/email/ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId, size }),
      }, {
        authErrorMessage: "Sign in required to generate images.",
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Image generation failed");
      setPreview(data.url);
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "#0f172a", border: "1px solid #334155", borderRadius: 16,
        padding: "28px 32px", width: 480, maxWidth: "95vw",
        color: "#f1f5f9", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>🎨</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Generate Image with AI</h2>
        </div>

        <Lbl>Describe the image</Lbl>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={"e.g. A vibrant flat-lay of fitness equipment on a dark gym floor, professional product photography, high contrast"}
          rows={3}
          style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
        />

        <Lbl>Aspect Ratio</Lbl>
        <select value={size} onChange={e => setSize(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {error && (
          <div style={{ background: "#450a0a", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 16, color: "#fca5a5" }}>
            {error}
          </div>
        )}

        {preview && (
          <div style={{ marginBottom: 16 }}>
            <img src={preview} alt="AI generated" style={{ width: "100%", borderRadius: 8, display: "block" }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={generate} disabled={loading} style={genBtn(loading)}>
            {loading ? <><Spin /> Generating…</> : <><span>✨</span> Generate</>}
          </button>
          {preview && (
            <button onClick={() => { onSelect(preview); onClose(); }} style={useBtn}>
              ✔ Use This
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Lbl({ children }) {
  return <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{children}</div>;
}

function Spin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <path d="M12 2 A10 10 0 0 1 22 12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const inp = {
  width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #334155",
  background: "#1e293b", color: "#f1f5f9", fontSize: 16, marginBottom: 14,
  outline: "none", boxSizing: "border-box",
};
const cancelBtn = {
  flex: 1, padding: "10px 0", borderRadius: 9, background: "#1e293b",
  color: "#94a3b8", border: "1px solid #334155", fontWeight: 600, fontSize: 16, cursor: "pointer",
};
const genBtn = (dis) => ({
  flex: 2, padding: "10px 0", borderRadius: 9,
  background: dis ? "#1e40af" : "linear-gradient(135deg,#7c3aed,#2563eb)",
  color: "#fff", border: "none", fontWeight: 600, fontSize: 16, cursor: dis ? "not-allowed" : "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
});
const useBtn = {
  flex: 1.5, padding: "10px 0", borderRadius: 9, background: "#166534",
  color: "#fff", border: "none", fontWeight: 600, fontSize: 16, cursor: "pointer",
};
