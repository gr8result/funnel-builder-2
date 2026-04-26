import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useRouter } from "next/router";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "../../../../utils/supabase-client";
import VendorUserBanner from "../../../../components/vendor/VendorUserBanner";

function monthKey(iso) {
  if (!iso) return "Unknown";
  return String(iso).slice(0, 7);
}

export default function AffiliateAnalytics() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("last90");
  const [rows, setRows] = useState([]);
  const [productsById, setProductsById] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        let resolvedAffiliateUserId = null;
        let resolvedAffiliateCode = "";

        const marketplaceCode =
          typeof window !== "undefined"
            ? localStorage.getItem("xchange_user_code") || ""
            : "";

        if (marketplaceCode) {
          resolvedAffiliateCode = String(marketplaceCode).slice(0, 8).toUpperCase();
          const { data: marketplaceUser, error: marketplaceUserError } = await supabase
            .from("users")
            .select("id")
            .eq("user_code", marketplaceCode)
            .maybeSingle();

          if (marketplaceUserError) throw marketplaceUserError;
          if (marketplaceUser?.id) {
            resolvedAffiliateUserId = marketplaceUser.id;
          }
        }

        if (!resolvedAffiliateUserId) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.id) {
            resolvedAffiliateUserId = user.id;
          }
        }

        // If we have a user id but not the affiliate code yet, resolve from affiliate_applications.
        if (!resolvedAffiliateCode && resolvedAffiliateUserId) {
          const { data: appByUser } = await supabase
            .from("affiliate_applications")
            .select("affiliate_id, affiliate_user_id")
            .eq("affiliate_user_id", resolvedAffiliateUserId)
            .maybeSingle();

          if (appByUser?.affiliate_id) {
            resolvedAffiliateCode = String(appByUser.affiliate_id).toUpperCase();
          }
          if (!resolvedAffiliateUserId && appByUser?.affiliate_user_id) {
            resolvedAffiliateUserId = appByUser.affiliate_user_id;
          }
        }

        // If we only have affiliate code, resolve its UUID user id first.
        if (!resolvedAffiliateUserId && resolvedAffiliateCode) {
          const { data: appByCode } = await supabase
            .from("affiliate_applications")
            .select("affiliate_user_id")
            .eq("affiliate_id", resolvedAffiliateCode)
            .maybeSingle();

          if (appByCode?.affiliate_user_id) {
            resolvedAffiliateUserId = appByCode.affiliate_user_id;
          }
        }

        if (!resolvedAffiliateUserId) {
          setRows([]);
          setProductsById({});
          setLoading(false);
          return;
        }

        const { data: salesRows, error: salesByCodeError } = await supabase
          .from("affiliate_sales")
          .select("*")
          .eq("affiliate_id", resolvedAffiliateUserId);

        if (salesByCodeError) throw salesByCodeError;

        const safeRows = salesRows || [];

        setRows(safeRows);

        const productIds = [...new Set((salesRows || []).map((r) => r.product_id).filter(Boolean))];
        if (productIds.length) {
          const { data: products, error: productsError } = await supabase
            .from("affiliate_products")
            .select("id, title")
            .in("id", productIds);

          if (productsError) throw productsError;

          const map = {};
          (products || []).forEach((p) => {
            map[p.id] = p.title || p.id;
          });
          setProductsById(map);
        } else {
          setProductsById({});
        }
      } catch (e) {
        setRows([]);
        setProductsById({});
        setError(e?.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredRows = useMemo(() => {
    const now = new Date();

    return rows.filter((r) => {
      if (!r.created_at) return range === "all";
      const d = new Date(r.created_at);
      if (Number.isNaN(d.getTime())) return false;
      if (range === "last7") return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      if (range === "last30") return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      if (range === "last90") return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
      if (range === "year") return d >= new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return true;
    });
  }, [rows, range]);

  const totals = useMemo(() => {
    const salesCount = filteredRows.length;
    const grossSales = filteredRows.reduce((s, r) => s + Number(r.sale_amount || 0), 0);
    const claimed = filteredRows.reduce((s, r) => s + Number(r.commission_paid || 0), 0);
    const owing = filteredRows.reduce((s, r) => s + Number(r.commission_due || 0), 0);
    const earned = claimed + owing;

    return { salesCount, grossSales, earned, claimed, owing };
  }, [filteredRows]);

  const perProduct = useMemo(() => {
    const map = {};

    filteredRows.forEach((r) => {
      const key = r.product_id || "unknown";
      if (!map[key]) {
        map[key] = {
          productId: key,
          productTitle: productsById[key] || key,
          salesCount: 0,
          grossSales: 0,
          earned: 0,
          claimed: 0,
          owing: 0,
        };
      }

      const claimed = Number(r.commission_paid || 0);
      const owing = Number(r.commission_due || 0);

      map[key].salesCount += 1;
      map[key].grossSales += Number(r.sale_amount || 0);
      map[key].claimed += claimed;
      map[key].owing += owing;
      map[key].earned += claimed + owing;
    });

    return Object.values(map).sort((a, b) => b.earned - a.earned);
  }, [filteredRows, productsById]);

  const chartData = useMemo(() => {
    const map = {};

    filteredRows.forEach((r) => {
      const key = monthKey(r.created_at);
      if (!map[key]) {
        map[key] = {
          month: key,
          sales: 0,
          grossSales: 0,
          claimed: 0,
          owing: 0,
          earned: 0,
        };
      }

      const claimed = Number(r.commission_paid || 0);
      const owing = Number(r.commission_due || 0);

      map[key].sales += 1;
      map[key].grossSales += Number(r.sale_amount || 0);
      map[key].claimed += claimed;
      map[key].owing += owing;
      map[key].earned += claimed + owing;
    });

    return Object.values(map).sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [filteredRows]);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#ec4899",
          borderRadius: 16,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          padding: "24px 36px",
          marginBottom: 10,
          boxShadow: "0 4px 24px 0 rgba(236,72,153,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(16,26,44,0.10)",
              borderRadius: 12,
              padding: 8,
              marginRight: 18,
            }}
          >
            <BarChart3 size={48} color="#fff" />
          </span>
          <div>
            <div style={{ fontSize: 48, fontWeight: 600, color: "#fff", lineHeight: 1 }}>
              Affiliate Analytics
            </div>
            <div style={{ fontSize: 18, color: "#fff", fontWeight: 400, marginTop: 6 }}>
              Sales, earned, claimed and owing by product
            </div>
          </div>
        </div>
        <button
          type="button"
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#b2ec48",
            background: "rgba(16,26,44,0.10)",
            border: "2px solid #fff",
            borderRadius: 8,
            padding: "10px 28px",
            cursor: "pointer",
          }}
          onClick={() => router.back()}
        >
          ← Back
        </button>
      </div>

      <VendorUserBanner />

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 18, color: "#fff", marginRight: 12 }}>Date Range:</label>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{
            fontSize: 18,
            padding: "6px 12px",
            borderRadius: 8,
            background: "#232e47",
            color: "#fff",
            border: "none",
          }}
        >
          <option value="last7">Last 7 Days</option>
          <option value="last30">Last 30 Days</option>
          <option value="last90">Last 90 Days</option>
          <option value="year">Last Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {error ? (
        <div style={{ color: "#f87171", fontSize: 18, marginBottom: 16 }}>{error}</div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 24 }}>
        <MetricCard label="Sales" value={totals.salesCount} color="#38bdf8" loading={loading} />
        <MetricCard label="Gross Sales" value={`$${totals.grossSales.toFixed(2)}`} color="#a78bfa" loading={loading} />
        <MetricCard label="Commission Earned" value={`$${totals.earned.toFixed(2)}`} color="#22c55e" loading={loading} />
        <MetricCard label="Commission Claimed" value={`$${totals.claimed.toFixed(2)}`} color="#f97316" loading={loading} />
        <MetricCard label="Commission Owing" value={`$${totals.owing.toFixed(2)}`} color="#facc15" loading={loading} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#181f2a", borderRadius: 14, padding: 18 }}>
          <h3 style={{ color: "#fff", marginTop: 0 }}>Monthly Commissions</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip />
              <Legend />
              <Bar dataKey="earned" fill="#22c55e" name="Earned" />
              <Bar dataKey="claimed" fill="#f97316" name="Claimed" />
              <Bar dataKey="owing" fill="#facc15" name="Owing" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#181f2a", borderRadius: 14, padding: 18 }}>
          <h3 style={{ color: "#fff", marginTop: 0 }}>Monthly Sales</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#38bdf8" strokeWidth={3} name="Sales" />
              <Line type="monotone" dataKey="grossSales" stroke="#a78bfa" strokeWidth={3} name="Gross Sales" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: "#111827", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #1f2937", fontSize: 22, fontWeight: 600 }}>
          Product Performance
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Sales</th>
              <th style={th}>Gross Sales</th>
              <th style={th}>Earned</th>
              <th style={th}>Claimed</th>
              <th style={th}>Owing</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={emptyTd}>Loading...</td></tr>
            ) : perProduct.length === 0 ? (
              <tr><td colSpan={6} style={emptyTd}>No sales data yet for this affiliate.</td></tr>
            ) : (
              perProduct.map((p) => (
                <tr key={p.productId}>
                  <td style={td}>{p.productTitle}</td>
                  <td style={td}>{p.salesCount}</td>
                  <td style={td}>${p.grossSales.toFixed(2)}</td>
                  <td style={td}>${p.earned.toFixed(2)}</td>
                  <td style={td}>${p.claimed.toFixed(2)}</td>
                  <td style={td}>${p.owing.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, loading }) {
  return (
    <div style={{ background: "#111827", padding: 16, borderRadius: 14, textAlign: "center" }}>
      <div style={{ color: "#fff" }}>{label}</div>
      <div style={{ fontSize: 28, color, marginTop: 6 }}>{loading ? "..." : value}</div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #1f2937",
  color: "#cbd5e1",
  fontSize: 16,
};

const td = {
  padding: "12px 14px",
  borderBottom: "1px solid #1f2937",
  fontSize: 16,
};

const emptyTd = {
  textAlign: "center",
  padding: "22px 14px",
  color: "#94a3b8",
};
