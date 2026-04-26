import { useState } from "react";

const QUESTIONS = [
  { key: "businessName", label: "What is your business name?" },
  { key: "industry", label: "What industry are you in?" },
  { key: "offer", label: "What is your main offer or product?" },
  { key: "audience", label: "Who is your target audience?" },
  { key: "goal", label: "What is your main goal for this funnel/website? (e.g., leads, sales, bookings)" },
  { key: "style", label: "What style or vibe do you want? (e.g., modern, friendly, bold)" },
];

export default function FunnelAIWizard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setAnswers({ ...answers, [QUESTIONS[step].key]: e.target.value });
  };

  const handleNext = () => {
    if (!answers[QUESTIONS[step].key]) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const json = await res.json();
      if (!json.ok || !json.funnelId) throw new Error(json.error || "AI generation failed");
      window.location.href = `/modules/funnels/edit/${json.funnelId}`;
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (step >= QUESTIONS.length) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", padding: 32, background: "#fff", borderRadius: 12 }}>
        <h2>Generating your funnel...</h2>
        <button disabled={submitting} onClick={handleSubmit} style={{ marginTop: 24, fontSize: 18, padding: "12px 32px" }}>
          {submitting ? "Generating..." : "Generate Funnel"}
        </button>
        {error && <div style={{ color: "#b91c1c", marginTop: 16 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: 32, background: "#fff", borderRadius: 12 }}>
      <h2>AI Funnel/Site Wizard</h2>
      <div style={{ margin: "32px 0" }}>
        <label style={{ fontSize: 20 }}>{QUESTIONS[step].label}</label>
        <input
          type="text"
          value={answers[QUESTIONS[step].key] || ""}
          onChange={handleChange}
          style={{ width: "100%", fontSize: 18, marginTop: 12, padding: 10, borderRadius: 6, border: "1px solid #d1d5db" }}
          autoFocus
        />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {step > 0 && <button onClick={handleBack}>Back</button>}
        <button onClick={handleNext} disabled={!answers[QUESTIONS[step].key]}>Next</button>
      </div>
    </div>
  );
}
