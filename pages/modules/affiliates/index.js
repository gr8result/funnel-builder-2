// /pages/modules/affiliates/vendor/manage-products/index.js
// ✅ Manage Products Dashboard — full version with proper routes + Back button

import Link from "next/link";
import { useRouter } from "next/router";
import ICONS from "../../../components/iconMap";

export default function ManageProducts() {
  const router = useRouter();

  const page = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      fontFamily:
        "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      display: "flex",
      justifyContent: "center",
    },
    inner: { width: "100%", maxWidth: 1320 },
    banner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#10b981",
      padding: "14px 18px",
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 18,
      marginBottom: 26,
    },
    leftBanner: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 18,
    },
    card: {
      border: "2px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: "18px 20px",
      background: "#111827",
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      gap: 14,
      cursor: "pointer",
    },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: "rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    title: { fontWeight: 700, fontSize: 15 },
    desc: { opacity: 0.8, fontSize: 13, marginTop: 4 },
  };

  const cards = [
    {
      title: "My Products",
      desc: "View, edit, upload, or remove your product listings.",
      href: "/modules/affiliates/vendor/manage-products/my-products",
      color: "#10b981",
      icon: <ICONS.products size={24} />,
    },
    {
      title: "Affiliate Applications",
      desc: "Review and approve affiliate partnership requests.",
      href: "/modules/affiliates/vendor/affiliate-applications",
      color: "#f59e0b",
      icon: <ICONS.approvals size={24} />,
    },
    {
      title: "Performance Reports",
      desc: "Track sales, revenue, and affiliate performance.",
      href: "/modules/affiliates/vendor/performance-reports",
      color: "#06b6d4",
      icon: <ICONS.analytics size={24} />,
    },
  ];

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* ✅ Banner */}
        <div style={page.banner}>
          <div style={page.leftBanner}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <ICONS.products size={28} />
            </div>
            <div>
              <div>Manage Products</div>
              <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 400 }}>
                Manage your listings and affiliate approvals.
              </div>
            </div>
          </div>

          {/* 🔙 Back Button */}
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
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#111827")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#0c121a")}
          >
            ← Back
          </button>
        </div>

        {/* 🟩 Cards */}
        <div style={page.grid}>
          {cards.map((card, i) => (
            <Link
              key={i}
              href={card.href}
              style={{
                ...page.card,
                borderColor: card.color,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = card.color;
                e.currentTarget.style.borderColor = card.color;
                e.currentTarget.style.color = "#000";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#111827";
                e.currentTarget.style.borderColor = card.color;
                e.currentTarget.style.color = "#fff";
              }}
            >
              <div style={{ ...page.iconBox, color: card.color }}>
                {card.icon}
              </div>
              <div>
                <div style={page.title}>{card.title}</div>
                <div style={page.desc}>{card.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
