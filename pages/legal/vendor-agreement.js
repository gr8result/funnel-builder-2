// /pages/legal/vendor-agreement.js
// ✅ Vendor Agreement page — digital signature version (auto-updates accounts table so user never has to re-sign)

import { useEffect, useState } from "react";
import Head from "next/head";
import { supabase } from "../../utils/supabase-client";

export default function VendorAgreement() {
  if (typeof document !== "undefined") {
    document.body.style.background = "#0c121a";
    document.documentElement.style.background = "#0c121a";
  }

  const [user, setUser] = useState(null);
  const [clientIp, setClientIp] = useState("");
  const [fullName, setFullName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      const u = data.user;
      setUser(u);
      setFullName(u.user_metadata?.full_name || "");

      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const j = await res.json();
        if (j?.ip) setClientIp(j.ip);
      } catch {
        setClientIp("Unavailable");
      }

      // ✅ Check if already signed
      const { data: account } = await supabase
        .from("accounts")
        .select("vendor_agreement_signed")
        .eq("user_id", u.id)
        .single();

      if (account?.vendor_agreement_signed) {
        setSigned(true);
      }
    })();
  }, []);

  const handleSign = async () => {
    try {
      setSigning(true);
      setError("");

      if (!fullName.trim()) throw new Error("Please type your full name to sign.");

      // ✅ Check if record already exists
      const { data: existing } = await supabase
        .from("vendor_agreements")
        .select("id")
        .eq("user_id", user.id);

      if (existing && existing.length > 0) {
        // Already signed once — just mark as signed in accounts
        await supabase
          .from("accounts")
          .update({
            vendor: true,
            vendor_agreement_signed: true,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        alert("You have already signed the Vendor Agreement. Redirecting to Account...");
        window.location.href = "/account";
        return;
      }

      // ✅ Insert a new vendor agreement record
      const record = {
        user_id: user.id,
        full_name: fullName,
        email: user.email,
        ip_address: clientIp,
        signed_at: new Date().toISOString(),
        agreement_version: "1.0",
      };

      const { error: insertError } = await supabase
        .from("vendor_agreements")
        .insert(record);

      if (insertError) throw insertError;

      // ✅ Update account to permanently record agreement
      await supabase
        .from("accounts")
        .update({
          vendor: true,
          vendor_agreement_signed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      setSigned(true);
      alert("Vendor Agreement signed successfully.");
      window.location.href = "/account";
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSigning(false);
    }
  };

  // ---------- Styles ----------
  const container = {
    maxWidth: "1320px",
    margin: "0 auto",
    padding: "60px 20px",
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    lineHeight: "1.7",
  };

  const heading = {
    fontSize: "2.4rem",
    fontWeight: "700",
    marginBottom: "1rem",
    color: "#00bcd4",
  };

  const subheading = {
    fontSize: "1.4rem",
    fontWeight: "600",
    marginTop: "2rem",
    marginBottom: "0.5rem",
    color: "#1de9b6",
  };

  const paragraph = { marginBottom: "1rem" };
  const list = { marginLeft: "20px", marginBottom: "1rem" };

  // ---------- Render ----------
  return (
    <>
      <Head>
        <title>Vendor Agreement | Gr8 Result Digital Solutions</title>
      </Head>
      <div style={container}>
        <h1 style={heading}>Vendor Agreement</h1>

        <p style={paragraph}>
          This Vendor Agreement (“Agreement”) is entered into between{" "}
          <b>Gr8 Result Digital Solutions</b> (“Platform”) and the undersigned
          vendor (“Vendor”).
        </p>

        <h2 style={subheading}>1. Purpose</h2>
        <p style={paragraph}>
          The Platform provides digital infrastructure for listing, marketing,
          and affiliate promotion of Vendor products. The Platform does not own,
          produce, test, guarantee, or fulfil products sold by Vendors.
        </p>

        <h2 style={subheading}>2. Vendor Responsibilities</h2>
        <ul style={list}>
          <li>
            Vendor is solely responsible for product descriptions, pricing,
            accuracy, fulfilment, shipping, refunds, and customer service.
          </li>
          <li>
            Vendor warrants that all products comply with Australian law and
            applicable industry regulations.
          </li>
          <li>Vendor must not make false, misleading, or unlawful claims.</li>
          <li>
            Vendor must hold appropriate business registrations, ABN, and
            licences.
          </li>
        </ul>

        <h2 style={subheading}>3. Commission & Payments</h2>
        <ul style={list}>
          <li>Affiliate commission rate is set by the Vendor (maximum 60%).</li>
          <li>
            The Platform receives 50% of the affiliate’s commission as a
            facilitation fee.
          </li>
          <li>
            All payments and settlements occur through the Platform’s secure
            payment system.
          </li>
        </ul>

        <h2 style={subheading}>4. Prohibited Content and Activities</h2>
        <ul style={list}>
          <li>
            <b>Strictly prohibited:</b> pornography or sexually explicit
            material of any kind.
          </li>
          <li>
            No sale, promotion, or distribution of firearms, ammunition, or
            weapons.
          </li>
          <li>No gambling, betting, or lottery-related content.</li>
          <li>
            No drugs, controlled substances, or related paraphernalia of any
            kind.
          </li>
          <li>
            No content promoting hate speech, violence, or discrimination.
          </li>
          <li>
            Violation of this clause results in immediate account termination
            and permanent ban.
          </li>
        </ul>

        <h2 style={subheading}>5. Legal & Liability</h2>
        <ul style={list}>
          <li>This Agreement is governed by the laws of Queensland, Australia.</li>
          <li>Disputes shall be resolved in Queensland courts.</li>
          <li>
            Vendor agrees that digital signatures are legally binding under
            Australian law.
          </li>
        </ul>

        <h2 style={subheading}>6. Contact</h2>
        <p style={paragraph}>
          Gr8 Result Digital Solutions
          <br />
          Website: www.gr8result.com
          <br />
          Email: support@gr8result.com
        </p>

        <hr style={{ margin: "40px 0", borderColor: "#333" }} />

        <h2 style={subheading}>Digital Signature</h2>

        {!signed ? (
          <>
            <p style={paragraph}>
              To confirm your acceptance of this agreement, please type your
              full legal name below.
            </p>

            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Type your full name to sign"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "1rem",
                borderRadius: "8px",
                border: "1px solid #555",
                background: "#1a2232",
                color: "#fff",
                marginBottom: "12px",
              }}
            />

            <button
              onClick={handleSign}
              disabled={signing}
              style={{
                background: "#22c55e",
                color: "#000",
                fontWeight: "800",
                padding: "10px 18px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              {signing ? "Submitting..." : "Confirm Signature"}
            </button>

            {error && (
              <p style={{ color: "crimson", marginTop: "12px" }}>{error}</p>
            )}
          </>
        ) : (
          <p style={{ color: "#22c55e" }}>
            ✅ Agreement already signed and verified. You can safely return to your account.
          </p>
        )}
      </div>
    </>
  );
}
