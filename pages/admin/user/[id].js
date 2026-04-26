// /pages/admin/user/[id].js
// Admin detail view for individual onboarding applications — now includes Submitted Application Data section


import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";

function extractStoragePath(pathOrUrl, bucketName) {
  if (!pathOrUrl) return null;

  const raw = String(pathOrUrl).trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const marker = `/storage/v1/object/sign/${bucketName}/`;
      const publicMarker = `/storage/v1/object/public/${bucketName}/`;

      if (url.pathname.includes(marker)) {
        return decodeURIComponent(url.pathname.split(marker)[1] || "");
      }
      if (url.pathname.includes(publicMarker)) {
        return decodeURIComponent(url.pathname.split(publicMarker)[1] || "");
      }
    } catch {
      return null;
    }
  }

  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");

  if (normalized.toLowerCase().startsWith(`${bucketName.toLowerCase()}/`)) {
    return normalized.substring(bucketName.length + 1);
  }

  return normalized;
}

async function getSignedUrlIfPrivate(path) {
  if (!path) return null;

  const privatePath = extractStoragePath(path, "Private-assets");
  if (privatePath) {
    const { data, error } = await supabase.storage
      .from("Private-assets")
      .createSignedUrl(privatePath, 3600);
    return error ? null : data?.signedUrl;
  }

  const publicPath = extractStoragePath(path, "public-assets");
  if (publicPath) {
    const { data } = supabase.storage.from("public-assets").getPublicUrl(publicPath);
    return data?.publicUrl;
  }

  return null;
}

export default function UserDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kycUrls, setKycUrls] = useState({ front: null, back: null, proof: null });

  async function openDocument(path) {
    const url = await getSignedUrlIfPrivate(path);
    if (!url) {
      alert("Document not found or inaccessible.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Admin action handler
  async function handleAction(type) {
    const endpointByAction = {
      approve: "/api/admin/approve-user",
      deny: "/api/admin/reject-user",
      reject: "/api/admin/reject-user",
    };

    const endpoint = endpointByAction[type];
    if (!endpoint) {
      alert(`Error: Unsupported action "${type}"`);
      return;
    }

    if (!id) {
      alert("Error: Missing user id.");
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const contentType = res.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        throw new Error(payload?.error || `${type} failed`);
      }

      alert(
        type === "approve"
          ? "✅ User approved successfully!"
          : "❌ User rejected successfully!"
      );
      router.push("/admin/user-approvals");
    } catch (err) {
      alert("Error: " + (err?.message || "Unknown error"));
    }
  }


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
        setLoading(false);
        return;
      }
      setUser(data);

      // Generate signed URLs for KYC images if present
      const [front, back, proof] = await Promise.all([
        getSignedUrlIfPrivate(data.id_front_url),
        getSignedUrlIfPrivate(data.id_back_url),
        getSignedUrlIfPrivate(data.proof_of_address_url),
      ]);
      setKycUrls({ front, back, proof });
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

  const verificationStatus = user.verified ? "✅ Verified" : user.rejected ? "❌ Rejected" : "⏳ Pending";

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        {/* Verification Status */}
        <div style={{ marginBottom: 24, fontSize: 32, fontWeight: 600, color: verificationStatus === "✅ Verified" ? '#22c55e' : verificationStatus === "❌ Rejected" ? '#ef4444' : '#facc15' }}>
          Status: {verificationStatus}
        </div>

        {/* Application Details Sections (still shown for layout) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
          <div>
            <div style={styles.card}>
              <h2 style={styles.heading2}>Personal & Contact Information</h2>
              <p><strong>Full Name:</strong> {user.full_name || "—"}</p>
              <p><strong>Date of Birth:</strong> {user.dob || "—"}</p>
              <p><strong>Email:</strong> {user.email || "—"}</p>
              <p><strong>Phone:</strong> {user.phone || "—"}</p>
              <p><strong>Alternate Phone:</strong> {user.alt_phone || "—"}</p>
              <p><strong>Residential Address:</strong> {user.residential_address || "—"}</p>
              <p><strong>Residential City:</strong> {user.residential_city || "—"}</p>
              <p><strong>Residential State:</strong> {user.residential_state || "—"}</p>
              <p><strong>Residential Postcode:</strong> {user.residential_postcode || "—"}</p>
              <p><strong>Residential Country:</strong> {user.residential_country || "—"}</p>
              <h3 style={styles.heading3}>Driver’s Licence Verification</h3>
              <p><strong>Licence Number:</strong> {user.driver_licence_number || "—"}</p>
              <p><strong>Card Number:</strong> {user.driver_card_number || "—"}</p>
              <p><strong>Expiry Date:</strong> {user.driver_expiry || "—"}</p>
            </div>
            <div style={styles.card}>
              <h2 style={styles.heading2}>Business Information</h2>
              <p><strong>Business Name:</strong> {user.business_name || "—"}</p>
              <p><strong>ABN:</strong> {user.abn || "—"}</p>
              <p><strong>Business Country:</strong> {user.business_country || "—"}</p>
              <p><strong>Business Address:</strong> {user.business_address || "—"}</p>
              <p><strong>Business City:</strong> {user.business_city || "—"}</p>
              <p><strong>Business State:</strong> {user.business_state || "—"}</p>
              <p><strong>Business Postcode:</strong> {user.business_postcode || "—"}</p>
              <p><strong>Postal Address:</strong> {user.postal_address || "—"}</p>
              <p><strong>Postal City:</strong> {user.postal_city || "—"}</p>
              <p><strong>Postal State:</strong> {user.postal_state || "—"}</p>
              <p><strong>Postal Postcode:</strong> {user.postal_postcode || "—"}</p>
              <p><strong>Postal Country:</strong> {user.postal_country || "—"}</p>
              <p><strong>Business Phone:</strong> {user.business_phone || "—"}</p>
              <p><strong>Business Email:</strong> {user.business_email || "—"}</p>
              <p><strong>Website:</strong> {user.website || "—"}</p>
            </div>
          </div>
          <div>
            <div style={styles.card}>
              <h2>Verification Documents</h2>
              <p><strong>Proof of Address:</strong></p>
              {user.proof_of_address_url ? (
                <button type="button" style={styles.linkBtn} onClick={() => openDocument(user.proof_of_address_url)}>View Proof of Address</button>
              ) : (<span style={{ color: '#f87171' }}>— Not uploaded or not found —</span>)}
              <p><strong>ID (Front):</strong></p>
              {user.id_front_url ? (
                <button type="button" style={styles.linkBtn} onClick={() => openDocument(user.id_front_url)}>View ID Front</button>
              ) : (<span style={{ color: '#f87171' }}>— Not uploaded or not found —</span>)}
              <p><strong>ID (Back):</strong></p>
              {user.id_back_url ? (
                <button type="button" style={styles.linkBtn} onClick={() => openDocument(user.id_back_url)}>View ID Back</button>
              ) : (<span style={{ color: '#f87171' }}>— Not uploaded or not found —</span>)}
            </div>
            <div style={styles.card}>
              <h2 style={styles.heading2}>Payout Details</h2>
              <p><strong>PayPal Email:</strong> {user.paypal_email || "—"}</p>
              <p><strong>Bank Account:</strong> {user.bank_account || "—"}</p>
              <p><strong>Stripe Connected:</strong> {user.stripe_connected ? "Yes" : "No"}</p>
            </div>
          </div>
        </div>
        <div style={styles.card}>
          <h2>Submitted Application Data</h2>
          <p style={{ opacity: 0.8, marginBottom: 10 }}>This section shows additional details from the original onboarding form.</p>
          {user.application_json ? (
            <>
              {Object.entries(user.application_json).map(([key, value]) => (
                <p key={key}><strong style={{ textTransform: "capitalize" }}>{key.replace(/_/g, " ")}:</strong> {typeof value === "object" ? JSON.stringify(value) : value || "—"}</p>
              ))}
            </>
          ) : (<p>— No saved application data —</p>)}
        </div>
        {/* Admin Action Buttons */}
        <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
          <button
            style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 8, fontWeight: 700, fontSize: 18, cursor: 'pointer' }}
            onClick={() => handleAction('approve')}
          >
            Approve
          </button>
          <button
            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 8, fontWeight: 700, fontSize: 18, cursor: 'pointer' }}
            onClick={() => handleAction('deny')}
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
    heading2: {
      fontSize: 24,
      color: '#facc15',
      marginBottom: 16,
      marginTop: 0,
      fontWeight: 700,
      letterSpacing: 0.5,
    },
    heading3: {
      fontSize: 20,
      color: '#38bdf8',
      marginBottom: 12,
      marginTop: 18,
      fontWeight: 600,
      letterSpacing: 0.2,
    },
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
  inner: { width: "100%", maxWidth: 1320, margin: '0 auto' },
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
  linkBtn: {
    background: "none",
    border: "none",
    padding: 0,
    color: "#93c5fd",
    textDecoration: "underline",
    cursor: "pointer",
    font: "inherit",
  },
};
