// /pages/modules/email/thumbnail.js
// FULL REPLACEMENT
// ✅ Removes missing dependency: chrome-aws-lambda
// (We can re-add real thumbnail generation later via a serverless function.)

import Link from "next/link";

export default function EmailThumbnail() {
  return (
    <div style={{ background: "#0c121a", minHeight: "100vh", color: "#fff" }}>
      <div
        style={{
          width: "1320px",
          maxWidth: "100%",
          margin: "24px auto 16px",
          background: "#f59e0b",
          color: "#111",
          padding: "18px 22px",
          borderRadius: "16px",
          fontWeight: 800,
          fontSize: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 44 }}>🖼️</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span>Email thumbnails</span>
            <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.9 }}>
              Thumbnail generation is disabled in this build.
            </span>
          </div>
        </div>

        <Link
          href="/modules/email"
          style={{
            background: "#111",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 8,
            padding: "6px 14px",
            textDecoration: "none",
            border: "1px solid #000",
          }}
        >
          ← Back
        </Link>
      </div>

      <div style={{ width: "1320px", maxWidth: "100%", margin: "0 auto" }}>
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>
            Status
          </div>
          <div style={{ fontSize: 14, opacity: 0.85 }}>
            This page previously imported <code>chrome-aws-lambda</code> which
            breaks builds unless we add heavy serverless dependencies.
            <br />
            We’ll implement proper thumbnails later (API route or edge function).
          </div>
        </div>
      </div>
    </div>
  );
}
