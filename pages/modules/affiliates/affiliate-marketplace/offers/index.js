// /pages/modules/affiliates/affiliate-marketplace/offers/index.js
// Uses products table fields: title, description, sale_price, commission,
// revenue_per_sale, affiliate_link, thumbnail_url

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";
import { Search } from "lucide-react";

export default function BrowseOffers() {
  const [offers, setOffers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase.from("products").select("*");

      if (error) {
        console.error("Error fetching offers:", error);
      } else {
        setOffers(data || []);
      }
      setLoading(false);
    };

    fetchOffers();
  }, []);

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
    inner: {
      width: "100%",
      maxWidth: 1320,
    },
    banner: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#22c55e", // ✅ match green dashboard tone
      borderRadius: 14,
      padding: "18px 24px", // ✅ taller / wider like main banner
      fontWeight: 700,
      marginBottom: 28,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: 24,
    },
    card: {
      background: "#111827",
      borderRadius: "18px 18px 10px 10px",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
    },
    thumb: {
      width: "100%",
      height: 160,
      objectFit: "cover",
      background: "#1e293b",
    },
    content: {
      padding: "16px 18px",
      flexGrow: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: 700,
      marginBottom: 8,
      color: "#fff",
    },
    desc: {
      fontSize: 14,
      opacity: 0.85,
      lineHeight: 1.5,
      marginBottom: 12,
      overflow: "hidden",
    },
    metrics: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: 13,
      borderTop: "1px solid rgba(255,255,255,0.1)",
      padding: "10px 18px",
      background: "#0f172a",
      opacity: 0.9,
      flexWrap: "wrap",
      gap: 8,
    },
    buttons: {
      display: "flex",
      justifyContent: "space-between",
      padding: "10px 18px",
      background: "#0f172a",
      borderTop: "1px solid rgba(255,255,255,0.1)",
    },
    btn: {
      background: "#00bcd4",
      border: "none",
      borderRadius: 8,
      padding: "6px 12px",
      fontSize: 13,
      cursor: "pointer",
      color: "#fff",
      fontWeight: 600,
      transition: "0.2s ease",
    },
  };

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
        <div style={page.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Search size={32} />
            <div>
              <h1
                style={{
                  fontSize: 24, // ✅ larger heading
                  fontWeight: 900,
                  margin: 0,
                }}
              >
                Browse Offers
              </h1>
              <p
                style={{
                  fontSize: 15, // ✅ slightly larger subtext
                  opacity: 0.95,
                  margin: 0,
                }}
              >
                Explore affiliate programs and start earning commissions.
              </p>
            </div>
          </div>
          <Link href="/modules/affiliates/affiliate-marketplace">
            <button
              style={{
                background: "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ← Back
            </button>
          </Link>
        </div>

        {/* Offers Grid */}
        {loading ? (
          <p>Loading offers...</p>
        ) : offers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              opacity: 0.7,
              fontSize: 16,
            }}
          >
            No active offers found.
          </div>
        ) : (
          <div style={page.grid}>
            {offers.map((offer) => {
              const isExpanded = expanded[offer.id];

              const fullDescription = offer.description || "";
              const shortText =
                fullDescription.length > 280 && !isExpanded
                  ? fullDescription.slice(0, 280) + "..."
                  : fullDescription;

              // ✅ Use correct columns from products table
              const title = offer.title || "Untitled product";
              const commissionPercent = offer.commission || 0; // % from DB
              const price = Number(offer.sale_price || 0); // sale_price from DB
              const revenuePerSale =
                offer.revenue_per_sale != null
                  ? Number(offer.revenue_per_sale)
                  : Number(((price * commissionPercent) / 100).toFixed(2));
              const gravity = offer.gravity || 0; // if you add a gravity column later

              const affiliatePageUrl =
                offer.affiliate_link || offer.affiliate_url || "#";

              const salesPageUrl =
                offer.sales_url ||
                offer.sales_page_url ||
                offer.affiliate_link ||
                "#";

              return (
                <div
                  key={offer.id}
                  style={page.card}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "translateY(-4px)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "translateY(0px)")
                  }
                >
                  {/* Thumbnail */}
                  <img
                    src={
                      offer.thumbnail_url && offer.thumbnail_url !== ""
                        ? offer.thumbnail_url
                        : "/placeholder.jpg"
                    }
                    alt={title}
                    style={page.thumb}
                  />

                  {/* Text content */}
                  <div style={page.content}>
                    <div style={page.title}>{title}</div>
                    <div style={page.desc}>
                      {shortText}
                      {fullDescription.length > 280 && (
                        <span
                          onClick={() => toggleExpand(offer.id)}
                          style={{
                            color: "#22c55e",
                            cursor: "pointer",
                            marginLeft: 6,
                            fontWeight: 600,
                          }}
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metrics Section */}
                  <div style={page.metrics}>
                    <div>💰 {commissionPercent}% Commission</div>
                    <div>📦 ${price.toFixed(2)} Product</div>
                    <div>💵 ${revenuePerSale.toFixed(2)} / Sale</div>
                    <div>🔥 Gravity: {gravity}</div>
                  </div>

                  {/* Buttons Section */}
                  <div style={page.buttons}>
                    <button
                      style={{
                        ...page.btn,
                        background: "#1e40af",
                      }}
                      onClick={() => window.open(affiliatePageUrl, "_blank")}
                    >
                      Affiliate Page
                    </button>
                    <button
                      style={{
                        ...page.btn,
                        background: "#9333ea",
                      }}
                      onClick={() => window.open(salesPageUrl, "_blank")}
                    >
                      Sales Page
                    </button>
                    <Link
                      href={`/modules/affiliates/affiliate-marketplace/applications/apply?product_id=${offer.id}`}
                    >
                      <button
                        style={{
                          ...page.btn,
                          background: "#22c55e",
                        }}
                      >
                        Apply
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
