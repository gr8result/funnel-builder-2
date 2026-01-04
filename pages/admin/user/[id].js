// /pages/admin/user/[id].js
// Admin detail view for individual onboarding applications — now includes Submitted Application Data section

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";

export default function UserDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadUser = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        alert("No user found or error fetching user details.");
      } else {
        setUser(data);
      }
      setLoading(false);
    };

    loadUser();
  }, [id]);

  if (loading) {
    return (
      <div style={styles.wrap}>
        <p style={{ color: "#fff" }}>Loading user details...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.wrap}>
        <p style={{ color: "#fff" }}>No user found.</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        <div style={styles.banner}>
          <h1 style={styles.title}>User Application Details</h1>
          <Link href="/admin/user-approvals" style={styles.backButton}>
            ← Back to Approvals
          </Link>
        </div>

        {/* Personal Info */}
        <div style={styles.card}>
          <h2>Personal Information</h2>
          <p><strong>Name:</strong> {user.name}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Phone:</strong> {user.phone || "—"}</p>
          <p><strong>Country:</strong> {user.country || "—"}</p>
          <p><strong>Residential Address:</strong> {user.residential_address || "—"}</p>
        </div>

        {/* Business Info */}
        <div style={styles.card}>
          <h2>Business Information</h2>
          <p><strong>Business Name:</strong> {user.business_name || "—"}</p>
          <p><strong>ABN / Tax ID:</strong> {user.tax_id || "—"}</p>
          <p><strong>Business Address:</strong> {user.business_address || "—"}</p>
          <p><strong>Postal Address:</strong> {user.postal_address || "—"}</p>
          <p><strong>Position in Business:</strong> {user.position || "—"}</p>
          <p><strong>Business Phone:</strong> {user.business_phone || "—"}</p>
          <p><strong>Business Email:</strong> {user.business_email || "—"}</p>
          <p><strong>Business Registration Certificate:</strong></p>
          {user.business_certificate_url ? (
            <a
              href={user.business_certificate_url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View Uploaded Certificate
            </a>
          ) : (
            <p>—</p>
          )}
        </div>

        {/* Verification Docs */}
        <div style={styles.card}>
          <h2>Verification Documents</h2>
          <p><strong>Proof of Address:</strong></p>
          {user.proof_of_address_url ? (
            <a
              href={user.proof_of_address_url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View Proof of Address
            </a>
          ) : (
            <p>—</p>
          )}

          <p><strong>ID (Front):</strong></p>
          {user.id_front_url ? (
            <a
              href={user.id_front_url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View ID Front
            </a>
          ) : (
            <p>—</p>
          )}

          <p><strong>ID (Back):</strong></p>
          {user.id_back_url ? (
            <a
              href={user.id_back_url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View ID Back
            </a>
          ) : (
            <p>—</p>
          )}
        </div>

        {/* Affiliate & Payout */}
        <div style={styles.card}>
          <h2>Affiliate & Payout</h2>
          <p><strong>Account Type:</strong> {user.account_type || "—"}</p>
          <p><strong>PayPal Email:</strong> {user.paypal_email || "—"}</p>
          <p><strong>Stripe Connected:</strong> {user.stripe_connected ? "Yes" : "No"}</p>
        </div>

        {/* Submitted Application Data */}
        <div style={styles.card}>
          <h2>Submitted Application Data</h2>
          <p style={{ opacity: 0.8, marginBottom: 10 }}>
            This section shows additional details from the original onboarding form.
          </p>

          {user.application_json ? (
            <>
              {Object.entries(user.application_json).map(([key, value]) => (
                <p key={key}>
                  <strong style={{ textTransform: "capitalize" }}>{key.replace(/_/g, " ")}:</strong>{" "}
                  {typeof value === "object" ? JSON.stringify(value) : value || "—"}
                </p>
              ))}
            </>
          ) : (
            <p>— No saved application data —</p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    display: "flex",
    justifyContent: "center",
    padding: "28px 22px",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  inner: { width: "100%", maxWidth: 1320 },
  banner: {
    background: "#f97316",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    borderRadius: 6,
    marginBottom: 30,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 800 },
  backButton: {
    background: "#0c121a",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 4,
    textDecoration: "none",
    fontWeight: 700,
    border: "1px solid #fff",
  },
  card: {
    background: "#111827",
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    border: "1px solid #1f2937",
  },
  link: {
    color: "#93c5fd",
    textDecoration: "underline",
  },
};
