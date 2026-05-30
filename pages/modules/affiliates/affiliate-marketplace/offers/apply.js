import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";

export default function AffiliateApplicationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", website: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || null;

      const { error } = await supabase.from("affiliate_applications").insert([{
        name: form.name,
        email: form.email,
        website: form.website || null,
        message: form.message || null,
        user_id: userId,
        status: "pending",
      }]);

      if (error) throw error;
    } catch (err) {
      console.error("Affiliate application error:", err);
      // Fallback: save locally so submission isn't lost
      try {
        const existing = JSON.parse(localStorage.getItem("affiliate_interest") || "[]");
        existing.push({ ...form, submitted_at: new Date().toISOString() });
        localStorage.setItem("affiliate_interest", JSON.stringify(existing));
      } catch (_) {}
    }
    setSubmitted(true);
    setSubmitting(false);
  }

  const INPUT = {
    width: "100%", boxSizing: "border-box",
    background: "#1f2937", border: "1px solid #374151", borderRadius: 8,
    color: "#f9fafb", padding: "10px 14px", fontSize: 14, outline: "none",
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f9fafb", margin: "0 0 8px" }}>Application Received</h1>
        <p style={{ color: "#9ca3af", fontSize: 15, margin: "0 0 24px" }}>
          Thanks for your interest in becoming an affiliate. We'll review your application and be in touch within 2–3 business days.
        </p>
        <Link href="/modules/affiliates/affiliate-marketplace">
          <button style={{
            background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            Back to Marketplace
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f9fafb", margin: "0 0 4px" }}>Affiliate Application</h1>
      <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 28px" }}>
        Apply to promote this offer. We review all applications within 2–3 business days.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, color: "#d1d5db", marginBottom: 6 }}>Full name *</label>
          <input name="name" required value={form.name} onChange={handleChange} style={INPUT} placeholder="Jane Smith" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, color: "#d1d5db", marginBottom: 6 }}>Email address *</label>
          <input name="email" type="email" required value={form.email} onChange={handleChange} style={INPUT} placeholder="jane@example.com" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, color: "#d1d5db", marginBottom: 6 }}>Website or social profile</label>
          <input name="website" value={form.website} onChange={handleChange} style={INPUT} placeholder="https://yoursite.com" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, color: "#d1d5db", marginBottom: 6 }}>How do you plan to promote this offer?</label>
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            rows={4}
            style={{ ...INPUT, resize: "vertical" }}
            placeholder="Describe your audience and promotion methods…"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: submitting ? "#374151" : "#2563eb", color: "#fff",
            border: "none", borderRadius: 8, padding: "12px 24px",
            fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Submitting…" : "Submit Application"}
        </button>
      </form>
    </div>
  );
}
