// /pages/modules/affiliates/affiliate-marketplace/offers/[id].js
// Product details page — displays info for a single offer, with Apply button linking to new form page

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../../../utils/supabase-client";
import Link from "next/link";
import ICONS from "../../../../../components/iconMap";

export default function OfferDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    if (!id) return;
    const fetchOffer = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (error) console.error(error);
      else setOffer(data);
    };
    fetchOffer();
  }, [id]);

  if (!offer)
    return (
      <div style={{ color: "#fff", padding: 40, textAlign: "center" }}>
        Loading product details...
      </div>
    );

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
    inner: { width: "100%", maxWidth: 880 },
    banner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#22c55e",
      padding: "14px 18px",
      borderRadius: 12,
      fontWeight: 700,
      marginBottom: 24,
    },
    card: {
      background: "#111827",
      borderRadius: 12,
      padding: 20,
      boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
    },
  };

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        <div style={page.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{ICONS.affiliates}</span>
            <span>{offer.title}</span>
          </div>
          <Link href="/modules/affiliates/affiliate-marketplace/offers">
            <button
              style={{
                background: "#16a34a",
                color: "#fff",
                padding: "6px 14px",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Back to Offers
            </button>
          </Link>
        </div>

        <div style={page.card}>
          {offer.thumbnail_url && (
            <img
              src={offer.thumbnail_url}
              alt={offer.title}
              style={{
                width: "100%",
                borderRadius: 8,
                marginBottom: 16,
                objectFit: "cover",
              }}
            />
          )}
          <p>{offer.description}</p>
          <p>
            <b>Commission:</b> {offer.commission || "N/A"}%
            <br />
            <b>Category:</b> {offer.category || "Uncategorised"}
          </p>
          <p>
            <b>Sales Page:</b>{" "}
            <a
              href={offer.sales_page_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#22c55e" }}
            >
              {offer.sales_page_url}
            </a>
            <br />
            <b>Affiliate Link:</b>{" "}
            <a
              href={offer.affiliate_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#22c55e" }}
            >
              {offer.affiliate_link}
            </a>
          </p>

          <Link
            href={`/modules/affiliates/affiliate-marketplace/offers/apply?id=${offer.id}`}
          >
            <button
              style={{
                marginTop: 20,
                background: "#22c55e",
                color: "#000",
                fontWeight: 700,
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Apply to Program
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
