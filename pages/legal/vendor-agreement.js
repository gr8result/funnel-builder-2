import { supabase } from "../../lib/supabaseClient";
import { useEffect, useState } from "react";
import Head from "next/head";

// /pages/legal/vendor-agreement.js
// ✅ Vendor Agreement page — digital signature version (auto-updates accounts table so user never has to re-sign)

export default function VendorAgreement() {
  if (typeof document !== "undefined") {
    document.body.style.background = "#0c121a";
    document.documentElement.style.background = "#0c121a";
    document.body.style.color = "#fff";
    document.documentElement.style.color = "#fff";
  }

  const [user, setUser] = useState(null);
  const [clientIp, setClientIp] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [abn, setAbn] = useState("");
  const [appAddress, setAppAddress] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");
  const [isExistingMember, setIsExistingMember] = useState(null); // null = not chosen, true/false = chosen
  const [existingEmail, setExistingEmail] = useState("");
  const [existingUserId, setExistingUserId] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [lastToken, setLastToken] = useState(null); // Store last token for resend
  const [resending, setResending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [agreementVerified, setAgreementVerified] = useState(false);

  function applyExistingAgreement(agreement, fallbackEmail = "") {
    if (!agreement) return;
    setSigned(true);
    setAgreementVerified(Boolean(agreement.verified));
    setLastToken(agreement.token || null);
    setFullName(agreement.full_name || agreement.signer_name || fullName || "");
    setEmail(agreement.email || fallbackEmail || email || "");
    setPhone(agreement.phone || phone || "");
    setBusinessName(agreement.business_name || businessName || "");
    setAbn(agreement.abn || abn || "");
    setAppAddress(agreement.app_address || appAddress || "");
    setStatusMessage(
      agreement.verified
        ? "Your vendor agreement is already verified. Continue to the marketplace."
        : "Your vendor agreement has already been started. Check your inbox for the verification email, or resend it below."
    );
  }

  async function resolveUserIdToUse() {
    if (isExistingMember) {
      if (!existingUserId) throw new Error("Please look up your existing account first.");
      return existingUserId;
    }

    const storedCode = localStorage.getItem("xchange_user_code");
    if (!storedCode) {
      throw new Error("User not logged in.");
    }

    // Resolve user via API (bypasses RLS)
    const res = await fetch("/api/vendor/resolve-marketplace-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userCode: storedCode })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to resolve user account");
    }

    const { user: userRow } = await res.json();
    return userRow.id;
  }

  async function findExistingAgreement(userId, emailAddress = "") {
    try {
      const res = await fetch("/api/vendor/find-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: emailAddress })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to find agreement");
      }

      const { agreement } = await res.json();
      return agreement;
    } catch (err) {
      console.error("Agreement lookup error:", err);
      throw err;
    }
  }

  useEffect(() => {
    (async () => {
      // Only auto-load user if not using existing member flow
      if (isExistingMember === null || isExistingMember === false) {
        const storedCode = localStorage.getItem("xchange_user_code");
        if (storedCode) {
          // Resolve user via API (bypasses RLS)
          try {
            const res = await fetch("/api/vendor/resolve-marketplace-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userCode: storedCode })
            });

            if (res.ok) {
              const { user: data } = await res.json();
              setUser(data);
              setFullName(data.name || "");
              setEmail(data.email || "");
              setPhone(data.phone || "");
              // Check if user is already a verified vendor
              const { data: agreement } = await supabase
                .from("vendor_agreements")
                .select("id, token, verified, email, full_name, signer_name, phone, business_name, abn, app_address")
                .eq("user_id", data.id)
                .maybeSingle();
              if (agreement && agreement.verified) {
                window.location.href = "/marketplace";
                return;
              } else if (agreement) {
                applyExistingAgreement(agreement, data.email || "");
              }
            }
          } catch (err) {
            console.error("Failed to load user:", err);
          }
        }
        try {
          const res = await fetch("https://api.ipify.org?format=json");
          const j = await res.json();
          if (j?.ip) setClientIp(j.ip);
        } catch {
          setClientIp("Unavailable");
        }
      }
    })();
  }, [isExistingMember]);

  // Handle digital signature submission
 
 
 const handleSign = async () => {
  try {
    setSigning(true);
    setError("");
    setStatusMessage("");

    if (!fullName.trim()) throw new Error("Please type your full legal name to sign.");
    if (!email.trim()) throw new Error("Please enter your email address.");
    if (!phone.trim()) throw new Error("Please enter your phone number.");
    if (!agreed) throw new Error("You must confirm agreement before signing.");
    if (!businessName.trim()) throw new Error("Please enter your business name.");
    if (!abn.trim()) throw new Error("Please enter your ABN.");
    if (!appAddress.trim()) throw new Error("Please enter your business address.");

    const userIdToUse = await resolveUserIdToUse();
    const existing = await findExistingAgreement(userIdToUse, email.trim());

    if (existing) {
      applyExistingAgreement(existing, email.trim());
      return;
    }

    const verifyToken = Math.random().toString(36).substring(2) + Date.now();
    setLastToken(verifyToken);

    const record = {
      user_id: userIdToUse,
      signer_name: fullName.trim(),
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      business_name: businessName.trim(),
      abn: abn.trim(),
      app_address: appAddress.trim(),
      ip_address: clientIp,
      signed_at: new Date().toISOString(),
      agreed: true,
      vendor_agreement_signed: true,
      agreement_version: "1.0",
      verified: false,
      token: verifyToken,
    };

    const { error: insertError } = await (async () => {
      const res = await fetch("/api/vendor/create-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record })
      });

      if (!res.ok) {
        const errorData = await res.json();
        return { error: new Error(errorData.error || "Failed to create agreement") };
      }

      return { error: null };
    })();

    if (insertError) throw insertError;

    await fetch("/api/vendor/send-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email.trim(),
        name: fullName.trim(),
        phone: phone.trim(),
        token: verifyToken
      })
    });

    setSigned(true);
    setAgreementVerified(false);
    setStatusMessage("A verification email has been sent. Please check your inbox to verify and continue.");
    alert("A verification email has been sent. Please check your inbox to verify and continue.");

  } catch (err) {
    console.error(err);
    setError(err.message);
  } finally {
    setSigning(false);
  }
};

const handleResendVerification = async () => {
  setResending(true);
  setError("");
  setStatusMessage("");
  try {
    const userIdToUse = await resolveUserIdToUse();
    const existingAgreement = await findExistingAgreement(userIdToUse, email.trim() || existingEmail.trim());

    if (!existingAgreement?.id) {
      throw new Error("Vendor agreement not found.");
    }

    let tokenToUse = existingAgreement.token || lastToken;
    if (!tokenToUse) {
      tokenToUse = Math.random().toString(36).substring(2) + Date.now();
      const tokenRes = await fetch("/api/vendor/update-agreement-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId: existingAgreement.id, token: tokenToUse })
      });

      if (!tokenRes.ok) {
        const errorData = await tokenRes.json();
        throw new Error(errorData.error|| "Failed to update token");
      }
    }

    const targetEmail = existingAgreement.email || email.trim() || existingEmail.trim();
    if (!targetEmail) throw new Error("Missing email for resend.");

    await fetch("/api/vendor/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: targetEmail,
        name: (existingAgreement.full_name || existingAgreement.signer_name || fullName).trim(),
        phone: (existingAgreement.phone || phone).trim(),
        token: tokenToUse
      })
    });
    setLastToken(tokenToUse);
    setSigned(true);
    setAgreementVerified(Boolean(existingAgreement.verified));
    setStatusMessage("A verification email has been resent. Please check your inbox.");
    alert("A verification email has been resent. Please check your inbox.");
  } catch (err) {
    setError("Failed to resend verification email: " + err.message);
  } finally {
    setResending(false);
  }
};

// Handler for looking up existing user by email
const handleLookupExisting = async () => {
  setCheckingExisting(true);
  setError("");
  setStatusMessage("");

  try {
    if (!existingEmail.trim()) throw new Error("Please enter your email address.");

    // Look up existing account via API (bypasses RLS)
    const lookupRes = await fetch("/api/vendor/lookup-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: existingEmail.trim() })
    });

    if (!lookupRes.ok) {
      const errorData = await lookupRes.json();
      throw new Error(errorData.error || "Account lookup failed");
    }

    const { account } = await lookupRes.json();
    
    const userRes = await fetch("/api/vendor/lookup-or-create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: account.id })
    });

    if (!userRes.ok) {
      const errorData = await userRes.json();
      throw new Error(errorData.error || "Failed to lookup/create user");
    }

    const { user: userRow } = await userRes.json();

    if (!userRow?.id) {
      throw new Error("Unable to establish user account");
    }

    setExistingUserId(userRow.id);
    setFullName(account.full_name || "");
    setEmail(account.email || "");
    setPhone("");

    const existingAgreement = await findExistingAgreement(userRow.id, account.email || "");
    if (existingAgreement) {
      applyExistingAgreement(existingAgreement, account.email || "");
    }

  } catch (err) {
    setError(err.message);
    setExistingUserId(null);
  } finally {
    setCheckingExisting(false);
  }
};



  const container = {
    maxWidth: "1320px",
    margin: "0 auto",
    padding: "60px 20px 140px 20px",
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    lineHeight: "1.7",
    fontSize: "18px",
  };

  const heading = {
    fontSize: "2.4rem",
    fontWeight: "600",
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

  return (
    <>
      <Head>
        <title>Vendor Agreement | Gr8 Result Digital Solutions</title>
      </Head>
      <div style={{ ...container,  }}>   
        {/* Xchange Logo and Subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', }}>
          <img src="/xchange-logo.gif" alt="The Xchange Marketplace Logo" style={{ width: 480, height: 'auto', }} />
          <div style={{ color: '#06b6d4', fontWeight: 600, fontSize: 48, textAlign: 'center', }}>
            The Xchange Marketplace
          </div>
          <div style={{ color: '#fff', fontWeight: 500, fontSize: 18, textAlign: 'center', opacity: 0.7, maxWidth: 400 }}>
            The Xchange Marketplace is a division of <br /> Gr8 Result Digital Solutions.
          </div>
        </div>

        <h1 style={heading}>Vendor Agreement</h1>

        <form
          onSubmit={e => { e.preventDefault(); handleSign(); }}
          style={{ background: '#181f2a', borderRadius: 12, padding: 32, maxWidth: 600, margin: '32px auto', color: '#fff' }}
        >
          <div style={{ marginBottom: 18 }}>
            <label>Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #555', marginTop: 4, background: '#1a2232', color: '#fff' }} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #555', marginTop: 4, background: '#1a2232', color: '#fff' }} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>Phone</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #555', marginTop: 4, background: '#1a2232', color: '#fff' }} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>Business Name</label>
            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #555', marginTop: 4, background: '#1a2232', color: '#fff' }} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>ABN</label>
            <input type="text" value={abn} onChange={e => setAbn(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #555', marginTop: 4, background: '#1a2232', color: '#fff' }} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>Business Address</label>
            <input type="text" value={appAddress} onChange={e => setAppAddress(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #555', marginTop: 4, background: '#1a2232', color: '#fff' }} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginRight: 8 }} required />
              I agree to the terms and conditions
            </label>
          </div>
          <button type="submit" style={{ background: '#00bcd4', color: '#fff', padding: '12px 32px', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 18, cursor: 'pointer' }} disabled={signing}>
            {signing ? 'Signing...' : 'Sign Agreement'}
          </button>
          {statusMessage && (
            <div style={{ color: agreementVerified ? '#22c55e' : '#facc15', marginTop: 12, fontWeight: 600 }}>
              {statusMessage}
            </div>
          )}
          {signed && !agreementVerified && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              style={{ marginTop: 12, background: resending ? '#555' : '#22c55e', color: '#000', padding: '12px 24px', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: resending ? 'not-allowed' : 'pointer' }}
            >
              {resending ? 'Resending...' : 'Resend Verification Email'}
            </button>
          )}
          {agreementVerified && (
            <a href="/marketplace" style={{ display: 'inline-block', marginTop: 12, color: '#22c55e', fontWeight: 700, textDecoration: 'underline' }}>
              Continue to Marketplace
            </a>
          )}
          {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
        </form>

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
            The Platform receives a facilitation fee equivalent to 50% of the affiliate’s commission.
          </li>
          <li>
            All payments and settlements occur through the Platform’s secure
            payment system using Stripe as the facilitator.
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

        <h2 style={subheading}>5. Legal</h2>
        <ul style={list}>
          <li>This Agreement is governed by the laws of Queensland, Australia.</li>
          <li>Disputes shall be resolved in Queensland courts.</li>
          <li>
            Vendor agrees that digital signatures are legally binding under
            Australian law.
          </li>
        </ul>

        <h2 style={subheading}>6. Liability</h2>
        <ul style={list}>
          <li>Gr8 Result Digital Solutions (“Platform”) is not responsible for the quality, safety, legality, or delivery of any products or services sold by Vendors through the Platform.</li>
          <li>All transactions, warranties, and customer service are the sole responsibility of the Vendor.</li>
          <li>The Platform does not mediate disputes between Vendors and customers or Affiliates, and is not liable for any loss, damage, or claim arising from such transactions.</li>
          <li>Vendors agree to indemnify and hold harmless Gr8 Result Digital Solutions from any claims, damages, or liabilities related to their products, services, or conduct.</li>
          <li>No comebacks, chargebacks, or legal action may be taken against the Platform for issues relating to Vendor products or services.</li>
        </ul>

        <h2 style={subheading}>Digital Signature</h2>

        {!signed && (
          <div
            style={{
              marginTop: 60,
              marginBottom: 120,
              background: "#181f2e",
              borderRadius: 12,
              padding: "32px 24px",
              maxWidth: 700,
              marginLeft: "auto",
              marginRight: "auto",
              boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
            }}
          >
            <h3 style={{ color: "#22c55e", fontSize: 24, marginBottom: 16 }}>
              Legally Binding Digital Signature
            </h3>

            {/* Step 1: Are you an existing member? */}
            {isExistingMember === null && (
              <div style={{ marginBottom: 32 }}>
                <p style={{ fontWeight: 500, fontSize: 18, marginBottom: 12 }}>
                  Are you an existing member of the Gr8 Result platform?
                </p>
                <button
                  style={{ marginRight: 16, padding: "10px 24px", borderRadius: 8, fontWeight: 600, background: "#22c55e", color: "#000", border: "none", fontSize: 16, cursor: "pointer" }}
                  onClick={() => setIsExistingMember(true)}
                >
                  Yes, I am an existing member
                </button>
                <button
                  style={{ padding: "10px 24px", borderRadius: 8, fontWeight: 600, background: "#3b82f6", color: "#fff", border: "none", fontSize: 16, cursor: "pointer" }}
                  onClick={() => setIsExistingMember(false)}
                >
                  No, I am new here
                </button>
              </div>
            )}

            {/* Step 2: If existing, look up by email */}
            {isExistingMember === true && (
              <div style={{ marginBottom: 32 }}>
                <label htmlFor="existing-email" style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 18 }}>
                  Enter your Gr8 Result account email:
                </label>
                <input
                  id="existing-email"
                  type="email"
                  value={existingEmail}
                  onChange={e => setExistingEmail(e.target.value)}
                  placeholder="Enter your email address"
                  style={{ width: "100%", padding: "12px", fontSize: "18px", fontWeight: 600, borderRadius: "8px", border: "1px solid #ccc", background: "#fff", color: "#111", marginBottom: 12 }}
                  disabled={checkingExisting}
                />
                <button
                  style={{ padding: "10px 24px", borderRadius: 8, fontWeight: 700, background: "#22c55e", color: "#000", border: "none", fontSize: 16, cursor: "pointer", marginRight: 12 }}
                  onClick={handleLookupExisting}
                  disabled={checkingExisting || !existingEmail.trim()}
                >
                  {checkingExisting ? "Looking up..." : "Look up account"}
                </button>
                {existingUserId && (
                  <span style={{ color: "#22c55e", fontWeight: 600, marginLeft: 12 }}>
                    Account found!
                  </span>
                )}
              </div>
            )}

            {/* Step 3: Show signature form if ready */}
            {(isExistingMember === false || (isExistingMember === true && existingUserId)) && (
              <>
                <p style={{ marginBottom: 24 }}>
                  To accept this agreement, you must type your full legal name, email address, and phone number below and confirm your agreement. By clicking “Sign Agreement”, you acknowledge that this constitutes your legally binding digital signature under Australian law. A verification email will be sent to you.
                </p>

                <div style={{ marginBottom: 24 }}>
                  <label htmlFor="signature-name" style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 18 }}>
                    Full Legal Name including any middle name/s.
                  </label>
                  <input
                    id="signature-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full legal name"
                    style={{ width: "100%", padding: "12px", fontSize: "18px", fontWeight: 600, borderRadius: "8px", border: "1px solid #ccc", background: "#fff", color: "#111", marginBottom: 16 }}
                  />

                  <label htmlFor="signature-email" style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 18 }}>
                    Email Address
                  </label>
                  <input
                    id="signature-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    style={{ width: "100%", padding: "12px", fontSize: "18px", fontWeight: 600, borderRadius: "8px", border: "1px solid #ccc", background: "#fff", color: "#111", marginBottom: 16 }}
                  />

                  <label htmlFor="signature-phone" style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 18 }}>
                    Phone Number
                  </label>
                  <input
                    id="signature-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    style={{ width: "100%", padding: "12px", fontSize: "18px", fontWeight: 600, borderRadius: "8px", border: "1px solid #ccc", background: "#fff", color: "#111", marginBottom: 16 }}
                  />
                </div>

                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24, fontSize: 15, lineHeight: 1.6 }}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    style={{ width: 20, height: 20, marginTop: 4 }}
                  />
                  <span>
                    I confirm that I have read, understood, and agree to be legally bound by the terms of this Vendor Agreement.
                  </span>
                </label>

                <button
                  disabled={!fullName.trim() || !email.trim() || !phone.trim() || !agreed || signing}
                  onClick={handleSign}
                  style={{
                    background: fullName.trim() && email.trim() && phone.trim() && agreed ? "#22c55e" : "#555",
                    color: "#000",
                    fontWeight: 800,
                    padding: "14px 32px",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 18,
                    cursor: fullName.trim() && email.trim() && phone.trim() && agreed ? "pointer" : "not-allowed",
                  }}
                >
                  {signing ? "Submitting..." : "Sign Agreement and Continue"}
                </button>
              </>
            )}

            {error && (
              <div style={{ color: "crimson", marginTop: 15 }}>
                <p>{error}</p>
                {error.includes('apply to join') && (
                  <a href="/login" style={{ color: '#3b82f6', fontWeight: 700, textDecoration: 'underline', marginTop: 8, display: 'inline-block' }}>Go to login/signup page</a>
                )}
                {/* Show resend button if duplicate key error */}
                {signed && !agreementVerified && lastToken && (
                  <button
                    onClick={handleResendVerification}
                    disabled={resending}
                    style={{
                      marginTop: 16,
                      background: resending ? '#555' : '#22c55e',
                      color: '#000',
                      fontWeight: 700,
                      padding: '12px 28px',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 16,
                      cursor: resending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {resending ? 'Resending...' : 'Resend Verification Email'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}