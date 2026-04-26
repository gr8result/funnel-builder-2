// /pages/modules/vendor/affiliates/active_affiliates.js 

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../../utils/supabase-client";
import ICONS from "../../../../components/iconMap";
import Link from "next/link";
import VendorUserBanner from "../../../../components/vendor/VendorUserBanner";

const DEMO_AFFILIATES = [
  {
    id: "demo-1",
    name: "Grant Greatguy",
    email: "grant@example.com",
    phone_number: "+61 412 345 678",
    business_name: "Greatguy Growth",
    abn_tax_number: "ABN-111-222-333",
    product: "AI Mastery Course",
    totalSales: 14,
    revenue: 1680.5,
  },
  {
    id: "demo-2",
    name: "Sally Streams",
    email: "sally@example.com",
    phone_number: "+61 401 222 333",
    business_name: "Streams Media",
    abn_tax_number: "ABN-444-555-666",
    product: "Instagram Set-up Course",
    totalSales: 9,
    revenue: 845.0,
  },
  {
    id: "demo-3",
    name: "Mark Momentum",
    email: "mark@example.com",
    phone_number: "+61 433 888 111",
    business_name: "Momentum Ads",
    abn_tax_number: "ABN-777-888-999",
    product: "Free Traffic Course",
    totalSales: 6,
    revenue: 512.25,
  },
];

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    fontSize: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
  },
  inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },
  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#8f10d8",
    borderRadius: 12,
    padding: "18px 22px",
    marginBottom: 24,
    gap: 14
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto"
  },
  bannerTitle: { fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.05 },
  bannerSubtitle: { fontSize: 18, fontWeight: 600, opacity: 0.95, margin: 0, marginTop: 6 },
  backBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap"
  },
  table: {
    width: "100%",
    background: "#111827",
    borderRadius: 12,
    borderCollapse: "collapse",
    overflow: "hidden"
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    borderBottom: "1px solid #1f2937",
    fontWeight: 600,
    color: "#ccc",
    fontSize: 22,
    cursor: "pointer"
  },
  td: {
    padding: "12px 16px",
    borderBottom: "1px solid #1f2937",
    verticalAlign: "middle",
    fontSize: 18,
    fontWeight: 600
  },
  email: { color: "#8f10d8", fontWeight: 600 }
};

export default function ActiveAffiliates() {

  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ SORT STATE
  const [sortKey, setSortKey] = useState("revenue");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  useEffect(() => {

    const loadAffiliates = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const resolvedOwnerUserId = user?.id || null;

      if (!resolvedOwnerUserId) {
        // Security: never fall back to local marketplace identity or demo rows on this page.
        setAffiliates([]);
        setLoading(false);
        return;
      }

      // Get only this vendor's product IDs
      const { data: myProducts } = await supabase
        .from("affiliate_products")
        .select("id")
        .eq("owner_user_id", resolvedOwnerUserId);

      const myProductIds = (myProducts || []).map(p => p.id);

      if (myProductIds.length === 0) {
        setAffiliates([]);
        setLoading(false);
        return;
      }

      const { data: apps } = await supabase
        .from("affiliate_product_applications")
        .select(`
          affiliate_user_id,
          product_id,
          product:affiliate_products(title)
        `)
        .eq("status", "approved")
        .in("product_id", myProductIds);

      const affiliateIds = [...new Set((apps || []).map(a => a.affiliate_user_id))];

      if (affiliateIds.length === 0) {
        setAffiliates([]);
        setLoading(false);
        return;
      }

      const { data: affiliateDetails } = await supabase
        .from("affiliate_applications")
        .select("*")
        .in("affiliate_user_id", affiliateIds);

      const affiliateMap = {};
      (affiliateDetails || []).forEach(a => {
        affiliateMap[a.affiliate_user_id] = a;
      });

      const affiliateCodes = [
        ...new Set(
          (affiliateDetails || [])
            .map((a) => String(a.affiliate_id || "").toUpperCase())
            .filter(Boolean)
        ),
      ];

      const { data: sales } = affiliateCodes.length
        ? await supabase
            .from("affiliate_sales")
            .select("*")
            .in("affiliate_id", affiliateCodes)
        : { data: [] };

      const salesMap = {};
      (sales || []).forEach(s => {
        const affiliate = (affiliateDetails || []).find(
          (a) => String(a.affiliate_id || "").toUpperCase() === String(s.affiliate_id || "").toUpperCase()
        );
        const affiliateUserId = affiliate?.affiliate_user_id;
        if (!affiliateUserId) return;

        if (!salesMap[affiliateUserId]) {
          salesMap[affiliateUserId] = { totalSales: 0, revenue: 0 };
        }
        salesMap[affiliateUserId].totalSales += 1;
        salesMap[affiliateUserId].revenue += Number(s.sale_amount || 0);
      });

      const rows = (apps || []).map(app => {
        const affiliate = affiliateMap[app.affiliate_user_id] || {};
        const stats = salesMap[app.affiliate_user_id] || { totalSales: 0, revenue: 0 };

        return {
          id: app.affiliate_user_id + "-" + app.product_id,
          name: affiliate.name || "Affiliate",
          email: affiliate.email || "-",
          phone_number: affiliate.phone_number || "-",
          business_name: affiliate.business_name || "-",
          abn_tax_number: affiliate.abn_tax_number || "-",
          product: app.product?.title || "-",
          totalSales: stats.totalSales,
          revenue: stats.revenue
        };
      });

      setAffiliates(rows);
      setLoading(false);

    };

    loadAffiliates();

  }, []);

  // ✅ SORTED DATA
  const sortedAffiliates = useMemo(() => {
    const sorted = [...affiliates];

    sorted.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [affiliates, sortKey, sortDir]);

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>

        <div style={styles.banner}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={styles.iconWrap}>
              {ICONS.affiliates
                ? ICONS.affiliates({ size:48, color:"#fff"})
                : <span style={{fontSize:48}}>🤝</span>}
            </div>
            <div>
              <h1 style={styles.bannerTitle}>Active Affiliates</h1>
              <p style={styles.bannerSubtitle}>
                All affiliates currently promoting your products.
              </p>
            </div>
          </div>

          <Link href="/modules/vendor/affiliates/manage-products">
            <button style={styles.backBtn}>← Back</button>
          </Link>

        </div>

        <VendorUserBanner />

        <table style={styles.table}>

          <thead>
            <tr>
              <th style={styles.th} onClick={() => toggleSort("name")}>Name</th>
              <th style={styles.th} onClick={() => toggleSort("email")}>Email</th>
              <th style={styles.th} onClick={() => toggleSort("phone_number")}>Phone</th>
              <th style={styles.th} onClick={() => toggleSort("business_name")}>Business Name</th>
              <th style={styles.th} onClick={() => toggleSort("abn_tax_number")}>ABN/Tax</th>
              <th style={styles.th} onClick={() => toggleSort("product")}>Product</th>
              <th style={styles.th} onClick={() => toggleSort("totalSales")}>Total Sales</th>
              <th style={styles.th} onClick={() => toggleSort("revenue")}>Revenue</th>
            </tr>
          </thead>

          <tbody>

            {loading ? (
              <tr>
                <td colSpan={8} style={{textAlign:"center"}}>
                  Loading...
                </td>
              </tr>
            ) : sortedAffiliates.length === 0 ? (
              <tr>
                <td colSpan={8} style={{textAlign:"center"}}>
                  No active affiliates found yet.
                </td>
              </tr>
            ) : (
              sortedAffiliates.map(a => (
                <tr key={a.id}>
                  <td style={styles.td}>{a.name}</td>
                  <td style={styles.td}><span style={styles.email}>{a.email}</span></td>
                  <td style={styles.td}>{a.phone_number}</td>
                  <td style={styles.td}>{a.business_name}</td>
                  <td style={styles.td}>{a.abn_tax_number}</td>
                  <td style={styles.td}>{a.product}</td>
                  <td style={styles.td}>{a.totalSales}</td>
                  <td style={styles.td}>${a.revenue.toFixed(2)}</td>
                </tr>
              ))
            )}

          </tbody>

        </table>

      </div>
    </div>
  );
}