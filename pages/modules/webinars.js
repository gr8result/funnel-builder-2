// /pages/modules/webinars.js
// Webinars module placeholder with matching banner + icon + Back button + Coming Soon

import Head from "next/head";
import Link from "next/link";
import ICONS from "../../components/iconMap";

export default function Webinars() {
  return (
    <>
      <Head>
        <title>Webinars | GR8 RESULT</title>
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: "#0c121a",
          color: "#fff",
          padding: "28px 22px",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1320, margin: "0 auto" }}>
          {/* 🔥 Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#ef4444",
              padding: "18px 22px",
              borderRadius: 14,
              fontWeight: 600,
              marginBottom: 26,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {ICONS.webinars({ size: 48 })}
              </div>

              <div>
                <div style={{ fontSize: 48, marginBottom: 2 }}>Webinars</div>
                <div style={{ fontSize: 18, opacity: 0.9 }}>
                  Live events, replays & webinar automations.
                </div>
              </div>
            </div>

            {/* Back button */}
            <Link href="/dashboard">
              <button
                style={{
                  background: "#0c121a",
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,0.25)",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 18,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#111827")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#0c121a")}
              >
                ← Back
              </button>
            </Link>
          </div>

          {/* Panel */}
          <div
            style={{
              background: "#111827",
              borderRadius: 12,
              padding: 22,
              border: "1px solid #ef4444",
            }}
          >


           {/* Coming Soon */}
          <div
            style={{
              background: "#111827",
              border: "1px dashed #06b6d4",
              borderRadius: 12,
              padding: 24,
              fontSize: 24,
              textAlign: "center",
              opacity: 0.85,
            }}
          >
            🚧 <strong>Coming Soon</strong> 🚧 <br/> 
            Expected Delivery date: Q4 2026 <br/><br/>  
            📌 Webinar hosting, replay libraries & scheduling will be added here soon.
          </div>

            

          </div>
        </div>
      </div>
    </>
  );
}
