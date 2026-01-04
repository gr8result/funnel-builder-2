// /pages/modules/affiliates/affiliate-marketplace/approved-offers.js
// ✅ Live page — lists all approved offers for the logged-in affiliate
// ✅ Banner colour updated to c3 (#f59e0b) to match dashboard

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";
import ICONS from "../../../../components/iconMap";
import Link from "next/link";

export default function ApprovedOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadApprovedOffers();
  }, []);

  async function loadApprovedOffers() {
    try {
      setLoading(true);

      // ✅ Get active session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        console.error("Session error:", sessionError);
        setLoading(false);
        return;
      }

      const affiliateId = session.user.id;

      // ✅ Get approved offers for this affiliate
      const { data, error } = await supabase
        .from("affiliate_applications")
        .select(`
          id,
          created_at,
          status,
          product_id,
          products:product_id (
            title,
            category,
            commission,
            thumbnail_url
          )
        `)
        .eq("affiliate_id", affiliateId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOffers(data || []);
    } catch (err) {
      console.error("Error loading approved offers:", err);
    } finally {
      setLoading(false);
    }
  }

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
        {/* 🟧 Banner — updated to c3 (#f59e0b) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f59e0b",
            padding: "16px 22px",
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 18,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>{ICONS.approvals({ size: 32 })}</span>
            <div>
              <div>Approved Offers</div>
              <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 400 }}>
                View your active affiliate offers and commissions.
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
            }}
          >
            ← Back
          </button>
        </div>

        {/* 📋 Table */}
        <div
          style={{
            background: "#111827",
            borderRadius: 12,
            padding: "18px 20px",
          }}
        >
          {loading ? (
            <p style={{ textAlign: "center", opacity: 0.7 }}>
              Loading approved offers...
            </p>
          ) : offers.length === 0 ? (
            <p style={{ textAlign: "center", opacity: 0.7 }}>
              No approved offers yet.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                color: "#fff",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ background: "#1e293b", textAlign: "left" }}>
                  <th style={th}>Thumbnail</th>
                  <th style={th}>Title</th>
                  <th style={th}>Category</th>
                  <th style={th}>Commission</th>
                  <th style={th}>Approved Date</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr
                    key={o.id}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(245,158,11,0.08)", // ✅ soft amber tint
                    }}
                  >
                    <td style={td}>
                      {o.products?.thumbnail_url ? (
                        <img
                          src={o.products.thumbnail_url}
                          alt={o.products.title}
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 8,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.1)",
                          }}
                        />
                      )}
                    </td>
                    <td style={td}>{o.products?.title || "—"}</td>
                    <td style={td}>{o.products?.category || "—"}</td>
                    <td style={td}>
                      {o.products?.commission
                        ? `${o.products.commission}%`
                        : "—"}
                    </td>
                    <td style={td}>
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */
const th = {
  padding: 12,
  fontWeight: 700,
  fontSize: 14,
  color: "#fff",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const td = {
  padding: 12,
  fontSize: 14,
  color: "#fff",
};
