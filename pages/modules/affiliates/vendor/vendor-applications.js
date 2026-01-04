// /pages/modules/affiliates/affiliate-marketplace/vendor-applications.js
// Vendor view for reviewing and approving affiliate applications.

import { useEffect, useState } from "react";
import { supabase } from "../../../../utils/supabase-client";
import ICONS from "../../../../components/iconMap";
export default function VendorApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch all affiliate applications where vendor is the merchant
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const { data, error } = await supabase
          .from("affiliate_applications")
          .select(
            `
            id,
            status,
            created_at,
            product:product_id (title),
            affiliate:affiliate_id (email)
          `
          )
          .order("created_at", { ascending: false });

        if (error) throw error;
        setApplications(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from("affiliate_applications")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) alert("Error updating status: " + error.message);
    else {
      alert("Status updated to " + newStatus);
      setApplications((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: newStatus } : a
        )
      );
    }
  };

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        <div style={page.banner}>
          <span style={page.icon}>{ICONS.affiliates}</span>
          <div>
            <h1 style={page.title}>Affiliate Applications</h1>
            <p style={page.desc}>Review and approve affiliates for your products.</p>
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p style={{ color: "red" }}>{error}</p>
        ) : applications.length === 0 ? (
          <p>No applications yet.</p>
        ) : (
          <div style={page.grid}>
            {applications.map((app) => (
              <div key={app.id} style={page.card}>
                <h3>{app.product?.title || "Unknown Product"}</h3>
                <p>
                  <strong>Affiliate:</strong> {app.affiliate?.email || "Unknown"}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span style={{ color: app.status === "approved" ? "#22c55e" : app.status === "declined" ? "#ef4444" : "#f59e0b" }}>
                    {app.status}
                  </span>
                </p>
                <p>
                  <strong>Applied:</strong>{" "}
                  {new Date(app.created_at).toLocaleString()}
                </p>
                {app.status === "pending" && (
                  <div style={page.buttons}>
                    <button onClick={() => updateStatus(app.id, "approved")} style={page.approve}>Approve</button>
                    <button onClick={() => updateStatus(app.id, "declined")} style={page.decline}>Decline</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const page = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    display: "flex",
    justifyContent: "center",
  },
  inner: { width: "100%", maxWidth: 1320 },
  banner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#06b6d4",
    padding: "12px 18px",
    borderRadius: 12,
    marginBottom: 24,
  },
  icon: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  desc: { margin: 0, opacity: 0.85 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#1f2937",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #334155",
  },
  buttons: { display: "flex", gap: 8, marginTop: 10 },
  approve: {
    background: "#22c55e",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },
  decline: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },
};
