// /pages/account/index.js

import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { supabase } from "../../utils/supabase-client";
import { useWorkspace } from "../../hooks/useWorkspace";
import Link from "next/link";
import ICONS from "../../components/iconMap";
import { Card } from "../../components/ui/card";

function getPhoneVerifiedStorageKey(userId) {
  return userId ? `gr8:account:phone-verified:${userId}` : "";
}

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
  const router = useRouter();
  const { role, loading: wsLoading } = useWorkspace();

  // Non-owner team members should never see this page — send them to the dashboard.
  useEffect(() => {
    if (!wsLoading && role && role !== "owner") {
      router.replace("/dashboard");
    }
  }, [role, wsLoading, router]);
  // -----------------------------
  // STATE
  // -----------------------------

  const [userId, setUserId] = useState(null);
  const [approved, setApproved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [agreementSigned, setAgreementSigned] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsCodeInput, setSmsCodeInput] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingEmailVerify, setSendingEmailVerify] = useState(false);
  const [checkingEmailVerify, setCheckingEmailVerify] = useState(false);

  // Progressive section unlock
  const [activeSection, setActiveSection] = useState(1);

  // Phone OTP verification (end of section 1)
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeInput, setPhoneCodeInput] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCodeSending, setPhoneCodeSending] = useState(false);
  const [phoneVerifyError, setPhoneVerifyError] = useState("");


  // Hide Email API Key card after copy / if key already exists
  const [apiKeyHidden, setApiKeyHidden] = useState(false);

  // DKIM state
  const [dkimRecords, setDkimRecords] = useState(null);
  const [dkimVerified, setDkimVerified] = useState(false);

  // SMS application state
  const [smsMobile, setSmsMobile] = useState("");
  const [smsEmail, setSmsEmail] = useState("");
  const [smsSenderId, setSmsSenderId] = useState("");
  const [smsApplied, setSmsApplied] = useState(false);
  const [smsApplying, setSmsApplying] = useState(false);

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

  // --- BUCKET CONSTANTS ---
  const BUCKET_PRIVATE = "Private-assets";
  const BUCKET_PUBLIC = "public-assets";

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
        console.log('[AccountPage] Loading account data...');
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
        const isEmailVerified = Boolean(user.email_confirmed_at);
        setEmailVerified(isEmailVerified);
        setForm((p) => ({ ...p, email: user.email || "" }));

        // Auto-unlock sections for returning users who have already verified
        if (isEmailVerified) {
          setActiveSection((prev) => Math.max(prev, 2));
        }


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
        console.log('[AccountPage] Loaded account row:', account);


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
          residentialAddress: account.residential_address || "",
          residentialCity: account.residential_city || "",
          residentialState: account.residential_state || "",
          residentialPostcode: account.residential_postcode || "",
          residentialCountry: account.residential_country || "Australia",
          driverLicenceNumber: account.driver_licence_number || "",
          driverCardNumber: account.driver_card_number || "",
          driverExpiry: account.driver_expiry || "",
          businessName: account.business_name || "",
          businessId: account.abn || account.business_id || "",
          businessCountry: account.business_country || "Australia",
          businessAddress: account.business_address || "",
          businessCity: account.business_city || "",
          businessState: account.business_state || "",
          businessPostcode: account.business_postcode || "",
          postalAddress: account.postal_address || "",
          postalCity: account.postal_city || "",
          postalState: account.postal_state || "",
          postalPostcode: account.postal_postcode || "",
          postalCountry: account.postal_country || "Australia",
          businessPhone: account.business_phone || "",
          businessEmail: account.business_email || "",
          website: account.website || "",
          linkedin: account.linkedin || "",
          taxCountry: account.tax_country || "",
          paypalEmail: account.paypal_email || "",
          bankAccount: account.bank_account || "",
          vendorOptIn: account.vendor === true,
          affiliateOptIn: account.affiliate === true,
          agreeTerms: account.agree_terms === true,
          agreePrivacy: account.agree_privacy === true,

          // DKIM
          dkimDomain: account.dkim_domain || "",
        }));

        // Auto-unlock sections for returning users based on saved data
        if (account.business_name) {
          setActiveSection((prev) => Math.max(prev, 3));
        }
        if (account.agree_terms === true && account.agree_privacy === true) {
          setActiveSection((prev) => Math.max(prev, 4));
        }
        // Log restored form
        console.log('[AccountPage] Restored form state:', {
          residentialAddress: account.residential_address,
          driverLicenceNumber: account.driver_licence_number,
          id_front_url: account.id_front_url,
          id_back_url: account.id_back_url,
          proof_of_address_url: account.proof_of_address_url,
        });

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
            const storagePath = isPrivate ? `Private-assets/${cleanPath}` : `public-assets/${cleanPath}`;
            setPreviews((prev) => ({
              ...prev,
              [key]: { url, type: isPDF ? "pdf" : "image", storagePath },
            }));
            console.log(`[AccountPage] Restored preview for ${key}:`, url);
          } catch (err) {
            console.error(`❌ Error restoring ${key}:`, err.message);
          }
        }

        // Restore all images
        await preview("logo", account.business_logo || account.business_logo_url);
        await preview("avatar", account.business_avatar || account.business_avatar_url);
        await preview("idFront", account.id_front_url);
        await preview("idBack", account.id_back_url);
        await preview("proofAddress", account.proof_of_address_url);
        await preview("registrationDoc", account.registration_doc || account.registration_doc_url);

        // Fallback for older rows where KYC paths are missing/stale on accounts table.
        // Pull latest uploaded files directly from Private-assets folders.
        try {
          const folders = [
            { key: "id-front", state: "idFront" },
            { key: "id-back", state: "idBack" },
            { key: "proof", state: "proofAddress" },
            { key: "registration", state: "registrationDoc" },
          ];

          for (const f of folders) {
            if (previews[f.state]?.url) continue;

            const { data, error } = await supabase.storage
              .from("Private-assets")
              .list(`${user.id}/${f.key}`, {
                limit: 1,
                sortBy: { column: "created_at", order: "desc" },
              });

            if (error || !data?.length) continue;
            const file = data[0];
            const objectPath = `${user.id}/${f.key}/${file.name}`;

            const { data: signed, error: signErr } = await supabase.storage
              .from("Private-assets")
              .createSignedUrl(objectPath, 3600);

            if (signErr || !signed?.signedUrl) continue;

            const isPDF = file.name.toLowerCase().endsWith(".pdf");
            setPreviews((p) => ({
              ...p,
              [f.state]: {
                url: signed.signedUrl,
                type: isPDF ? "pdf" : "image",
                storagePath: `Private-assets/${objectPath}`,
              },
            }));
            console.log(`[AccountPage] Fallback restored preview for ${f.state}:`, objectPath);
          }
        } catch (fallbackErr) {
          console.warn("⚠️ KYC preview fallback restore failed:", fallbackErr.message);
        }

        // Affiliate slug
        if (account.affiliate_slug) setAffiliateTail(account.affiliate_slug);

        // Licence / proof / registration from Private-assets


        // Restore licence metadata from accounts row
        setForm((p) => ({
          ...p,
          driverLicenceNumber: account.driver_licence_number || "",
          driverCardNumber: account.driver_card_number || "",
          driverExpiry: account.driver_expiry || "",
        }));

        // Load SMS application data from profiles first, then accounts fallback
        try {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("sms_mobile, sms_email, sender_id, sms_applied")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!profileError && profile) {
            setSmsMobile(profile.sms_mobile || "");
            setSmsEmail(profile.sms_email || "");
            
            // If profile has sender_id, use it; otherwise try accounts fallback
            if (profile.sender_id) {
              setSmsSenderId(profile.sender_id);
              setSmsApplied(true);
            } else {
              // Fallback: check accounts.sender_id
              try {
                const { data: accountData } = await supabase
                  .from("accounts")
                  .select("sender_id")
                  .eq("user_id", user.id)
                  .maybeSingle();
                
                if (accountData?.sender_id) {
                  setSmsSenderId(accountData.sender_id);
                  setSmsApplied(true);
                } else {
                  setSmsApplied(profile.sms_applied || false);
                }
              } catch (err) {
                console.warn("⚠️ Could not check accounts.sender_id:", err.message);
                setSmsApplied(profile.sms_applied || false);
              }
            }
          }
        } catch (smsErr) {
          console.warn("⚠️ SMS profiles load failed:", smsErr.message);
        }

        try {
          const phoneVerifiedKey = getPhoneVerifiedStorageKey(user.id);
          if (phoneVerifiedKey && typeof window !== "undefined") {
            const storedPhoneVerified = window.localStorage.getItem(phoneVerifiedKey);
            if (storedPhoneVerified === "true") {
              setPhoneVerified(true);
            }
          }
        } catch (storageErr) {
          console.warn("⚠️ Could not restore phone verification state:", storageErr.message);
        }
      } catch (err) {
        console.error("❌ Error loading account:", err);
        // Only show alert if it's not a profiles table error (non-critical SMS feature)
        if (!err.message?.includes("profiles")) {
          alert(
            "❌ Failed to load account details:\n" +
              (err.message || JSON.stringify(err))
          );
        } else {
          console.warn("⚠️ Profiles table unavailable (SMS feature will be limited)");
        }
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
      if (!file) {
        alert(`❌ No file selected for ${name}`);
        return;
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !user.id) {
          alert("❌ You must be logged in. No user ID found.");
          console.error("No user or user.id for upload", user);
          return;
        }
        // Map input names to correct folder names
        const folderMap = {
          idFront: "id-front",
          idBack: "id-back",
          proofAddress: "proof",
          registrationDoc: "registration",
          logo: "logos",
          avatar: "avatars"
        };
        const folder = folderMap[name] || name;
        const PrivateFolders = ["id-front", "id-back", "proof", "registration"];
        const isPrivate = PrivateFolders.includes(folder);
        // FORCE: Always use 'Private-assets' for private files (case-sensitive)
        const bucket = isPrivate ? "Private-assets" : BUCKET_PUBLIC;
        const ext = file.name.split(".").pop();
        const timestamp = Date.now();
        const path = `${user.id}/${folder}/${timestamp}.${ext}`;
        console.log(`Uploading ${name} to ${bucket}/${path}`);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError || !uploadData) {
          alert(`❌ Upload failed for ${name}: ${uploadError?.message || 'Unknown error'}`);
          console.error(`Upload failed for ${name}:`, uploadError);
          return;
        }
        // Use the exact path returned by Supabase
        const savedPath = uploadData.path ? `${bucket}/${uploadData.path}` : `${bucket}/${path}`;
        // Get URL for preview
        let url = null;
        if (isPrivate) {
          const { data: signed, error: signedErr } = await supabase.storage
            .from(bucket)
            .createSignedUrl(uploadData.path, 3600);
          if (signedErr) {
            alert(`❌ Signed URL failed for ${name}: ${signedErr.message}`);
            console.error(`Signed URL failed for ${name}:`, signedErr);
            return;
          }
          url = signed?.signedUrl;
        } else {
          const { data: pub } = supabase.storage
            .from(bucket)
            .getPublicUrl(uploadData.path);
          url = pub?.publicUrl;
        }
        setPreviews((prev) => ({
          ...prev,
          [name]: {
            url,
            type: file.type.includes("pdf") ? "pdf" : "image",
            storagePath: savedPath,
          },
        }));
        // Log both returned and saved path for debug
        console.log(`Supabase returned path for ${name}:`, uploadData.path);
        console.log(`Storage path saved for ${name}:`, savedPath);
      } catch (err) {
        alert(`❌ Upload error for ${name}: ${err.message}`);
        console.error(`❌ Upload error for ${name}:`, err);
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
      // ID and proof images
      // ...existing code...
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
      // Debug: Log files and user
      console.log("Submitting account form");
      console.log("User:", user);
      console.log("Files:", files);

      const hasIdFront = files.idFront || previews.idFront?.url;
      const hasIdBack = files.idBack || previews.idBack?.url;
      const hasProof = files.proofAddress || previews.proofAddress?.url;
      if (!hasIdFront || !hasIdBack || !hasProof) {
        alert("❌ Please select all required ID and proof files before submitting.");
        setUploading(false);
        return;
      }


      const uploads = await Promise.all([
        uploadToStorage(files.logo, "logo"),
        uploadToStorage(files.avatar, "avatar"),
        uploadToStorage(files.idFront, "id-front"),
        uploadToStorage(files.idBack, "id-back"),
        uploadToStorage(files.proofAddress, "proof"),
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

      // Debug: Log upload results
      console.log("Upload results:", uploads);

      // Always use the latest uploaded storage path if present, fallback to preview.storagePath, else null

      function getKycStoragePath(uploaded, preview, label) {
        if (uploaded) {
          console.log(`✅ Using uploaded KYC path for ${label}:`, uploaded);
          return uploaded;
        }
        if (preview?.storagePath) {
          console.log(`⚠️ Using preview.storagePath for ${label}:`, preview.storagePath);
          return preview.storagePath;
        }
        if (preview?.url) {
          console.log(`⚠️ Using preview.url for ${label}:`, preview.url);
          return preview.url;
        }
        console.warn(`❌ No KYC path found for ${label}`);
        return null;
      }

      const idFrontStorage = getKycStoragePath(idFrontUrl, previews.idFront, "id_front_url");
      const idBackStorage = getKycStoragePath(idBackUrl, previews.idBack, "id_back_url");
      const proofStorage = getKycStoragePath(proofUrl, previews.proofAddress, "proof_of_address_url");
      const registrationStorage = getKycStoragePath(regDocUrl, previews.registrationDoc, "registration_doc");

      function getOptionalStoragePath(uploaded, preview, existingValue, label) {
        if (uploaded) return uploaded;
        if (preview?.storagePath) return preview.storagePath;
        if (existingValue) return existingValue;
        console.warn(`⚠️ Optional file path missing for ${label}`);
        return null;
      }

      const asNullableDate = (v) => {
        const s = String(v ?? "").trim();
        return s ? s : null;
      };

      // If any required KYC field is missing, block submit
      if (!idFrontStorage || !idBackStorage || !proofStorage) {
        alert("❌ Upload failed for one or more required files. Please try again. [KYC fields missing]");
        setUploading(false);
        return;
      }

      const payload = {
        user_id: user.id,
        full_name: form.fullName,
        dob: asNullableDate(form.dob),
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
        driver_expiry: asNullableDate(form.driverExpiry),
        business_name: form.businessName,
        abn: form.businessId,
        business_id: form.businessId,
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
        business_logo: getOptionalStoragePath(logoUrl, previews.logo, null, "business_logo"),
        business_logo_url: getOptionalStoragePath(logoUrl, previews.logo, null, "business_logo_url"),
        business_avatar: getOptionalStoragePath(avatarUrl, previews.avatar, null, "business_avatar"),
        business_avatar_url: getOptionalStoragePath(avatarUrl, previews.avatar, null, "business_avatar_url"),
        affiliate_slug: affiliateTail || null,

        // ID and proof images (ALWAYS persist correct storage path)
        id_front_url: idFrontStorage,
        id_back_url: idBackStorage,
        proof_of_address_url: proofStorage,
        registration_doc: registrationStorage,
        registration_doc_url: registrationStorage,

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
      const isFirstSubmission = !existing;
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
        // Only first submission should send admin-notification email and show onboarding modal.
        if (isFirstSubmission) {
          try {
            await fetch("/api/account/application-received", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id, email: form.email, name: form.fullName }),
            });
          } catch (_) {}
          setShowApprovalModal(true);
        }
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
          {/* Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderRadius: '14px',
            background: 'linear-gradient(90deg, #4c1d95, #7c3aed, #a855f7)',
            border: '2px solid #a855f7',
            marginBottom: '28px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {ICONS.account && typeof ICONS.account === 'function' ? ICONS.account({ size: 48 }) : ICONS.account}
              <div>
                <h1 style={{ fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.1 }}>Account Details</h1>
                <p style={{ fontSize: 18, margin: 0, opacity: 0.9, marginTop: 4 }}>Manage your profile, business details, and platform settings</p>
              </div>
            </div>
            <Link href="/dashboard">
              <button style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}>← Back to Dashboard</button>
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="form">
            {/* CONTACT INFORMATION */}
            <div className="card teal">
              <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 20, color: '#14b8a6' }}>Personal & Contact Information</h2>
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

              {/* Residential Address Details */}
              <label>
                Residential Address
                <input
                  name="residentialAddress"
                  value={form.residentialAddress}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Residential City
                <input
                  name="residentialCity"
                  value={form.residentialCity}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Residential State
                <input
                  name="residentialState"
                  value={form.residentialState}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Residential Postcode
                <input
                  name="residentialPostcode"
                  value={form.residentialPostcode}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Residential Country
                <input
                  name="residentialCountry"
                  value={form.residentialCountry}
                  onChange={handleChange}
                  required
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 16 }}>
                  <h4 style={{ color: '#facc15', marginBottom: 4 }}>Licence Front</h4>
                  {previews.idFront?.url ? (
                    <img src={previews.idFront.url} className="thumb" alt="Licence Front" />
                  ) : (
                    <div style={{ color: '#999', fontSize: '13px' }}>No licence front uploaded yet</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 16 }}>
                  <h4 style={{ color: '#facc15', marginBottom: 4 }}>Licence Back</h4>
                  {previews.idBack?.url ? (
                    <img src={previews.idBack.url} className="thumb" alt="Licence Back" />
                  ) : (
                    <div style={{ color: '#999', fontSize: '13px' }}>No licence back uploaded yet</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h4 style={{ color: '#facc15', marginBottom: 4 }}>Proof of Address</h4>
                  {previews.proofAddress?.url ? (
                    <img src={previews.proofAddress.url} className="thumb" alt="Proof of Address" />
                  ) : (
                    <div style={{ color: '#999', fontSize: '13px' }}>No proof uploaded yet</div>
                  )}
                </div>
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

              {/* ===== SECTION 1 VERIFICATION ===== */}
              <div style={{ marginTop: 28, borderTop: "1px solid rgba(20,184,166,0.3)", paddingTop: 24 }}>

                {/* Email Verification */}
                <div
                  style={{
                    padding: "20px",
                    borderRadius: 12,
                    border: `2px solid ${emailVerified ? "#22c55e" : "#f59e0b"}`,
                    background: emailVerified ? "rgba(34,197,94,0.07)" : "rgba(245,158,11,0.07)",
                    marginBottom: 20,
                  }}
                >
                  <h4 style={{ color: emailVerified ? "#22c55e" : "#f59e0b", marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
                    {emailVerified ? "✅ Email Verified" : "📧 Step 1 — Verify Your Email"}
                  </h4>
                  <p style={{ color: "#e2e8f0", fontSize: 16, marginBottom: emailVerified ? 0 : 14 }}>
                    {emailVerified
                      ? `Email verified: ${form.email}`
                      : <>We'll send a verification link to <strong>{form.email || "your email"}</strong>. Click the link to confirm your address.</>}
                  </p>

                  {!emailVerified && (
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!form.email?.trim()) {
                            alert("No email found on your account.");
                            return;
                          }
                          setSendingEmailVerify(true);
                          try {
                            const { error } = await supabase.auth.resend({
                              type: "signup",
                              email: form.email.trim(),
                              options: { emailRedirectTo: `${window.location.origin}/account` },
                            });
                            if (error) throw error;
                            alert("✅ Verification email sent! Check your inbox and click the link, then come back here.");
                          } catch (err) {
                            alert("❌ Failed to send verification email: " + err.message);
                          } finally {
                            setSendingEmailVerify(false);
                          }
                        }}
                        disabled={sendingEmailVerify}
                        style={{
                          padding: "10px 18px", borderRadius: 999, border: "none",
                          background: "#f59e0b", color: "#111827", fontWeight: 600,
                          cursor: sendingEmailVerify ? "not-allowed" : "pointer",
                          opacity: sendingEmailVerify ? 0.65 : 1,
                        }}
                      >
                        {sendingEmailVerify ? "Sending..." : "Send Verification Email"}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setCheckingEmailVerify(true);
                          try {
                            const { data: { user }, error } = await supabase.auth.getUser();
                            if (error) throw error;
                            const verified = Boolean(user?.email_confirmed_at);
                            setEmailVerified(verified);
                            if (verified) {
                              alert("✅ Email verified! Now verify your phone number below.");
                            } else {
                              alert("⚠️ Not verified yet. Click the link in your email first, then check again.");
                            }
                          } catch (err) {
                            alert("❌ Could not check: " + err.message);
                          } finally {
                            setCheckingEmailVerify(false);
                          }
                        }}
                        disabled={checkingEmailVerify}
                        style={{
                          padding: "10px 18px", borderRadius: 999,
                          border: "1px solid #60a5fa", background: "rgba(59,130,246,0.12)",
                          color: "#bfdbfe", fontWeight: 600,
                          cursor: checkingEmailVerify ? "not-allowed" : "pointer",
                          opacity: checkingEmailVerify ? 0.65 : 1,
                        }}
                      >
                        {checkingEmailVerify ? "Checking..." : "I've Verified My Email"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Phone SMS Verification — only shows after email verified */}
                {emailVerified && (
                  <div
                    style={{
                      padding: "20px",
                      borderRadius: 12,
                      border: `2px solid ${phoneVerified ? "#22c55e" : "#3b82f6"}`,
                      background: phoneVerified ? "rgba(34,197,94,0.07)" : "rgba(59,130,246,0.07)",
                      marginBottom: 20,
                    }}
                  >
                    <h4 style={{ color: phoneVerified ? "#22c55e" : "#3b82f6", marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
                      {phoneVerified ? "✅ Phone Verified" : "📱 Step 2 — Verify Your Phone"}
                    </h4>
                    {!phoneVerified && (
                      <>
                        <p style={{ color: "#e2e8f0", fontSize: 16, marginBottom: 14 }}>
                          We'll send a 6-digit code via SMS to <strong>{form.phone || "your phone number"}</strong>.
                        </p>
                        {!phoneCodeSent ? (
                          <button
                            type="button"
                            disabled={!form.phone?.trim() || phoneCodeSending}
                            onClick={async () => {
                              if (!form.phone?.trim()) {
                                alert("Please enter your phone number above first.");
                                return;
                              }
                              setPhoneCodeSending(true);
                              setPhoneVerifyError("");
                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                const token = session?.access_token || "";
                                const res = await fetch("/api/account/send-phone-otp", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                                  body: JSON.stringify({ phone: form.phone.trim() }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Failed to send SMS");
                                setPhoneCodeSent(true);
                                setPhoneCodeInput("");
                              } catch (err) {
                                setPhoneVerifyError("❌ " + err.message);
                              } finally {
                                setPhoneCodeSending(false);
                              }
                            }}
                            style={{
                              padding: "10px 18px", borderRadius: 999, border: "none",
                              background: "#3b82f6", color: "#fff", fontWeight: 600,
                              cursor: (!form.phone?.trim() || phoneCodeSending) ? "not-allowed" : "pointer",
                              opacity: (!form.phone?.trim() || phoneCodeSending) ? 0.65 : 1,
                            }}
                          >
                            {phoneCodeSending ? "Sending SMS..." : "Send SMS Code"}
                          </button>
                        ) : (
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              type="text"
                              placeholder="Enter 6-digit code"
                              value={phoneCodeInput}
                              onChange={(e) => setPhoneCodeInput(e.target.value)}
                              style={{
                                padding: "10px 14px", borderRadius: 8, border: "2px solid #3b82f6",
                                background: "#1a2232", color: "#e2e8f0", fontSize: 16, width: 180,
                              }}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                setPhoneVerifyError("");
                                try {
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const token = session?.access_token || "";
                                  const res = await fetch("/api/account/verify-phone-otp", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                                    body: JSON.stringify({ code: phoneCodeInput.trim() }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok || !data.ok) throw new Error(data.error || "Incorrect code. Please try again.");
                                  setPhoneVerified(true);
                                  try {
                                    const { data: { user } } = await supabase.auth.getUser();
                                    const phoneVerifiedKey = getPhoneVerifiedStorageKey(user?.id);
                                    if (phoneVerifiedKey && typeof window !== "undefined") {
                                      window.localStorage.setItem(phoneVerifiedKey, "true");
                                    }
                                  } catch (storageErr) {
                                    console.warn("Could not persist phone verification state:", storageErr?.message || storageErr);
                                  }
                                  setPhoneCodeInput("");
                                  setActiveSection((prev) => Math.max(prev, 2));
                                } catch (err) {
                                  setPhoneVerifyError("❌ " + (err.message || "Incorrect code. Please try again."));
                                }
                              }}
                              style={{
                                padding: "10px 18px", borderRadius: 999, border: "none",
                                background: "#22c55e", color: "#fff", fontWeight: 600, cursor: "pointer",
                              }}
                            >
                              Verify Code
                            </button>
                            <button
                              type="button"
                              onClick={() => { setPhoneCodeSent(false); setPhoneCodeInput(""); setPhoneVerifyError(""); }}
                              style={{
                                padding: "10px 14px", borderRadius: 999,
                                border: "1px solid #6b7280", background: "transparent",
                                color: "#9ca3af", fontSize: 16, cursor: "pointer",
                              }}
                            >
                              Resend
                            </button>
                          </div>
                        )}
                        {phoneVerifyError && (
                          <p style={{ color: "#f87171", fontSize: 16, marginTop: 8 }}>{phoneVerifyError}</p>
                        )}
                      </>
                    )}
                    {phoneVerified && (
                      <div>
                        <p style={{ color: "#bbf7d0", fontSize: 16, marginBottom: 6 }}>Phone number {form.phone} has been verified.</p>
                        <p style={{ color: "#93c5fd", fontSize: 16, margin: 0 }}>
                          This only verifies your phone for onboarding. SMS sending still needs the separate SMS Activation step and access code below.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Continue button — only unlocks after both verified */}
                {emailVerified && phoneVerified && activeSection < 2 && (
                  <button
                    type="button"
                    onClick={() => setActiveSection(2)}
                    style={{
                      width: "100%", padding: "16px", borderRadius: 12, border: "none",
                      background: "linear-gradient(90deg, #14b8a6, #0891b2)",
                      color: "#fff", fontSize: 18, fontWeight: 600, cursor: "pointer",
                      letterSpacing: 0.5,
                    }}
                  >
                    Continue to Business Information →
                  </button>
                )}
              </div>
            </div>

            {activeSection >= 2 && (
            <div className="card yellow">
              <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 20, color: '#facc15' }}>Business Information</h2>

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
                  <div style={{ color: "#999", fontSize: "16px" }}>
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
                  <div style={{ color: "#999", fontSize: "16px" }}>
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

              {/* Business Address Details */}
              <label>
                Business Address
                <input
                  name="businessAddress"
                  value={form.businessAddress}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Business City
                <input
                  name="businessCity"
                  value={form.businessCity}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Business State
                <input
                  name="businessState"
                  value={form.businessState}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Business Postcode
                <input
                  name="businessPostcode"
                  value={form.businessPostcode}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Business Country
                <input
                  name="businessCountry"
                  value={form.businessCountry}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Website
                <input
                  name="website"
                  value={form.website}
                  onChange={handleChange}
                />
              </label>

              {activeSection < 3 && (
                <button
                  type="button"
                  onClick={() => setActiveSection(3)}
                  style={{
                    marginTop: 24, width: "100%", padding: "16px", borderRadius: 12, border: "none",
                    background: "linear-gradient(90deg, #d97706, #f59e0b)",
                    color: "#111827", fontSize: 18, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Continue to Agreements →
                </button>
              )}
            </div>
            )}

            {activeSection >= 3 && (
            <div className="card green">
              <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 20, color: '#22c55e' }}>Agreements</h2>
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
                  Terms and Conditions
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

              {activeSection < 4 && (
                <button
                  type="button"
                  onClick={() => setActiveSection(4)}
                  style={{
                    marginTop: 24, width: "100%", padding: "16px", borderRadius: 12, border: "none",
                    background: "linear-gradient(90deg, #15803d, #22c55e)",
                    color: "#fff", fontSize: 18, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Continue to Account Setup →
                </button>
              )}
            </div>
            )}

            {activeSection >= 4 && (<>
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
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "28px",
                  fontWeight: 600,
                  color: "#3b82f6",
                  marginBottom: "16px",
                }}
              >
                <span>📱</span> SMS Account Setup
              </h3>

              {/* SMS Active - Show success */}
              {smsSenderId ? (
                <div
                  style={{
                    padding: "20px",
                    borderRadius: 12,
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "2px solid #22c55e",
                  }}
                >
                  <p style={{ color: "#bbf7d0", fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
                    ✅ SMS Account Active
                  </p>
                  <p style={{ color: "#e2e8f0", fontSize: 16, marginBottom: 8 }}>
                    Your SMSGlobal Sender ID: <strong style={{ color: "#22c55e" }}>{smsSenderId}</strong>
                  </p>
                  <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.5 }}>
                    💡 Want a dedicated number? You can add a dedicated SMS number for <strong>$35/month</strong>. Contact support.
                  </p>
                </div>
              ) : (
                <>
                  {!emailVerified ? (
                    <div
                      style={{
                        padding: "16px 20px",
                        borderRadius: 10,
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "2px solid #f59e0b",
                      }}
                    >
                      <p style={{ color: "#fde68a", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
                        ⚠️ Verify email first
                      </p>
                      <p style={{ color: "#e2e8f0", fontSize: 16, margin: 0 }}>
                        Go to the Personal Information section above, send/complete email verification,
                        then return here to continue SMS setup.
                      </p>
                    </div>
                  ) : (
                    <>
                  {/* Instructions */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ color: "#e2e8f0", lineHeight: "1.6", fontSize: 18, fontWeight: 500, marginBottom: 12 }}>
                      <strong>Step 1:</strong> Submit your application below and we'll create your SMS account. (Note, this is a pooled number system)
                    </p>
                    <p style={{ color: "#e2e8f0", lineHeight: "1.6", fontSize: 18, fontWeight: 500, marginBottom: 12 }}>
                      <strong>Step 2:</strong> We'll email you your own private access code so your messages say where they have come from.
                    </p>
                    <p style={{ color: "#e2e8f0", lineHeight: "1.6", fontSize: 18, fontWeight: 500, marginBottom: 16 }}>
                      <strong>Step 3:</strong> Come back here and enter your code when you get our email to activate your SMS sending.
                    </p>
                    <div style={{ 
                      padding: "12px 16px", 
                      borderRadius: 8, 
                      background: "rgba(59, 130, 246, 0.1)",
                      borderLeft: "4px solid #3b82f6",
                      marginBottom: 20
                    }}>
                      <p style={{ color: "#93c5fd", fontSize: 16, margin: 0, lineHeight: 1.5 }}>
                        💡 Do you need your own dedicated SMS number? You can add one for <strong>$35/month</strong> — order one when you complete the billing page!                    </p>
                    </div>
                  </div>

                  {/* Application Form */}
                  {!smsApplied ? (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "6px",
                            fontWeight: "600",
                            color: "#e2e8f0",
                            fontSize: 20,
                          }}
                        >
                          Mobile Number *
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. 0412 345 678"
                          value={smsMobile}
                          onChange={(e) => setSmsMobile(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "1px solid #3b82f6",
                            backgroundColor: "#1a2232",
                            color: "#e2e8f0",
                            fontSize: "20px",
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "6px",
                            fontWeight: "600",
                            color: "#e2e8f0",
                            fontSize: 20,
                          }}
                        >
                          Preferred Email *
                        </label>
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={smsEmail}
                          onChange={(e) => setSmsEmail(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "1px solid #3b82f6",
                            backgroundColor: "#1a2232",
                            color: "#e2e8f0",
                            fontSize: "20px",
                          }}
                        />
                        <p style={{ fontSize: 16, color: "#9ca3af", marginTop: 6 }}>
                          We'll send your access code to this email address
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!smsMobile || !smsEmail) {
                            alert("Please enter both mobile number and email");
                            return;
                          }

                          setSmsApplying(true);
                          try {
                            const {
                              data: { user },
                            } = await supabase.auth.getUser();
                            if (!user) throw new Error("Not logged in");

                            const res = await fetch("/api/sms/apply", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                userId: user.id,
                                mobile: smsMobile,
                                email: smsEmail,
                              }),
                            });

                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error);

                            setSmsApplied(true);
                            alert("✅ " + data.message);
                          } catch (err) {
                            alert("❌ Error: " + err.message);
                          } finally {
                            setSmsApplying(false);
                          }
                        }}
                        disabled={smsApplying}
                        style={{
                          padding: "14px 32px",
                          borderRadius: 999,
                          border: "none",
                          background: "#3b82f6",
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: 600,
                          cursor: smsApplying ? "not-allowed" : "pointer",
                          opacity: smsApplying ? 0.6 : 1,
                        }}
                      >
                        {smsApplying ? "Submitting..." : "📤 Submit Application"}
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Application Submitted - Show Code Entry */}
                      <div
                        style={{
                          padding: "16px 20px",
                          borderRadius: 10,
                          background: "rgba(34, 197, 94, 0.1)",
                          border: "2px solid #22c55e",
                          marginBottom: 24,
                        }}
                      >
                        <p style={{ color: "#bbf7d0", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
                          ✅ Application Submitted!
                        </p>
                        <p style={{ color: "#e2e8f0", fontSize: 16 }}>
                          Check <strong>{smsEmail}</strong> for your access code (usually within 24 hours).
                        </p>
                      </div>

                      {/* Code Entry Section */}
                      <div
                        style={{
                          padding: "20px",
                          borderRadius: 12,
                          background: "rgba(59, 130, 246, 0.05)",
                          border: "2px solid #3b82f6",
                        }}
                      >
                        <h4 style={{ color: "#3b82f6", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                          🔑 Enter Your Access Code
                        </h4>
                        <p style={{ color: "#e2e8f0", fontSize: 16, marginBottom: 16, lineHeight: 1.5 }}>
                          Once you receive your access code via email, enter it below to activate SMS sending.
                        </p>
                        <div style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "rgba(14,165,233,0.12)",
                          border: "1px solid rgba(56,189,248,0.35)",
                          color: "#bae6fd",
                          fontSize: 16,
                          marginBottom: 14,
                          lineHeight: 1.5,
                        }}>
                          Phone verification and SMS activation are different steps. Verifying your phone does not set your SMS sender name. This access code is what fills your sender ID for the SMS pages.
                        </div>
                        
                        <label
                          style={{
                            display: "block",
                            marginBottom: "8px",
                            fontWeight: "600",
                            color: "#e2e8f0",
                            fontSize: 16,
                          }}
                        >
                          Access Code / Sender ID *
                        </label>
                        <div style={{ display: "flex", gap: 12 }}>
                          <input
                            type="text"
                            placeholder="Code from email"
                            value={smsCodeInput}
                            onChange={(e) => setSmsCodeInput(e.target.value)}
                            style={{
                              flex: 1,
                              padding: "14px",
                              borderRadius: "10px",
                              border: "2px solid #3b82f6",
                              backgroundColor: "#1a2232",
                              color: "#e2e8f0",
                              fontSize: "16px",
                              fontWeight: 500,
                            }}
                          />

                          <button
                            type="button"
                            onClick={async () => {
                              if (!smsCodeInput.trim()) {
                                alert("Please enter your access code");
                                return;
                              }

                              try {
                                const {
                                  data: { user },
                                } = await supabase.auth.getUser();
                                if (!user) throw new Error("Not logged in");

                                const cleanCode = smsCodeInput.trim();

                                // Save to profiles (try but don't fail if table doesn't exist)
                                try {
                                  await supabase
                                    .from("profiles")
                                    .upsert(
                                      {
                                        user_id: user.id,
                                        sender_id: cleanCode,
                                        sms_applied: true,
                                      },
                                      { onConflict: "user_id" }
                                    );
                                } catch (profileErr) {
                                  console.warn("Could not save to profiles:", profileErr.message);
                                }

                                // ALSO persist to accounts.sender_id (SMS endpoints rely on this field).
                                // Update first, and if no row exists, insert a minimal row.
                                const { data: updatedRows, error: accountUpdateError } = await supabase
                                  .from("accounts")
                                  .update({
                                    sender_id: cleanCode,
                                    updated_at: new Date().toISOString(),
                                  })
                                  .eq("user_id", user.id)
                                  .select("id,user_id,sender_id");

                                if (accountUpdateError) throw accountUpdateError;

                                if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
                                  const { error: accountInsertError } = await supabase
                                    .from("accounts")
                                    .insert({
                                      user_id: user.id,
                                      sender_id: cleanCode,
                                      email: user.email || form.email || null,
                                      business_name: form.businessName || null,
                                      updated_at: new Date().toISOString(),
                                    });
                                  if (accountInsertError) throw accountInsertError;
                                }
                                
                                // Update state to show success immediately
                                setSmsApplied(true);
                                setSmsSenderId(cleanCode);
                                setSmsCodeInput("");
                                
                                alert("✅ SMS activated! You can now send SMS messages from " + cleanCode);
                              } catch (err) {
                                alert("❌ Error saving SMS code: " + err.message);
                              }
                            }}
                            style={{
                              padding: "14px 28px",
                              borderRadius: 999,
                              border: "none",
                              background: "#22c55e",
                              color: "#fff",
                              fontSize: 16,
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🚀 Activate SMS
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* ===========================
            �📬 DKIM + SPF DNS Setup
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
                  fontSize: "28px",
                  fontWeight: 600,
                  color: "#d946ef",
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
                      fontSize: 16,
                      fontWeight: 600,
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
                      fontSize: 16,
                      fontWeight: 600,
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
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  ✓ Check verification
                </button>
              </div>

              <p style={{ color: "#e2e8f0", lineHeight: "1.6", fontSize: 16, fontWeight: 400 }}>
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
                      fontSize: "16px",
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
                      fontWeight: "600",
                      backgroundColor: "#22c55e",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                      fontSize: 16,
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
                        fontSize: "16px",
                        fontWeight: "600",
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
                          fontSize: "16px",
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
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontSize: "16px",
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
                        fontSize: "16px",
                        cursor: "pointer",
                      }}
                    >
                      Change domain / regenerate records
                    </button>
                  </>
                )}
            </div>

            </>)}
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
          <h3 style={{ fontSize: 28, fontWeight: 600, marginBottom: 16, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔑</span> Email API Key Setup
          </h3>

          {apiKey && (
            <Card className="mt-4 p-4 bg-gray-800 border-green-500">
              <p
                style={{
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                  fontSize: "16px",
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
            fontWeight: "600",
            fontSize: "17px",
            cursor: "pointer",
          }}
        >
          {uploading ? "Saving..." : "Save Changes"}
        </button>
        {/* Stripe Connect button (if not connected) */}
        {!submitted && (
          <button
            type="button"
            className="btn green-btn"
            style={{
              marginTop: 18,
              padding: "16px 34px",
              borderRadius: "10px",
              fontWeight: "600",
              fontSize: "17px",
              cursor: "pointer",
              background: "#635bff",
              border: "2px solid #635bff",
            }}
            onClick={async () => {
              try {
                const { data: userData } = await supabase.auth.getUser();
                const user = userData?.user;
                if (!user) return alert("You must be logged in.");
                const connectRes = await fetch("/api/stripe/create-connect-link", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: user.id }),
                });
                const connectData = await connectRes.json();
                if (connectRes.ok && connectData.url) {
                  window.location.href = connectData.url;
                } else {
                  alert("Stripe Connect setup failed.");
                }
              } catch (err) {
                alert("Stripe Connect setup failed.");
              }
            }}
          >
            Connect with Stripe
          </button>
        )}
      </div>

      {/* APPROVAL PENDING MODAL */}
      {showApprovalModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }}>
          <div style={{
            background: "#0b1220",
            border: "2px solid #a855f7",
            borderRadius: 16,
            padding: "40px 36px",
            maxWidth: 520,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 8px 48px rgba(168,85,247,0.25)",
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: "#a855f7", fontSize: 26, fontWeight: 600, marginBottom: 12 }}>
              Application Submitted!
            </h2>
            <p style={{ color: "#e2e8f0", fontSize: 16, lineHeight: 1.7, marginBottom: 8 }}>
              Your account application has been sent to our admins for review.
            </p>
            <p style={{ color: "#e2e8f0", fontSize: 16, lineHeight: 1.7, marginBottom: 24 }}>
              You will receive an email at <strong style={{ color: "#a855f7" }}>{form.email}</strong> once your account has been approved.
            </p>
            <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 28 }}>
              This usually takes 1–2 business days. No further action is needed from you right now.
            </p>
            <button
              onClick={() => setShowApprovalModal(false)}
              style={{
                padding: "12px 32px",
                borderRadius: 999,
                border: "none",
                background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              OK, Got It
            </button>
          </div>
        </div>
      )}

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
          font-size: 16px;
          font-weight: 400;
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
