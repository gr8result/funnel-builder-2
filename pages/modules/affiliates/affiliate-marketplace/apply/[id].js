// /pages/modules/affiliates/affiliate-marketplace/apply/[id].js
// ✅ Uses same clipboard icon as dashboard banner — safe and consistent.

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "/utils/supabase-client";
import ICONS from "/components/iconMap";

export default function ApplyPage() {
  const router = useRouter();
  const { id } = router.query;
  const [offer, setOffer] = useState(null);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };

    const getOffer = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) console.error("Error loading offer:", error);
      else setOffer(data);
    };

    getUser();
    getOffer();
  }, [id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");

    if (!user) {
      setStatus("⚠️ You must be logged in to apply.");
      return;
    }

    try {
      const { error } = await supabase.from("affiliate_applications").insert([
        {
          product_id: id,
          affiliate_id: user.id,
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
      setTimeout(
        () => router.push("/modules/affiliates/affiliate-marketplace/offers"),
        2000
      );
    } catch (err) {
      console.error("Submission error:", err.message);
      setStatus("❌ There was a problem submitting your application.");
    }
  };

  const style = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "40px",
      fontFamily:
        "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    },
    inner: { maxWidth: 720, margin: "0 auto" },
    banner: {
      background: "#22c55e",
      borderRadius: 12,
      padding: "16px 22px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 30,
    },
    icon: { fontSize: 28, display: "flex", alignItems: "center" },
    title: { fontSize: 20, fontWeight: 800, margin: 0 },
    subtitle: { fontSize: 14, opacity: 0.9, margin: 0 },
    form: {
      background: "#101820",
      border: "1px solid #22c55e",
      borderRadius: 12,
      padding: "26px 30px",
      display: "flex",
      flexDirection: "column",
      gap: 18,
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 8,
      background: "#1e2630",
      color: "#fff",
      border: "1px solid #333",
      marginTop: 6,
    },
    btn: {
      background: "#22c55e",
      color: "#000",
      fontWeight: 700,
      fontSize: 15,
      padding: "12px 16px",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
    },
    back: {
      display: "inline-block",
      marginTop: 20,
      color: "#22c55e",
      textDecoration: "none",
      fontWeight: 600,
    },
  };

  if (!offer)
    return (
      <div style={style.wrap}>
        <div style={style.inner}>
          <p>Loading offer details...</p>
        </div>
      </div>
    );

  return (
    <div style={style.wrap}>
      <div style={style.inner}>
        {/* 🟢 Banner with same icon as dashboard */}
        <div style={style.banner}>
          <span className="banner-icon">{ICONS.clipboardCheck({ size: 28 })}</span>
          <div>
            <h1 style={style.title}>Apply for {offer.title}</h1>
            <p style={style.subtitle}>
              Fill in your details below to apply for this affiliate program.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={style.form}>
          <label>
            Name:
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              style={style.input}
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
              style={style.input}
            />
          </label>

          <label>
            Message:
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              rows="4"
              required
              style={style.input}
            />
          </label>

          <button type="submit" style={style.btn}>
            Submit Application
          </button>

          {status && (
            <p
              style={{
                color: status.startsWith("✅")
                  ? "#4ade80"
                  : status.startsWith("⚠️")
                  ? "#facc15"
                  : "#f87171",
                fontSize: 14,
              }}
            >
              {status}
            </p>
          )}
        </form>

        <a
          href="/modules/affiliates/affiliate-marketplace/offers"
          style={style.back}
        >
          ← Back to Offers
        </a>
      </div>
    </div>
  );
}
