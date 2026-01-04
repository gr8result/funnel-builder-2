// /pages/modules/affiliates/affiliate-marketplace/offers/apply.js
// Fixed: sends affiliate_id + user_id + all form fields

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";

export default function ApplyAffiliate() {
  const router = useRouter();
  const { id } = router.query; // product_id
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };
    getUser();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");

    if (!user) {
      setStatus("You must be logged in to apply.");
      return;
    }

    try {
      const { error } = await supabase.from("affiliate_applications").insert([
        {
          product_id: id,
          affiliate_id: user.id, // ✅ required for Supabase schema
          user_id: user.id,
          name: form.name,
          email: form.email,
          message: form.message,
          status: "pending",
          created_at: new Date(),
        },
      ]);

      if (error) throw error;

      setStatus("✅ Application submitted successfully!");
      setTimeout(() => router.push("/modules/affiliates/affiliate-marketplace"), 2000);
    } catch (err) {
      console.error("Submission error:", err.message);
      setStatus("❌ There was a problem submitting your application. Check console for details.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c121a",
        color: "#fff",
        padding: "40px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          style={{
            background: "#f97316",
            borderRadius: 12,
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 34 }}>{ICONS.affiliates}</span>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Apply to Affiliate Program</h1>
            <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>Fill in your details below to apply.</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: "#101820",
            border: "1px solid #f97316",
            borderRadius: 12,
            padding: "26px 30px",
            marginTop: 30,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <label>
            Name:
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                background: "#1e2630",
                color: "#fff",
                border: "1px solid #333",
                marginTop: 6,
              }}
            />
          </label>

          <label>
            Email:
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                background: "#1e2630",
                color: "#fff",
                border: "1px solid #333",
                marginTop: 6,
              }}
            />
          </label>

          <label>
            Message:
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              rows="4"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                background: "#1e2630",
                color: "#fff",
                border: "1px solid #333",
                marginTop: 6,
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              background: "#f97316",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              padding: "12px 16px",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Submit Application
          </button>

          {status && (
            <p style={{ color: status.startsWith("✅") ? "#4ade80" : "#f87171", fontSize: 14 }}>{status}</p>
          )}
        </form>
      </div>
    </div>
  );
}
