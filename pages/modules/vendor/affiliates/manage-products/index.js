// /pages/modules/vendor/affiliates/manage-products/index.js  

import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";
import VendorUserBanner from "../../../../../components/vendor/VendorUserBanner";

export default function ManageProducts() {
  const [hovered, setHovered] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const goMarketplace = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = "/modules/vendor";
  };

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get only this vendor's product IDs first
        const { data: myProducts } = await supabase
          .from("affiliate_products")
          .select("id")
          .eq("owner_user_id", user.id);

        const myProductIds = (myProducts || []).map((p) => p.id);
        if (myProductIds.length === 0) {
          setPendingCount(0);
          return;
        }

        // Count pending applications only for this vendor's products
        const { count, error } = await supabase
          .from("affiliate_product_applications")
          .select("*", { count: "exact", head: true })
          .in("product_id", myProductIds)
          .neq("status", "approved");

        setPendingCount(error ? 0 : count || 0);
      } catch (err) {
        console.error("Pending fetch failed:", err);
        setPendingCount(0);
      }
    };

    fetchPending();
  }, []);

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
      fontSize: 16,
      fontWeight: 600,
    },
    inner: { width: "100%", maxWidth: 1320 },

    banner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#10b981",
      padding: "18px 22px",
      borderRadius: 14,
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
      flexShrink: 0,
    },
    bannerTitle: {
      fontSize: 48,
      fontWeight: 600,
      lineHeight: 1.1,
      margin: 0,
    },
    bannerSubtitle: {
      fontSize: 18,
      fontWeight: 600,
      marginTop: 6,
      opacity: 0.9,
    },

    backBtn: {
      background: "#0c121a",
      color: "#fff",
      border: "2px solid rgba(255,255,255,0.25)",
      borderRadius: 8,
      padding: "10px 18px",
      fontSize: 18,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap",
      zIndex: 1000,
    },

    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 18,
    },

    card: {
      border: "2px solid",
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      cursor: "pointer",
      textDecoration: "none",
      minHeight: 88,
      transition: "all 0.25s ease",
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

    cardTitle: {
      fontWeight: 600,
      fontSize: 28,
    },

    cardDesc: {
      fontSize: 16,
      marginTop: 4,
      fontWeight: 600,
      opacity: 0.85,
    },

    badgeWrap: {
      marginLeft: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 4,
    },

    badge: {
      background: "#ef4444",
      color: "#fff",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 16,
      fontWeight: 600,
      minWidth: 32,
      textAlign: "center",
    },

    badgeText: {
      fontSize: 16,
      opacity: 0.9,
    },
  };

  const cards = [
    {
      title: "Our Products",
      desc: "View, edit, upload, or remove your product listings.",
      href: "/modules/vendor/affiliates/manage-products/my-products",
      color: "#10b981",
      icon: ICONS.products({ size: 28, color: "#fff" }),
    },
    {
      title: "Affiliate Applications",
      desc: "Review and approve Affiliate Partnership requests.",
      href: "/modules/vendor/affiliates/manage-products/vendor-applications",
      color: "#f59e0b",
      icon: ICONS.approvals({ size: 28, color: "#fff" }),
    },
    {
      title: "Active Affiliates",
      desc: "Review active Affiliate Partnerships.",
      href: "/modules/vendor/affiliates/active_affiliates",
      color: "#8f10d8",
      icon: ICONS.affiliates
        ? ICONS.affiliates({ size: 28, color: "#fff" })
        : <span style={{ fontSize: 28 }}>🤝</span>,
    },
  ];

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        <div style={page.banner}>
          <div style={page.leftBanner}>
            <div style={page.bannerIconWrap}>
              {ICONS.products({ size: 48, color: "#fff" })}
            </div>
            <div>
              <div style={page.bannerTitle}>Vendor's Dashboard - Manage Products</div>
              <div style={page.bannerSubtitle}>
                Manage your listings and affiliate approvals.
              </div>
            </div>
          </div>

          <button type="button" style={page.backBtn} onClick={goMarketplace}>
            ← Back
          </button>
        </div>

        <VendorUserBanner />

        <div style={page.grid}>
          {cards.map((card, i) => {
            const isHover = hovered === i;

            return (
              <Link
                key={i}
                href={card.href}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  ...page.card,
                  borderColor: card.color,
                  background: isHover ? card.color : "#111827",
                }}
              >
                <div style={page.iconBox}>{card.icon}</div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      ...page.cardTitle,
                      color: isHover ? "#fff" : "#6456f7",
                    }}
                  >
                    {card.title}
                  </div>

                  <div
                    style={{
                      ...page.cardDesc,
                      color: "#fff",
                      opacity: isHover ? 1 : 0.85,
                    }}
                  >
                    {card.desc}
                  </div>
                </div>

                {card.title === "Affiliate Applications" && pendingCount > 0 && (
                  <div style={page.badgeWrap}>
                    <div style={page.badge}>{pendingCount}</div>
                    <div style={page.badgeText}>Awaiting approval</div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}