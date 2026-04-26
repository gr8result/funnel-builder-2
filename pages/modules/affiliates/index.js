// /pages/modules/affiliates/vendor/manage-products/index.js
// ✅ Manage Products Dashboard — full version with proper routes + Back button
// ✅ Banner title is NOW explicitly 48px / weight 600 (not relying on inheritance)
// ✅ Banner subtitle 18px
// ✅ Back button 18px
// ✅ Min font size across page is 16px
// ✅ Uses iconMap the same way as the rest of your app (ICONS.xxx({ size, color })) — no component-style icons

import Link from "next/link";
import { useRouter } from "next/router";
import ICONS from "../../../components/iconMap";
import VendorUserBanner from "../../../components/vendor/VendorUserBanner";

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
      fontSize: 48, // ✅ min font size baseline
      fontWeight: 600,
    },
    inner: { width: "100%", maxWidth: 1320 },


icon: ICONS.affiliates,


    banner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#06a9db",
      padding: "18px 22px",
      borderRadius: 14,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      fontWeight: 600,
      marginBottom: 26,
      gap: 14,
    },
    leftBanner: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      minWidth: 0,
    },
    bannerIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 12,
      background: "rgba(0,0,0,0.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      flexShrink: 0,
    },
    bannerTitle: {
      fontSize: 48, // ✅ explicitly set
      fontWeight: 600,
      lineHeight: 1.1,
      margin: 0,
    },
    bannerSubtitle: {
      fontSize: 18,
      opacity: 0.9,
      fontWeight: 600,
      marginTop: 6,
      lineHeight: 1.25,
    },

    backBtn: {
      background: "#0c121a",
      color: "#fff",
      border: "2px solid rgba(255,255,255,0.25)",
      borderRadius: 8,
      padding: "10px 18px",
      fontWeight: 600,
      fontSize: 18, // ✅ requested
      cursor: "pointer",
      transition: "all 0.2s ease",
      whiteSpace: "nowrap",
    },

    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 2fr)",
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
      color: "#fff",
      textDecoration: "none",
      minHeight: 88,
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
    cardTitle: { fontWeight: 600, fontSize: 28, color: "#6456f7" },
    cardDesc: { opacity: 0.85, fontSize: 16, marginTop: 4, fontWeight: 600 },
  };

  const cards = [
     {
    title: "Affiliate Dashboard",
    desc: "View your affiliate analytics, commissions, sales, and payouts.",
    href: "/modules/affiliates/affiliate-marketplace/affiliate_analytics",
    color: "#ec4899",
    icon: ICONS.analytics({ size: 36, color: "#fff" }),
  },
   
  {
      title: "Our Affiliate Applications",
      desc: "Review our applications for Affiliate programs.",
       href: "/modules/affiliates/affiliate-marketplace/affiliate_applications",
      color: "#43f916",
      icon: ICONS.products({ size: 36, color: "#fff" }),
    },

  ];

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* ✅ Banner */}
        <div style={page.banner}>
          <div style={page.leftBanner}>
            <div style={page.bannerIconWrap}>
              {ICONS.affiliates({ size: 48, color: "#fff" })}
              


            </div>

            <div style={{ minWidth: 0 }}>
              <div style={page.bannerTitle}>Affiliate Dashboard - Manage Products</div>
              <div style={page.bannerSubtitle}>
                Manage your listings and affiliate approvals.
              </div>
            </div>
          </div>

        {/* 🔙 Back Button */}
        <button
          onClick={async () => {
            // Check if user is logged into the platform (Supabase)
            const { data: { user } } = await import("../../../lib/supabaseClient").then(m => m.supabase.auth.getUser());
            if (user) {
              router.push("/dashboard");
            } else {
              router.push("/marketplace");
            }
          }}
          style={page.backBtn}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#111827";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#0c121a";
          }}
        >
          ← Back
        </button>

        </div>

        {/* 🟩 Cards */}
  <VendorUserBanner />

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
              <div style={{ ...page.iconBox }}>{card.icon}</div>
              <div>
                <div style={page.cardTitle}>{card.title}</div>
                <div style={page.cardDesc}>{card.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
