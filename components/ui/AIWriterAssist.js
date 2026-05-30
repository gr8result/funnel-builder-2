import { useMemo, useState } from "react";

export default function AIWriterAssist({
  value,
  onApply,
  contextLabel = "this field",
  placeholder = "Describe what you want AI to write...",
  compact = false,
}) {
  const [brief, setBrief] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const wrapStyle = useMemo(() => ({
    marginTop: compact ? 8 : 10,
    padding: compact ? "8px" : "10px",
    borderRadius: 10,
    border: "1px solid #2b3650",
    background: "#0f172a",
    display: "grid",
    gap: 8,
  }), [compact]);

  async function run(mode) {
    setLoading(true);
    setError("");
    try {
      const instruction = `${brief || "Improve clarity and conversion while keeping it natural."}`.trim();
      const current = `${value || ""}`.trim();
      const modeRule =
        mode === "new"
          ? "Write fresh copy from scratch."
          : mode === "expand"
            ? "Expand this copy with stronger detail and persuasion."
            : mode === "shorten"
              ? "Shorten this copy while preserving the core message."
              : "Rewrite this copy to be clearer and more persuasive.";

      const prompt = [
        "You are a direct-response marketing copywriter.",
        `Target field: ${contextLabel}`,
        `Task: ${modeRule}`,
        `User instruction: ${instruction}`,
        "Rules:",
        "- Return plain text only",
        "- Do not wrap in quotes",
        "- Keep it platform-safe and professional",
        current ? `Current text: ${current}` : "Current text is empty.",
      ].join("\n");

      const res = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "AI request failed");
      const text = `${json?.text || ""}`.trim();
      if (!text) throw new Error("AI returned empty text");
      setMessages((prev) => [
        ...prev,
        { role: "user", text: `${modeRule} ${instruction}` },
        { role: "assistant", text },
      ]);
      onApply(text);
    } catch (e) {
      setError(e?.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    const userText = `${chatInput || ""}`.trim();
    if (!userText || loading) return;

    const nextMessages = [...messages, { role: "user", text: userText }];
    setMessages(nextMessages);
    setChatInput("");
    setLoading(true);
    setError("");

    try {
      const transcript = nextMessages
        .slice(-10)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n");

      const prompt = [
        "You are a collaborative AI writing assistant helping a user refine marketing copy through conversation.",
        `Target field: ${contextLabel}`,
        "Conversation so far:",
        transcript,
        "Current field value:",
        `${value || "(empty)"}`,
        "Respond with only your next assistant reply as plain text (no markdown).",
      ].join("\n\n");

      const res = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "AI request failed");

      const reply = `${json?.text || ""}`.trim();
      if (!reply) throw new Error("AI returned empty text");
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (e) {
      setError(e?.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  function applyLastAssistantMessage() {
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.text);
    if (!last) return;
    onApply(last.text);
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

  return (
    <div style={wrapStyle}>
      <div style={{ color: "#93c5fd", fontSize: 16, fontWeight: 600 }}>AI Writing Assistant</div>
      <input
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #2b3650",
          background: "#0c121a",
          color: "#e6eef5",
          fontSize: 16,
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={() => run("new")} disabled={loading} style={btnStyle}>
          Write
        </button>
        <button type="button" onClick={() => run("rewrite")} disabled={loading} style={btnStyle}>
          Rewrite
        </button>
        <button type="button" onClick={() => run("expand")} disabled={loading} style={btnStyle}>
          Expand
        </button>
        <button type="button" onClick={() => run("shorten")} disabled={loading} style={btnStyle}>
          Shorten
        </button>
      </div>

      <div style={{ color: "#93c5fd", fontSize: 16, fontWeight: 600, marginTop: 4 }}>Chat With AI</div>
      <div
        style={{
          border: "1px solid #2b3650",
          borderRadius: 8,
          background: "#0c121a",
          padding: 8,
          maxHeight: compact ? 140 : 180,
          overflow: "auto",
          display: "grid",
          gap: 6,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 16 }}>
            Tell AI what you want, then apply its latest response into this field.
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              style={{
                fontSize: 16,
                lineHeight: 1.45,
                color: m.role === "user" ? "#bfdbfe" : "#e2e8f0",
                background: m.role === "user" ? "#13243e" : "#1b1f2a",
                border: "1px solid #2b3650",
                borderRadius: 8,
                padding: "6px 8px",
              }}
            >
              <strong style={{ fontWeight: 600 }}>{m.role === "user" ? "You" : "AI"}:</strong> {m.text}
            </div>
          ))
        )}
      </div>

      <textarea
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        placeholder="Explain what you want in plain language..."
        style={{
          width: "100%",
          minHeight: compact ? 56 : 72,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #2b3650",
          background: "#0c121a",
          color: "#e6eef5",
          fontSize: 16,
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={sendChat} disabled={loading || !chatInput.trim()} style={btnStyle}>
          Send
        </button>
        <button type="button" onClick={applyLastAssistantMessage} disabled={loading} style={btnStyle}>
          Apply Last Reply
        </button>
        <button type="button" onClick={clearChat} disabled={loading || messages.length === 0} style={btnStyle}>
          Clear Chat
        </button>
      </div>

      {loading ? <div style={{ color: "#93c5fd", fontSize: 16 }}>Generating...</div> : null}
      {error ? <div style={{ color: "#fca5a5", fontSize: 16 }}>{error}</div> : null}
    </div>
  );
}

const btnStyle = {
  padding: "12px 20px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg,#3b82f6,#ef465d)",
  color: "#fff",
  fontSize: 18,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(59,130,246,0.18)",
  transition: "background 0.2s, box-shadow 0.2s"
};
