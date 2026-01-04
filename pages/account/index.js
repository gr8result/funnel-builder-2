// /pages/account/index.js

import { useState, useEffect } from "react";
import Head from "next/head";
import Layout from "../../components/Layout";
import { supabase } from "../../utils/supabase-client";
import Link from "next/link";
import ICONS from "../../components/iconMap";
import { Card } from "../../components/ui/card";

function generateAffiliateTail() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 9; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return `ref/${s}`;
}

const COUNTRIES = [
  "Australia",
  "United States",
  "United Kingdom",
  "Canada",
  "New Zealand",
  "Singapore",
  "India",
  "Malaysia",
  "Philippines",
  "South Africa",
  "Germany",
  "France",
  "Italy",
  "Japan",
  "China",
  "Brazil",
  "Mexico",
  "United Arab Emirates",
  "Other",
];

export default function AccountPage() {
  // -----------------------------
  // STATE
  // -----------------------------
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planPrice, setPlanPrice] = useState(null);

  const [userId, setUserId] = useState(null);
  const [approved, setApproved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [agreementSigned, setAgreementSigned] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  // Hide Email API Key card after copy / if key already exists
  const [apiKeyHidden, setApiKeyHidden] = useState(false);

  // DKIM state
  const [dkimRecords, setDkimRecords] = useState(null);
  const [dkimVerified, setDkimVerified] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    email: "",
    phone: "",
    altPhone: "",
    residentialAddress: "",
    residentialCity: "",
    residentialState: "",
    residentialPostcode: "",
    residentialCountry: "Australia",
    driverLicenceNumber: "",
    driverCardNumber: "",
    driverExpiry: "",
    businessName: "",
    businessId: "",
    businessCountry: "Australia",
    businessAddress: "",
    businessCity: "",
    businessState: "",
    businessPostcode: "",
    postalAddress: "",
    postalCity: "",
    postalState: "",
    postalPostcode: "",
    postalCountry: "Australia",
    sameAsBusiness: false,
    businessPhone: "",
    businessEmail: "",
    website: "",
    linkedin: "",
    taxCountry: "",
    paypalEmail: "",
    bankAccount: "",
    affiliateOptIn: false,
    vendorOptIn: false,
    agreeTerms: false,
    agreePrivacy: false,

    // DKIM domain on the form
    dkimDomain: "",
  });

  const [files, setFiles] = useState({
    logo: null,
    avatar: null,
    idFront: null,
    idBack: null,
    proofAddress: null,
    registrationDoc: null,
  });

  const [previews, setPreviews] = useState({});
  const [affiliateTail, setAffiliateTail] = useState("");
  const AFFILIATE_BASE =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.gr8result.com";

  // -----------------------------
  // GLOBAL PAGE EFFECTS
  // -----------------------------

  // Set black background once
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.background = "#000";
      document.documentElement.style.background = "#000";
    }
  }, []);

  // Hide Email API Key card if key already exists
  useEffect(() => {
    const verifyApiKey = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch the user's account row to get the primary 'id' from 'accounts'
        const { data: acc } = await supabase
          .from("accounts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!acc?.id) {
          console.warn("⚠️ No account ID found.");
          return;
        }

        // 2. Use the 'account_id' to check the 'sendgrid_keys' table
        const { data: keyRow } = await supabase
          .from("sendgrid_keys")
          .select("api_key")
          .eq("account_id", acc.id)
          .maybeSingle();

        // 3. Update state based on the presence of the key
        if (keyRow?.api_key && keyRow.api_key.trim() !== "") {
          console.log("✅ SendGrid API key found, hiding card.");
          setApiKey(keyRow.api_key);
          setApiKeyHidden(true);
        } else {
          console.log("⚠️ No SendGrid API key found, showing card.");
          setApiKey("");
          setApiKeyHidden(false);
        }
      } catch (err) {
        console.error("verifyApiKey error:", err);
      }
    };

    verifyApiKey();
  }, []);

  // -----------------------------
  // LOAD EXISTING DATA
  // -----------------------------
  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          console.warn("⚠️ No logged-in user, skipping loadData");
          setLoadingData(false);
          return;
        }

        setUserId(user.id);
        setForm((p) => ({ ...p, email: user.email || "" }));

        // Load account data
        const { data: account, error: accError } = await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (accError) throw accError;
        if (!account) {
          console.warn("⚠️ No account found for user");
          setLoadingData(false);
          return;
        }

        // Restore email plan info
        if (account.email_plan) setSelectedPlan(account.email_plan);
        if (account.email_plan_price) setPlanPrice(account.email_plan_price);

        // Flags
        setApproved(account.approved === true);
        setAgreementSigned(account.vendor_agreement_signed === true);

        // Populate form
        setForm((p) => ({
          ...p,
          fullName: account.full_name || "",
          dob: account.dob || "",
          email: account.email || user.email || "",
          phone: account.phone || "",
          altPhone: account.alt_phone || "",
          businessName: account.business_name || "",
          businessId: account.abn || "",
          businessAddress: account.business_address || "",
          businessCity: account.business_city || "",
          businessState: account.business_state || "",
          businessPostcode: account.business_postcode || "",
          postalAddress: account.postal_address || "",
          postalCity: account.postal_city || "",
          postalState: account.postal_state || "",
          postalPostcode: account.postal_postcode || "",
          website: account.website || "",
          paypalEmail: account.paypal_email || "",
          vendorOptIn: account.vendor === true,
          affiliateOptIn: account.affiliate === true,
          agreeTerms: account.agree_terms === true,
          agreePrivacy: account.agree_privacy === true,

          // DKIM
          dkimDomain: account.dkim_domain || "",
        }));

        // DKIM state restore
        setDkimVerified(account.dkim_verified === true);
        if (account.dkim_records) {
          setDkimRecords(account.dkim_records);
        }

        // Preview helper (logos, IDs, etc.)
        async function preview(key, val) {
          if (!val) return;
          try {
            let url;
            let current = val;

            // if stored as JSON string { url: "..." }
            if (typeof current === "string" && current.trim().startsWith("{")) {
              try {
                const parsed = JSON.parse(current);
                if (parsed?.url) current = parsed.url;
              } catch {
                console.warn(`Skipping invalid stored URL for ${key}:`, current);
              }
            }

            const lower = String(current).toLowerCase();
            const isPrivate =
              lower.includes("private-assets") ||
              lower.includes("private_assets");

            const cleanPath = String(current)
              .replace(
                /^https:\/\/[^/]+\/storage\/v1\/object\/public\//,
                ""
              )
              .replace(/^private-assets\//i, "")
              .replace(/^public-assets\//i, "")
              .replace(/^\/+/, "");

            if (isPrivate) {
              const { data: signed, error } = await supabase.storage
                .from("Private-assets")
                .createSignedUrl(cleanPath, 3600);
              if (error) {
                console.warn(`Signed URL failed for ${key}:`, error.message);
                return;
              }
              url = signed?.signedUrl;
            } else {
              const { data: pub } = supabase.storage
                .from("public-assets")
                .getPublicUrl(cleanPath);
              url = pub?.publicUrl;
            }

            if (!url) {
              console.warn(`⚠️ No URL generated for ${key}`);
              return;
            }

            const isPDF = cleanPath.toLowerCase().endsWith(".pdf");
            setPreviews((prev) => ({
              ...prev,
              [key]: { url, type: isPDF ? "pdf" : "image" },
            }));
          } catch (err) {
            console.error(`❌ Error restoring ${key}:`, err.message);
          }
        }

        // Restore all images
        await preview("logo", account.business_logo);
        await preview("avatar", account.business_avatar);
        await preview("idFront", account.id_front);
        await preview("idBack", account.id_back);
        await preview("proofAddress", account.proof_address);
        await preview("registrationDoc", account.registration_doc);

        // Affiliate slug
        if (account.affiliate_slug) setAffiliateTail(account.affiliate_slug);

        // Licence / proof / registration from Private-assets
        try {
          const folders = [
            { key: "id-front", state: "idFront" },
            { key: "id-back", state: "idBack" },
            { key: "proof", state: "proofAddress" },
            { key: "registration", state: "registrationDoc" },
          ];

          for (const f of folders) {
            const { data, error } = await supabase.storage
              .from("Private-assets")
              .list(`${user.id}/${f.key}`, {
                limit: 1,
                sortBy: { column: "created_at", order: "desc" },
              });

            if (error || !data?.length) continue;
            const file = data[0];

            const { data: signed } = await supabase.storage
              .from("Private-assets")
              .createSignedUrl(`${user.id}/${f.key}/${file.name}`, 3600);

            if (!signed?.signedUrl) continue;
            setPreviews((p) => ({ ...p, [f.state]: signed.signedUrl }));

            if (f.key === "id-front") {
              const { data: meta } = await supabase
                .from("storage.objects")
                .select("metadata")
                .eq("bucket_id", "Private-assets")
                .eq("name", `${user.id}/${f.key}/${file.name}`)
                .maybeSingle();

              if (meta?.metadata) {
                setForm((p) => ({
                  ...p,
                  driverLicenceNumber: meta.metadata.licence_number || "",
                  driverCardNumber: meta.metadata.card_number || "",
                  driverExpiry: meta.metadata.expiry_date || "",
                }));
              }
            }
          }
        } catch (err) {
          console.error("❌ Image restore error:", err);
        }

        // Restore licence metadata from accounts row
        setForm((p) => ({
          ...p,
          driverLicenceNumber: account.driver_licence_number || "",
          driverCardNumber: account.driver_card_number || "",
          driverExpiry: account.driver_expiry || "",
        }));
      } catch (err) {
        console.error("❌ Error loading account:", err);
        alert(
          "❌ Failed to load account details:\n" +
            (err.message || JSON.stringify(err))
        );
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, []);

  // -----------------------------
  // SENDGRID HANDLER
  // -----------------------------
  const [manualKey, setManualKey] = useState("");

  async function connectSendgrid(mode) {
    try {
      const res = await fetch("/api/connect-sendgrid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userEmail: form.email,
          userName: form.fullName,
          mode,
          userKey: manualKey,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ SendGrid connected successfully!");
      } else {
        alert("❌ Error connecting SendGrid: " + data.error);
      }
    } catch (err) {
      alert("❌ Unexpected error: " + err.message);
    }
  }

  // -----------------------------
  // FORM CHANGE HANDLER
  // -----------------------------
  const handleChange = async (e) => {
    const { name, type, value, checked, files: fileList } = e.target;

    // FILES
    if (type === "file") {
      const file = fileList[0];
      if (!file) return;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return alert("You must be logged in.");

        const PrivateFolders = ["id-front", "id-back", "proof", "registration"];
        const isPrivate = PrivateFolders.includes(name);
        const bucket = isPrivate ? "Private-assets" : "public-assets";

        const ext = file.name.split(".").pop();
        const timestamp = Date.now();
        const path = `${user.id}/${name}/${timestamp}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadError) throw uploadError;

        // Get URL
        let url;
        if (isPrivate) {
          const { data: signed, error: signedErr } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);
          if (signedErr) throw signedErr;
          url = signed?.signedUrl;
        } else {
          const { data: pub } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);
          url = pub?.publicUrl;
        }

        setPreviews((prev) => ({
          ...prev,
          [name]: { url, type: file.type.includes("pdf") ? "pdf" : "image" },
        }));

        setForm((prev) => ({
          ...prev,
          [`business_${name}`]: url,
        }));
      } catch (err) {
        console.error("❌ Upload error:", err);
        alert("❌ Upload failed: " + err.message);
      }
      return;
    }

    // CHECKBOX
    if (type === "checkbox") {
      setForm((p) => ({ ...p, [name]: checked }));

      if (name === "vendorOptIn" && checked && !agreementSigned) {
        window.location.href = "/legal/vendor-agreement";
      }

      if (name === "sameAsBusiness" && checked) {
        setForm((p) => ({
          ...p,
          postalAddress: p.businessAddress,
          postalCity: p.businessCity,
          postalState: p.businessState,
          postalPostcode: p.businessPostcode,
          postalCountry: p.businessCountry,
        }));
      }

      if (name === "affiliateOptIn" && checked && !affiliateTail)
        setAffiliateTail(generateAffiliateTail());

      return;
    }

    // DEFAULT INPUT
    setForm((p) => ({ ...p, [name]: value }));
  };

  // Unified uploader for "uploadToStorage" (used on submit)
  const uploadToStorage = async (file, folder, metadata = {}) => {
    if (!file) return null;
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Not logged in.");

      const PrivateFolders = [
        "id-front",
        "id-back",
        "proof",
        "licences",
        "agreements",
        "registration",
      ];
      const isPrivate = PrivateFolders.includes(folder);
      const bucket = isPrivate ? "Private-assets" : "public-assets";

      const ext = file.name.split(".").pop();
      const timestamp = Date.now();
      const path = `${user.id}/${folder}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          metadata,
        });

      if (uploadError) throw uploadError;

      console.log(`📦 Uploaded ${folder} to ${bucket}/${path}`);
      return `${bucket}/${path}`;
    } catch (err) {
      console.error("❌ Upload failed:", err);
      alert("❌ Upload failed: " + err.message);
      return null;
    }
  };

  // -----------------------------
  // SUBMIT HANDLER
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert("You must be logged in.");

    // Vendor Agreement validation
    if (form.vendorOptIn) {
      const { data: acctCheck } = await supabase
        .from("accounts")
        .select("vendor_agreement_signed")
        .eq("user_id", user.id)
        .single();

      const isSigned =
        acctCheck?.vendor_agreement_signed === true || agreementSigned;
      if (!isSigned) {
        alert(
          "Please complete and sign the Vendor Agreement before continuing."
        );
        return;
      }
    }

    setUploading(true);
    try {
      const uploads = await Promise.all([
        uploadToStorage(files.logo, "logo"),
        uploadToStorage(files.avatar, "avatar"),
        uploadToStorage(files.idFront, "id-front"),
        uploadToStorage(files.idBack, "id-back"),
        uploadToStorage(files.proof, "proof"),
        uploadToStorage(files.registrationDoc, "registration"),
      ]);

      const [
        logoUrl,
        avatarUrl,
        idFrontUrl,
        idBackUrl,
        proofUrl,
        regDocUrl,
      ] = uploads;

      const payload = {
        user_id: user.id,
        full_name: form.fullName,
        dob: form.dob,
        email: form.email,
        phone: form.phone,
        alt_phone: form.altPhone,
        residential_address: form.residentialAddress,
        residential_city: form.residentialCity,
        residential_state: form.residentialState,
        residential_postcode: form.residentialPostcode,
        residential_country: form.residentialCountry,
        driver_licence_number: form.driverLicenceNumber,
        driver_card_number: form.driverCardNumber,
        driver_expiry: form.driverExpiry,
        business_name: form.businessName,
        abn: form.businessId,
        business_country: form.businessCountry,
        business_address: form.businessAddress,
        business_city: form.businessCity,
        business_state: form.businessState,
        business_postcode: form.businessPostcode,
        postal_address: form.postalAddress,
        postal_city: form.postalCity,
        postal_state: form.postalState,
        postal_postcode: form.postalPostcode,
        postal_country: form.postalCountry,
        same_as_business: form.sameAsBusiness,
        business_phone: form.businessPhone,
        business_email: form.businessEmail,
        website: form.website,
        linkedin: form.linkedin,
        tax_country: form.taxCountry,
        paypal_email: form.paypalEmail,
        bank_account: form.bankAccount,
        affiliate: form.affiliateOptIn,
        vendor: form.vendorOptIn,
        agree_terms: form.agreeTerms,
        agree_privacy: form.agreePrivacy,
        business_logo: logoUrl || previews.logo,
        business_avatar: avatarUrl || previews.avatar,
        affiliate_slug: affiliateTail || null,

        // DKIM fields
        dkim_domain: form.dkimDomain || null,
        dkim_records: dkimRecords || null,
        dkim_verified: dkimVerified,

        updated_at: new Date().toISOString(),
      };

      // Check if record exists
      const { data: existing, error: fetchError } = await supabase
        .from("accounts")
        .select("id, vendor_agreement_signed, approved, is_approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

      let saveError = null;
      if (existing) {
        const { error: updateError } = await supabase
          .from("accounts")
          .update(payload)
          .eq("user_id", user.id);
        saveError = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("accounts")
          .insert(payload);
        saveError = insertError;
      }

      if (saveError) {
        alert(`Save failed: ${saveError.message}`);
      } else {
        if (payload.vendor) {
          if (
            existing?.vendor_agreement_signed ||
            existing?.is_approved ||
            existing?.approved
          ) {
            alert(
              "✅ Saved successfully. Your account is fully approved as a vendor!"
            );
          } else {
            alert(
              "✅ Saved successfully. Awaiting admin approval to activate vendor status."
            );
          }
        } else {
          alert("✅ Saved successfully.");
        }
        setSubmitted(true);
      }
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // -----------------------------
  // LOADING STATE
  // -----------------------------
  if (loadingData) {
    return (
      <Layout>
        <div
          style={{
            color: "#fff",
            textAlign: "center",
            marginTop: "80px",
            fontSize: "18px",
          }}
        >
          Loading...
        </div>
      </Layout>
    );
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <Layout>
      <div className="wrap">
        <Head>
          <title>Account & Onboarding | Gr8 Result</title>
        </Head>
        <div className="inner">
          {/* Banner – forced purple to match side nav, with icon + bigger text */}
          <div className="banner purple">
            <span className="banner-icon">{ICONS.account}</span>
            <h1 className="banner-title">
              {approved ? "Edit Your Account Details" : "Account & Onboarding"}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="form">
            {/* CONTACT INFORMATION */}
            <div className="card teal">
              <h2>Personal & Contact Information</h2>
              <label>
                Full Name
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Date of Birth
                <input
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Email
                <input type="email" value={form.email} disabled />
              </label>
              <label>
                Phone
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Alternate Phone
                <input
                  name="altPhone"
                  value={form.altPhone}
                  onChange={handleChange}
                />
              </label>

              <h3>Driver’s Licence Verification</h3>
              <label>
                Licence Number
                <input
                  name="driverLicenceNumber"
                  value={form.driverLicenceNumber}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Card Number
                <input
                  name="driverCardNumber"
                  value={form.driverCardNumber}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Expiry Date
                <input
                  type="date"
                  name="driverExpiry"
                  value={form.driverExpiry}
                  onChange={handleChange}
                  required
                />
              </label>
              <div className="preview-row">
                {previews.idFront && (
                  <img src={previews.idFront} className="thumb" />
                )}
                {previews.idBack && (
                  <img src={previews.idBack} className="thumb" />
                )}
                {previews.proofAddress && (
                  <img src={previews.proofAddress} className="thumb" />
                )}
              </div>
              <label>
                Licence Front
                <input type="file" name="idFront" onChange={handleChange} />
              </label>
              <label>
                Licence Back
                <input type="file" name="idBack" onChange={handleChange} />
              </label>
              <label>
                Proof of Address
                <input
                  type="file"
                  name="proofAddress"
                  onChange={handleChange}
                />
              </label>
            </div>

            {/* BUSINESS DETAILS */}
            <div className="card yellow">
              <h2>Business Information</h2>

              {/* Business Logo Section */}
              <div className="preview-row">
                <h4
                  style={{
                    width: "100%",
                    color: "#facc15",
                    marginBottom: "8px",
                  }}
                >
                  Business Logo
                </h4>
                {previews.logo?.url ? (
                  <img
                    src={previews.logo.url}
                    className="thumb"
                    alt="Business Logo"
                  />
                ) : (
                  <div style={{ color: "#999", fontSize: "13px" }}>
                    No logo uploaded yet
                  </div>
                )}
              </div>
              <label>
                Upload Business Logo
                <input type="file" name="logo" onChange={handleChange} />
              </label>

              {/* Avatar Section */}
              <div className="preview-row" style={{ marginTop: "20px" }}>
                <h4
                  style={{
                    width: "100%",
                    color: "#facc15",
                    marginBottom: "8px",
                  }}
                >
                  Avatar
                </h4>
                {previews.avatar?.url ? (
                  <img
                    src={previews.avatar.url}
                    className="thumb"
                    alt="Avatar"
                  />
                ) : (
                  <div style={{ color: "#999", fontSize: "13px" }}>
                    No avatar uploaded yet
                  </div>
                )}
              </div>
              <label>
                Upload Avatar
                <input type="file" name="avatar" onChange={handleChange} />
              </label>

              <label>
                Business Registration Certificate
                <input
                  type="file"
                  name="registrationDoc"
                  onChange={handleChange}
                />
              </label>
              <label>
                Business Name
                <input
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                ABN / Business ID
                <input
                  name="businessId"
                  value={form.businessId}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            {/* AFFILIATE & VENDOR */}
            <div className="card blue">
              <h2>Platform Roles</h2>

              {/* Affiliate */}
              <label className="check-large">
                <input
                  type="checkbox"
                  name="affiliateOptIn"
                  checked={form.affiliateOptIn}
                  onChange={handleChange}
                />
                I want to become an Affiliate.
              </label>

              {form.affiliateOptIn && (
                <div style={{ marginTop: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ color: "#ccc" }}>ref/</span>
                    <input
                      type="text"
                      placeholder="yourname"
                      value={affiliateTail.replace(/^ref\//, "")}
                      onChange={(e) =>
                        setAffiliateTail(`ref/${e.target.value}`)
                      }
                      style={{ width: "100%" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const { data: u } = await supabase.auth.getUser();
                      const usr = u?.user;
                      if (!usr) return alert("Login required.");
                      const { error } = await supabase
                        .from("accounts")
                        .update({
                          affiliate_slug: affiliateTail,
                          updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", usr.id);
                      if (error) return alert("Error saving: " + error.message);
                      alert("Affiliate link saved.");
                    }}
                    className="btn green-btn"
                    style={{ marginTop: 8 }}
                  >
                    Save Tail
                  </button>
                </div>
              )}

              {/* Vendor */}
              <div style={{ marginTop: 24 }}>
                <label
                  className="check-large"
                  style={{
                    opacity: agreementSigned ? 0.8 : 1,
                    cursor: agreementSigned ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="vendorOptIn"
                    checked={form.vendorOptIn}
                    onChange={handleChange}
                    disabled={agreementSigned}
                  />
                  I want to become a Vendor.
                </label>
                {agreementSigned ? (
                  <p style={{ fontSize: 13, color: "#22c55e", marginTop: 4 }}>
                    ✅ Vendor Agreement already signed and verified.
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
                    This opens the Vendor Agreement which must be signed before
                    continuing.
                  </p>
                )}
              </div>
            </div>

            {/* AGREEMENTS */}
            <div className="card green">
              <h2>Agreements</h2>
              <label className="check-large">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={form.agreeTerms}
                  onChange={handleChange}
                />
                I agree to the{" "}
                <a
                  href="/legal/terms-and-conditions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms
                </a>
              </label>

              <label className="check-large">
                <input
                  type="checkbox"
                  name="agreePrivacy"
                  checked={form.agreePrivacy}
                  onChange={handleChange}
                />
                I agree to the{" "}
                <a
                  href="/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* ===========================
📬 DKIM + SPF DNS Setup
=========================== */}
            <div
              className="card magenta"
              style={{
                marginTop: "36px",
                width: "100%",
                maxWidth: "1080px",
                marginLeft: "auto",
                marginRight: "auto",
                background: "rgba(0, 0, 0, 0.7)",
                padding: "24px",
                borderRadius: "16px",
                border: "2px solid #a855f7",
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "20px",
                  fontWeight: 1200,
                  color: "#a855f7",
                  marginBottom: "4px",
                }}
              >
                <span>🧩</span> DKIM + SPF DNS Setup
              </h3>

              {/* Status + check button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                  marginTop: 4,
                  flexWrap: "wrap",
                }}
              >
                {dkimVerified ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid #22c55e",
                      color: "#bbf7d0",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    ✅ Your domain {form.dkimDomain || "your domain"} has now
                    been fully verified and can be used to safely send emails.
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: "rgba(248,113,113,0.12)",
                      border: "1px solid #f97316",
                      color: "#fed7aa",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    ⚠️ Domain not verified yet
                  </span>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const {
                        data: { user },
                      } = await supabase.auth.getUser();
                      if (!user) {
                        alert("Please log in first.");
                        return;
                      }

                      const domainToCheck = form.dkimDomain || "";

                      if (!domainToCheck.trim()) {
                        alert("Please enter a domain first.");
                        return;
                      }

                      const res = await fetch("/api/dkim/check-verification", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: user.id,
                          domain: domainToCheck,
                        }),
                      });

                      const data = await res.json();

                      if (!res.ok) {
                        console.error("DKIM check failed:", data);
                        alert(
                          "❌ DKIM check failed:\n" +
                            (data?.error || JSON.stringify(data))
                        );
                        return;
                      }

                      if (data.verified) {
                        setDkimVerified(true);
                        alert(
                          `✅ Domain ${domainToCheck} is verified in SendGrid.`
                        );
                      } else {
                        setDkimVerified(false);
                        alert(
                          "⚠️ Domain is not fully verified yet in SendGrid. " +
                            "Give DNS a bit more time or double-check the records."
                        );
                      }
                    } catch (err) {
                      console.error("DKIM check error:", err);
                      alert(
                        "❌ Unexpected error while checking verification:\n" +
                          (err?.message || JSON.stringify(err))
                      );
                    }
                  }}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    border: "1px solid #22c55e",
                    background: "rgba(34,197,94,0.16)",
                    color: "#bbf7d0",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  ✓ Check verification
                </button>
              </div>

              <p style={{ color: "#e2e8f0", lineHeight: "1.6", fontSize: 15 }}>
                DKIM (DomainKeys Identified Mail) and SPF records help verify
                your emails are legitimately sent from your domain. These
                records improve deliverability and prevent spam issues.
              </p>

              {/* If no records yet, show domain input + button */}
              {(!dkimRecords ||
                (Array.isArray(dkimRecords) && dkimRecords.length === 0)) && (
                <div style={{ marginTop: "18px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: "600",
                      color: "#e2e8f0",
                    }}
                  >
                    Domain Name
                  </label>
                  <input
                    type="text"
                    name="dkimDomain"
                    placeholder="e.g. yourdomain.com"
                    value={form.dkimDomain || ""}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #a855f7",
                      backgroundColor: "#1a2232",
                      color: "#e2e8f0",
                      fontSize: "15px",
                      marginBottom: "12px",
                    }}
                  />

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const {
                          data: { user },
                        } = await supabase.auth.getUser();
                        if (!user) {
                          alert("Please log in first.");
                          return;
                        }

                        const res = await fetch("/api/dkim/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            userId: user.id,
                            domain: form.dkimDomain,
                          }),
                        });

                        const data = await res.json();
                        console.log("🔍 DKIM raw response:", data);

                        if (!res.ok) {
                          let errMsg = "Failed to fetch DKIM";
                          if (data?.error) {
                            if (typeof data.error === "string") {
                              errMsg = data.error;
                            } else if (typeof data.error === "object") {
                              errMsg = JSON.stringify(data.error, null, 2);
                            }
                          }
                          console.error("❌ DKIM generation failed:", errMsg);
                          alert("❌ DKIM error:\n" + errMsg);
                          return;
                        }

                        // normalise whatever the API returns into an array
                        let rawRecords =
                          data.records ||
                          data.dns ||
                          data.dns_records ||
                          data.result ||
                          data;

                        let records = [];
                        if (Array.isArray(rawRecords)) {
                          records = rawRecords;
                        } else if (
                          rawRecords &&
                          typeof rawRecords === "object"
                        ) {
                          if (
                            rawRecords.dns &&
                            typeof rawRecords.dns === "object" &&
                            !Array.isArray(rawRecords.dns)
                          ) {
                            records = Object.values(rawRecords.dns);
                          } else {
                            records = Object.values(rawRecords);
                          }
                        }

                        console.log("✅ Normalised DKIM records:", records);

                        // 1) show in UI
                        setDkimRecords(records);

                        // 2) persist to accounts
                        const { error: dkimSaveError } = await supabase
                          .from("accounts")
                          .update({
                            dkim_domain: form.dkimDomain,
                            dkim_records: records,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("user_id", user.id);

                        if (dkimSaveError) {
                          console.error(
                            "❌ Failed to save DKIM to accounts:",
                            dkimSaveError
                          );
                          alert(
                            "DKIM created, but failed to save in database: " +
                              dkimSaveError.message
                          );
                          return;
                        }

                        alert(
                          `✅ DKIM records generated and saved for ${
                            data.domain || form.dkimDomain
                          }`
                        );
                      } catch (err) {
                        console.error("❌ DKIM error:", err);
                        alert(
                          "❌ Unexpected error:\n" +
                            (err?.message || JSON.stringify(err))
                        );
                      }
                    }}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "10px",
                      fontWeight: "700",
                      backgroundColor: "#22c55e",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                      fontSize: 15,
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#16a34a";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#22c55e";
                    }}
                  >
                    Generate DKIM Records
                  </button>
                </div>
              )}

              {/* If we have records, show the table */}
              {dkimRecords &&
                (!Array.isArray(dkimRecords) || dkimRecords.length > 0) && (
                  <>
                    <p
                      style={{
                        marginTop: "12px",
                        color: "#10b981",
                        fontSize: "15px",
                        fontWeight: "700",
                      }}
                    >
                      ✅ DKIM + SPF records generated successfully for{" "}
                      <span style={{ textDecoration: "underline" }}>
                        {form.dkimDomain || "your domain"}
                      </span>
                      . Add the following DNS records in your domain host.
                    </p>

                    <div
                      style={{
                        marginTop: "10px",
                        overflowX: "auto",
                        borderRadius: "10px",
                        border: "1px solid #1f2937",
                        backgroundColor: "#020617",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "13px",
                        }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: "#020617" }}>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "12px",
                                borderBottom: "1px solid #1f2937",
                              }}
                            >
                              Host / Name
                            </th>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "12px",
                                borderBottom: "1px solid #1f2937",
                              }}
                            >
                              Type
                            </th>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "12px",
                                borderBottom: "1px solid #1f2937",
                              }}
                            >
                              Value / Target
                            </th>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "12px",
                                borderBottom: "1px solid #1f2937",
                              }}
                            >
                              TTL
                            </th>
                            <th
                              style={{
                                textAlign: "right",
                                padding: "12px",
                                borderBottom: "1px solid #1f2937",
                              }}
                            >
                              Copy
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            Array.isArray(dkimRecords)
                              ? dkimRecords
                              : dkimRecords && typeof dkimRecords === "object"
                              ? Object.values(dkimRecords)
                              : []
                          ).map((rec, idx) => {
                            const host = rec.host || rec.name || rec.record || "";
                            const type = rec.type || rec.record_type || "";
                            const value =
                              rec.value || rec.data || rec.target || "";
                            const ttl = rec.ttl || rec.ttl_sec || "";

                            return (
                              <tr key={idx}>
                                <td
                                  style={{
                                    padding: "11px 12px",
                                    borderBottom: "1px solid #111827",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {host}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 12px",
                                    borderBottom: "1px solid #111827",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {type}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 12px",
                                    borderBottom: "1px solid #111827",
                                    fontFamily: "monospace",
                                    wordBreak: "break-all",
                                  }}
                                >
                                  {value}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 12px",
                                    borderBottom: "1px solid #111827",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {ttl || "Default"}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 12px",
                                    borderBottom: "1px solid #111827",
                                    textAlign: "right",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const txt = `${host}  ${type}  ${value}`;
                                      navigator.clipboard.writeText(txt);
                                      alert("Record copied to clipboard.");
                                    }}
                                    style={{
                                      padding: "8px 12px",
                                      borderRadius: "6px",
                                      border: "none",
                                      backgroundColor: "#22c55e",
                                      color: "#fff",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      fontSize: "12px",
                                    }}
                                  >
                                    Copy
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDkimRecords(null)}
                      style={{
                        marginTop: "14px",
                        padding: "10px 16px",
                        borderRadius: "8px",
                        border: "1px solid #6b7280",
                        backgroundColor: "#020617",
                        color: "#e5e7eb",
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                    >
                      Change domain / regenerate records
                    </button>
                  </>
                )}
            </div>

            {/* EMAIL PLAN SELECTION CARD */}
            <div
              className="card yellow"
              style={{ marginTop: "36px", padding: "24px" }}
            >
              <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>
                Email Plan Selection
              </h2>
              <p
                style={{
                  fontSize: 15,
                  color: "#ddd",
                  marginBottom: 14,
                }}
              >
                You must select an email plan before proceeding. Choose one below
                or inspect all plans for full details.
              </p>

              {selectedPlan ? (
                <div
                  style={{
                    background: "#14532d",
                    border: "1px solid #22c55e",
                    borderRadius: 8,
                    padding: "12px 18px",
                    color: "#bbf7d0",
                    fontWeight: 600,
                    marginBottom: 24,
                    fontSize: 15,
                  }}
                >
                  ✅ Current Plan: {selectedPlan} —{" "}
                  {planPrice ? `A$${planPrice}/month` : "Custom pricing"}
                </div>
              ) : (
                <div
                  style={{
                    background: "#451a03",
                    border: "1px solid #f59e0b",
                    borderRadius: 8,
                    padding: "12px 18px",
                    color: "#fcd34d",
                    marginBottom: 24,
                    fontSize: 15,
                  }}
                >
                  ⚠️ No plan selected yet
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 120px",
                  rowGap: "12px",
                  alignItems: "center",
                  color: "#fff",
                }}
              >
                {[
                  {
                    id: "starter",
                    name: "Starter",
                    price: 29,
                    desc: "3 lists, 500 subscribers, 1,000 emails/month",
                  },
                  {
                    id: "growth",
                    name: "Growth",
                    price: 75,
                    desc:
                      "5 lists, 2,000 subscribers, 10,000 emails/month",
                  },
                  {
                    id: "expansion",
                    name: "Expansion",
                    price: 250,
                    desc:
                      "Unlimited lists, 15,000 subscribers, 30,000 emails/month",
                  },
                  {
                    id: "enterprise",
                    name: "Enterprise",
                    price: 350,
                    desc:
                      "Unlimited lists, 25,000 subscribers, 100,000 emails/month",
                  },
                  {
                    id: "agency",
                    name: "Agency",
                    price: "Custom",
                    desc:
                      "Unlimited everything, white-label + priority support",
                  },
                ].map((plan) => (
                  <div key={plan.id} style={{ display: "contents" }}>
                    <div style={{ textAlign: "center" }}>
                      <input
                        type="radio"
                        name="emailPlan"
                        checked={selectedPlan === plan.name}
                        onChange={() => {
                          setSelectedPlan(plan.name);
                          setPlanPrice(plan.price);
                        }}
                        style={{
                          width: 24,
                          height: 24,
                          accentColor: "#facc15",
                          cursor: "pointer",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        background:
                          selectedPlan === plan.name
                            ? "rgba(250,204,21,0.1)"
                            : "rgba(255,255,255,0.02)",
                        border: `2px solid ${
                          selectedPlan === plan.name
                            ? "#facc15"
                            : "#1f2937"
                        }`,
                        borderRadius: 8,
                        padding: "14px 18px",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          fontSize: 16,
                          color: "#fff",
                          marginBottom: 4,
                        }}
                      >
                        {plan.name}
                      </strong>
                      <span style={{ fontSize: 14, color: "#bbb" }}>
                        {plan.desc}
                      </span>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#facc15",
                      }}
                    >
                      {plan.price === "Custom"
                        ? "Custom"
                        : `A$${plan.price}/mo`}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  marginTop: 24,
                }}
              >
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { data: userData } = await supabase.auth.getUser();
                      const user = userData?.user;
                      if (!user) {
                        alert("Please log in first.");
                        return;
                      }

                      const {
                        data: accountData,
                        error: accountErr,
                      } = await supabase
                        .from("accounts")
                        .select("id, business_name")
                        .eq("user_id", user.id)
                        .maybeSingle();

                      if (accountErr || !accountData) {
                        throw new Error("No account found for this user.");
                      }

                      const accountId = accountData.id;
                      const accountName = accountData.business_name;

                      const { error: planErr } = await supabase
                        .from("accounts")
                        .update({
                          email_plan: selectedPlan,
                          email_plan_price: planPrice,
                          updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", user.id);

                      if (planErr) throw planErr;

                      const response = await fetch(
                        "/api/connect-sendgrid",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            account_id: accountId,
                            account_name: accountName,
                          }),
                        }
                      );

                      const result = await response.json();

                      if (!response.ok) {
                        const message =
                          typeof result === "object"
                            ? JSON.stringify(result)
                            : result;
                        console.error(
                          "❌ SendGrid key creation failed:",
                          message
                        );
                        alert(`SendGrid setup failed: ${message}`);
                        return;
                      }

                      alert(
                        "✅ Email plan and SendGrid key saved successfully!"
                      );

                      const {
                        data: keyRow,
                        error: keyError,
                      } = await supabase
                        .from("sendgrid_keys")
                        .select("api_key")
                        .eq("account_id", accountId)
                        .maybeSingle();

                      if (keyError)
                        console.error(
                          "⚠️ Error loading key:",
                          keyError.message
                        );
                      if (keyRow?.api_key) {
                        setApiKey(keyRow.api_key);
                        console.log(
                          "🔑 API key loaded into frontend:",
                          keyRow.api_key
                        );
                      } else {
                        console.warn(
                          "⚠️ No API key found in Supabase for this account"
                        );
                      }
                    } catch (err) {
                      console.error(
                        "❌ Error saving plan or creating SendGrid key:",
                        err
                      );
                      alert("❌ Error: " + err.message);
                    }
                  }}
                  style={{
                    background: "#facc15",
                    color: "#000",
                    fontWeight: 800,
                    padding: "12px 24px",
                    borderRadius: 8,
                    flex: 1,
                    maxWidth: 220,
                    cursor: "pointer",
                    fontSize: 15,
                  }}
                >
                  Save Selection
                </button>

                <button
                  type="button"
                  onClick={() =>
                    (window.location.href = "/modules/billing/email-plans")
                  }
                  style={{
                    background: "#1e293b",
                    color: "#fff",
                    padding: "10px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: "800",
                    width: 220,
                    fontSize: 14,
                  }}
                >
                  Inspect Full Plans
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* EMAIL API KEY CARD (conditionally shown) */}
      {!apiKeyHidden && (
        <div
          className="card blue"
          style={{
            marginTop: "36px",
            width: "100%",
            maxWidth: "1080px",
            marginLeft: "auto",
            marginRight: "auto",
            background: "rgba(0, 0, 0, 0.7)",
            padding: "24px",
            borderRadius: "16px",
            border: "2px solid #3b82f6",
          }}
        >
          <h3>
            <span>🔑</span> Email API Key Setup
          </h3>

          {apiKey && (
            <Card className="mt-4 p-4 bg-gray-800 border-green-500">
              <p
                style={{
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                  fontSize: "13px",
                }}
              >
                {apiKey}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                  alert("Key copied to clipboard!");
                  setApiKeyHidden(true);
                }}
                className="btn green-btn mt-3"
              >
                Copy Key
              </button>
            </Card>
          )}
        </div>
      )}

      {/* SAVE CHANGES BUTTON */}
      <div
        style={{
          width: "100%",
          maxWidth: "1080px",
          margin: "40px auto 48px auto",
          textAlign: "center",
        }}
      >
        <button
          type="button"
          onClick={handleSubmit}
          className="btn green-btn"
          style={{
            padding: "16px 34px",
            borderRadius: "10px",
            fontWeight: "900",
            fontSize: "17px",
            cursor: "pointer",
          }}
        >
          {uploading ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #000;
          color: #fff;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 60px 20px;
        }
        .inner {
          width: 100%;
          max-width: 1080px;
        }
        .banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 18px 20px;
          border-radius: 18px;
          margin-bottom: 28px;
        }
        .banner-icon {
          font-size: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .banner-title {
          margin: 0;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 0.02em;
        }
        .purple {
          background: linear-gradient(90deg, #4c1d95, #7c3aed, #a855f7);
          border: 2px solid #a855f7;
        }
        .green {
          background: #22c55e;
          border: 2px solid #16a34a;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        .card {
          padding: 24px 28px;
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.7);
          border: 2px solid transparent;
          margin-bottom: 30px;
        }
        .teal {
          border-color: #14b8a6;
        }
        .yellow {
          border-color: #facc15;
        }
        .blue {
          border-color: #3b82f6;
        }
        .green {
          border-color: #22c55e;
        }
        .magenta {
          border-color: #d946ef;
        }
        label {
          display: flex;
          flex-direction: column;
          margin-bottom: 14px;
          font-size: 16px;
          font-weight: 600;
        }
        input,
        select {
          padding: 12px;
          border-radius: 9px;
          border: 1px solid #444;
          background: #1a2232;
          color: #fff;
          margin-top: 4px;
          font-size: 15px;
          line-height: 1.4;
        }
        input:focus {
          outline: none;
          border-color: #3b82f6;
        }
        .thumb {
          width: 120px;
          height: 120px;
          object-fit: cover;
          border-radius: 10px;
          border: 2px solid #555;
          margin-right: 8px;
        }
        .btn {
          margin-top: 18px;
          padding: 12px 20px;
          border: none;
          border-radius: 10px;
          font-weight: 900;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .green-btn {
          background: #22c55e;
          border: 2px solid #16a34a;
        }
        .green-btn:hover {
          background: #16a34a;
        }
        .check-large input[type="checkbox"] {
          width: 20px;
          height: 20px;
          accent-color: #22c55e;
        }
        .preview-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 12px 0;
        }
      `}</style>
    </Layout>
  );
}
