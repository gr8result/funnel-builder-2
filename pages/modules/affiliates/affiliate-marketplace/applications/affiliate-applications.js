// /pages/modules/affiliates/affiliate-marketplace/applications/affiliate-applications.js
// FULL REPLACEMENT — banner matches main dashboard + working clipboard icon

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";

export default function AffiliateApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      const { data, error } = await supabase
        .from("affiliate_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) console.error("Error loading applications:", error);
      else setApplications(data || []);
      setLoading(false);
    };
    fetchApplications();
  }, []);

  // Same blue as Applications & Offers card
  const themeColor = "#0ea5e9";

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
    card: {
      background: "#111827",
      borderRadius: 12,
      padding: 18,
      boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
      marginBottom: 12,
    },
  };

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* ===== BANNER ===== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            background: "#f59e0b",
            padding: "26px 30px",
            borderRadius: 14,
            marginBottom: 30,
          }}
        >
          {/* Icon box */}
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              background: "rgba(0,0,0,0.25)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <ClipboardIcon size={34} color="#fff" />
          </div>

          {/* Text block */}
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 900,
                margin: 0,
              }}
            >
              Affiliate Applications
            </h1>
            <p
              style={{
                fontSize: 17,
                opacity: 0.95,
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Review and approve affiliate program requests.
            </p>
          </div>

          {/* Back button */}
          <Link href="/modules/affiliates/affiliate-marketplace">
            <button
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "2px solid rgba(255,255,255,0.4)",
                borderRadius: 12,
                padding: "10px 18px",
                fontSize: 15,
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ← Back
            </button>
          </Link>
        </div>

        {/* ===== APPLICATION LIST ===== */}
        {loading ? (
          <p>Loading...</p>
        ) : applications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              opacity: 0.7,
              fontSize: 16,
            }}
          >
            No applications found.
          </div>
        ) : (
          applications.map((app) => (
            <div key={app.id} style={page.card}>
              <p>
                <b>Product:</b> {app.product_id}
              </p>
              <p>
                <b>Status:</b> {app.status}
              </p>
              <p>
                <b>Date:</b>{" "}
                {new Date(app.created_at).toLocaleDateString("en-AU")}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ===== Local clipboard icon (same as dashboard) ===== */
function ClipboardIcon({ size = 24, color = "#fff" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  return (
    <svg {...common}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M4 6h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  );
}
