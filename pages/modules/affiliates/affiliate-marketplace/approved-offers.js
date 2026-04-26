import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../lib/supabaseClient";
import ICONS from "../../../../components/iconMap";
import Link from "next/link";

export default function ApprovedOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, name: "", description: "" });
  const router = useRouter();

  useEffect(() => {
    loadApprovedOffers();
  }, []);

  async function loadApprovedOffers() {
    try {
      setLoading(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setLoading(false);
        return;
      }

      const affiliateId = session.user.id;

      const { data, error } = await supabase
        .from("affiliate_applications")
        .select(`
          id,
          created_at,
          affiliate_link,
          product_id,
          affiliate_products:product_id (
            title,
            description,
            category,
            commission_value,
            sale_price,
            revenue_per_sale,
            image_url
          )
        `)
        .eq("affiliate_user_id", affiliateId)
        // .eq("status", "approved") // status column does not exist
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (err) {
      console.error(err);
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
        padding: "18px 22px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1320 }}>
        {/* Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f59e0b",
            padding: "26px 30px",
            borderRadius: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span>{ICONS.approvals({ size: 48 })}</span>
            <div>
              <div style={{ fontSize: 48, fontWeight: 550 }}>
                Approved Offers
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  opacity: 0.95,
                  marginTop: 4,
                }}
              >
                View your active affiliate offers and commissions.
              </div>
            </div>
          </div>

          <button
            onClick={() => router.back()}
            style={{
              background: "#0c121a",
              color: "#fff",
              border: "2px solid rgba(255,255,255,0.25)",
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        </div>

        {/* Modal for view product */}
        {modal.open && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(20,20,20,0.79)",
            zIndex: 201,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
            onClick={() => setModal({ open: false })}>
            <div style={{
              background: "#202335",
              padding: 30,
              borderRadius: 18,
              minWidth: 320,
              minHeight: 120,
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              position: "relative",
              maxWidth: 480
            }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, fontSize: 28 }}>{modal.name}</h2>
              <div style={{ fontSize: 18, opacity: 0.92, marginTop: 12 }}>
                {modal.description || <span style={{ opacity: 0.6 }}>No description provided.</span>}
              </div>
              <button
                onClick={() => setModal({ open: false })}
                style={{
                  padding: "7px 22px",
                  background: "#444cdf",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 17,
                  cursor: "pointer",
                  position: "absolute",
                  right: 24,
                  bottom: 16,
                }}
              >Close</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div
          style={{
            background: "#111827",
            borderRadius: 16,
            padding: "26px 20px",
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
                fontSize: 16,
              }}
            >
              <thead>
                <tr style={{ background: "#1e293b", textAlign: "left" }}>
                  <th style={th}>Thumbnail</th>
                  <th style={th}>Title</th>
                  <th style={th}>Category</th>
                  <th style={th}>Commission</th>
                  <th style={th}>Price</th>
                  <th style={th}>Revenue/Sale</th>
                  <th style={th}>Affiliate Link</th>
                  <th style={th}>Approved Date</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr
                    key={o.id}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(245,158,11,0.08)",
                      height: 110, // Thicker row!
                    }}
                  >
                    <td style={td}>
                      {o.affiliate_products?.image_url ? (
                        <img
                          src={o.affiliate_products.image_url}
                          alt={o.affiliate_products.title}
                          style={{
                            width: 75,
                            height: 75,
                            borderRadius: 10,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 75,
                            height: 75,
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.08)",
                          }}
                        />
                      )}
                    </td>
                    <td style={td}>{o.affiliate_products?.title || "—"}</td>
                    <td style={td}>{o.affiliate_products?.category || "—"}</td>
                    <td style={td}>
                      {o.affiliate_products?.commission_value
                        ? `${o.affiliate_products.commission_value}%`
                        : "—"}
                    </td>
                    <td style={td}>
                      {o.affiliate_products?.sale_price
                        ? `$${Number(o.affiliate_products.sale_price).toFixed(2)}`
                        : "—"}
                    </td>
                    <td style={td}>
                      {o.affiliate_products?.revenue_per_sale
                        ? `$${Number(o.affiliate_products.revenue_per_sale).toFixed(2)}`
                        : "—"}
                    </td>
                    <td style={td}>
                      {o.affiliate_link ? (
                        <>
                          <input
                            value={o.affiliate_link}
                            readOnly
                            style={{
                              width: "95%",
                              padding: "3px 8px",
                              borderRadius: 7,
                              border: "1px solid #333",
                              background: "#181d36",
                              color: "#fff",
                              fontSize: 15,
                            }}
                          />
                          <button
                            style={{
                              marginLeft: 4,
                              padding: "4px 10px",
                              borderRadius: 7,
                              background: "#0ea5e9",
                              color: "#fff",
                              border: "none",
                              cursor: "pointer"
                            }}
                            onClick={() => navigator.clipboard.writeText(o.affiliate_link)}
                          >
                            Copy
                          </button>
                        </>
                      ) : "—"}
                    </td>
                    <td style={td}>
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td style={td}>
                      <button
                        style={{
                          background: "#00CCBB",
                          color: "#222",
                          fontWeight: 700,
                          padding: "10px 25px",
                          fontSize: 16,
                          border: "none",
                          borderRadius: 9,
                          cursor: "pointer",
                          boxShadow: "0 1px 5px rgba(0,0,0,0.10)"
                        }}
                        onClick={() => setModal({
                          open: true,
                          name: o.affiliate_products?.title || "No name",
                          description: o.affiliate_products?.description || ""
                        })}
                        type="button"
                      >
                        View Product
                      </button>
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

const th = {
  padding: 15,
  fontWeight: 700,
  fontSize: 16,
  color: "#fff",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const td = {
  padding: 15,
  fontSize: 15,
  color: "#fff",
  verticalAlign: "middle",
};