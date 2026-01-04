// /pages/modules/social-media.js
import Head from "next/head";
import { useRouter } from "next/router";
import ICONS from "../../components/iconMap";

export default function SocialMedia() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Social Media Posting | GR8 RESULT</title>
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
          {/* Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#06b6d4",
              padding: "16px 20px",
              borderRadius: 14,
              marginBottom: 26,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {ICONS.social({ size: 30 })}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  Social Media Posting
                </div>
                <div style={{ fontSize: 15, opacity: 0.9, fontWeight: 400 }}>
                  Schedule, publish, and manage content across platforms.
                </div>
              </div>
            </div>

            {/* BACK BUTTON */}
            <button
              onClick={() => router.back()}
              style={{
                background: "#0c121a",
                color: "#fff",
                border: "2px solid rgba(255,255,255,0.25)",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all .2s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#111827")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#0c121a")}
            >
              ← Back
            </button>
          </div>

          {/* Coming Soon */}
          <div
            style={{
              background: "#111827",
              border: "1px dashed #06b6d4",
              borderRadius: 12,
              padding: 24,
              fontSize: 18,
              textAlign: "center",
              opacity: 0.85,
            }}
          >
            🚧 <strong>Coming Soon</strong> — Instagram, TikTok, Facebook,
            Twitter/X posting automation and AI caption scheduling.
          </div>
        </div>
      </div>
    </>
  );
}
