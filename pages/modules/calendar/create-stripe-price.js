// /pages/modules/calendar/create-stripe-price.js
// UI to create Stripe Price objects for existing services.
// API logic is in /pages/api/calendar/create-stripe-price.js

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const S = {
  page:        { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "0 20px 48px", fontFamily: "system-ui,sans-serif" },
  shell:       { maxWidth: 1320, margin: "0 auto" },
  banner:      { maxWidth: 1320, margin: "16px auto 28px", background: "#84cc16", borderRadius: 16, padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  bannerLeft:  { display: "flex", alignItems: "center", gap: 16 },
  bannerTitle: { fontSize: 48, fontWeight: 600, color: "#fff", margin: 0 },
  bannerSub:   { fontSize: 18, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  backBtn:     { fontSize: 18, fontWeight: 600, background: "rgb(0, 0, 0)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 9, cursor: "pointer" },
  card:        { background: "#161e2b", border: "1px solid #243047", borderRadius: 16, padding: "24px 26px", marginBottom: 14 },
  sectionTitle:{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 18, marginTop: 0 },
  serviceRow:  { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #243047", flexWrap: "wrap", gap: 10 },
  serviceName: { fontSize: 18, fontWeight: 600, color: "#fff" },
  serviceMeta: { fontSize: 16, color: "#9CA3AF", marginTop: 3 },
  stripeId:    { fontSize: 16, color: "#6EE7B7", marginTop: 3, fontFamily: "monospace" },
  createBtn:   { fontSize: 16, fontWeight: 600, padding: "8px 20px", borderRadius: 8, border: "none", background: "#635ec5", color: "#fff", cursor: "pointer" },
  doneBtn:     { fontSize: 16, fontWeight: 600, padding: "8px 20px", borderRadius: 8, border: "1px solid #374151", background: "transparent", color: "#6EE7B7", cursor: "default" },
  loadingTxt:  { fontSize: 16, color: "#6B7280", padding: "40px 0", textAlign: "center" },
  notice:      { background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, padding: "14px 18px", fontSize: 16, color: "#FCD34D", lineHeight: 1.7, marginBottom: 20 },
};

export default function CreateStripePrice() {
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(null); // service id currently being processed

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("services").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setServices(data || []);
    setLoading(false);
  }

  async function createStripePrice(service) {
    setBusy(service.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/calendar/create-stripe-price", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ service_id: service.id }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || "Failed"); return; }
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, stripe_price_id: json.stripe_price_id } : s));
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.banner}>
        <div style={S.bannerLeft}>
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "12px 14px", fontSize: 24 }}>💳</div>
          <div>
            <h1 style={S.bannerTitle}>Stripe Pricing</h1>
            <div style={S.bannerSub}>Create Stripe Price objects for paid booking services</div>
          </div>
        </div>
        <Link href="/modules/calendar/dashboard">
          <button style={S.backBtn}>← Calendar Dashboard</button>
        </Link>
      </div>

      <div style={S.shell}>
        <div style={S.notice}>
          💡 Once a Stripe Price is created for a service, clients will be charged that amount when booking. Services without a price or with $0 are treated as free. You need a Stripe account connected in settings for payments to work.
        </div>

        <div style={S.card}>
          <p style={S.sectionTitle}>🎁 Your Services</p>

          {loading && <div style={S.loadingTxt}>Loading services…</div>}
          {!loading && services.length === 0 && (
            <div style={S.loadingTxt}>
              No services yet.{" "}
              <Link href="/modules/calendar/services" style={{ color: "#84cc16" }}>Create a service →</Link>
            </div>
          )}

          {services.map(service => (
            <div key={service.id} style={S.serviceRow}>
              <div>
                <div style={S.serviceName}>{service.name}</div>
                <div style={S.serviceMeta}>{service.duration_minutes} min · {service.price > 0 ? `$${service.price.toFixed(2)} AUD` : "Free"}</div>
                {service.stripe_price_id && (
                  <div style={S.stripeId}>✓ {service.stripe_price_id}</div>
                )}
              </div>
              {service.stripe_price_id ? (
                <button style={S.doneBtn} disabled>✓ Price created</button>
              ) : service.price > 0 ? (
                <button
                  style={{ ...S.createBtn, opacity: busy === service.id ? 0.6 : 1 }}
                  onClick={() => createStripePrice(service)}
                  disabled={busy === service.id}
                >
                  {busy === service.id ? "Creating…" : "Create Stripe Price"}
                </button>
              ) : (
                <span style={{ fontSize: 16, color: "#6B7280" }}>Set a price first</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

