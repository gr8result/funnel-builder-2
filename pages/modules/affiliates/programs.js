// /modules/affiliates/affiliate-marketplace/programs.js
// Navigation fixed to use relative links only.

import Link from "next/link";
import ICONS from "../../../components/iconMap";

export default function Programs() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c121a",
        color: "#fff",
        padding: "28px 22px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1320 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#10b981",
            padding: "14px 18px",
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 18,
            marginBottom: 26,
          }}
        >
          <span className="banner-icon">{ICONS.products({ size: 24 })}</span>
          <div>
            <div>Affiliate Programs</div>
            <div
              style={{ fontSize: 14, opacity: 0.9, fontWeight: 400 }}
            >
              Explore or manage available programs.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 18,
          }}
        >
          <Link href="./index" style={{ color: "#10b981", fontWeight: 600 }}>
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
