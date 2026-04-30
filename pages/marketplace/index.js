import { sendSmsGlobal } from "../../lib/smsglobal";
import { supabase } from "../../utils/supabase-client";
import { useEffect, useState } from "react";
import { useRef } from "react";
import { Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AffiliateProductCard from "./AffiliateProductCard";


function AffiliateNotice({ approved, affiliateUserId, userEmail, userName }) {
  // Always show user name and email, even if missing (show placeholder)
  const isApprovedAffiliate = approved && affiliateUserId;
  return (
    <div style={{
      background: isApprovedAffiliate ? '#22c55e' : '#ff0505',
      color: isApprovedAffiliate ? '#222' : '#fff',
      borderRadius: 10,
      padding: '16px 24px',
      fontWeight: 600,
      fontSize: 18,
      margin: '24px 0',
      textAlign: 'center',
      border: isApprovedAffiliate ? '2px solid #15803d' : '2px solid #f30707',
      boxShadow: isApprovedAffiliate ? '0 2px 8px 0 rgba(34,197,94,0.10)' : '0 2px 8px 0 rgba(220,38,38,0.10)'
    }}>
      <span style={{ fontSize: 22, fontWeight: 600 }}>
        {isApprovedAffiliate ? '✅ Affiliate Approved!' : '❗You need to complete an Affiliate Application and confirm your email before applying for these offers.'}
      </span>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#faf603' }}>
          {userName ? userName : '[No Name Found]'}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#17f2fa' }}>
          {userEmail ? userEmail : '[No Email Found]'}
        </div>
        {(!userName || !userEmail) && (
          <div style={{ marginTop: 8 }}>

          </div>
        )}
      </div>
      {isApprovedAffiliate && (
        <>
          <div style={{ marginTop: 10 }}>
            You can now promote offers and earn commission.
          </div>
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 600 }}>
              Your Affiliate Cookie Code:
            </span>
          </div>
          <div style={{
            fontFamily: 'monospace',
            background: '#d1fae5',
            padding: '6px 12px',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 20,
            color: '#166534',
            display: 'inline-block',
            marginTop: 6
          }}>
            {affiliateUserId}
          </div>
        </>
      )}
    </div>
  );
}

export default function PublicMarketplace() {
  const router = useRouter();
  // Email verification modal state
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [userEmailVerified, setUserEmailVerified] = useState(true); // Default true for existing users
  // Debug state for affiliate status
  const [affiliateDebug, setAffiliateDebug] = useState({ data: null, error: null, userCode: '' });
  const [userCode, setUserCode] = useState('');
  const [userVerified, setUserVerified] = useState(false);
  const [authUser, setAuthUser] = useState(null);

// Capture affiliate referral from URL and record click
useEffect(() => {

  async function captureAffiliate() {

    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");

    if (!ref) {
      console.log("No affiliate ref in URL");
      return;
    }

    console.log("Affiliate ref found:", ref);

    const { data, error } = await supabase
      .from("affiliate_applications")
      .select("affiliate_user_id")
      .eq("affiliate_id", ref)
      .eq("status", "approved")
      .maybeSingle();

    if (error || !data) {
      console.log("Affiliate lookup failed:", error);
      return;
    }

    const affiliateUserId = data.affiliate_user_id;

    console.log("Affiliate UUID:", affiliateUserId);

    const expires = new Date();
    expires.setDate(expires.getDate() + 90);

    document.cookie =
      "gr8_aff_ref=" +
      ref +
      "; expires=" +
      expires.toUTCString() +
      "; path=/";

    console.log("Cookie saved");

    const { error: insertError } = await supabase
      .from("affiliate_clicks")
        .insert({
          affiliate_user_id: affiliateUserId,
          product_id: realProductId,
          status: 'pending'
        });

    if (insertError) {
      console.error("Insert failed:", insertError);
    } else {
      console.log("Affiliate click recorded");
    }

  }

  captureAffiliate();

}, []);



  // User info state
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');

  // Vendor dashboard access state
  const [isVendor, setIsVendor] = useState(false);
  const [vendorApproved, setVendorApproved] = useState(false);
  // Track auth user (for robust vendor check)
  const [authUserId, setAuthUserId] = useState(null);

  // Get Supabase auth user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthUserId(user?.id || null);
    });
  }, []);

  // Check vendor status by resolved user id (marketplace user id first, auth user id fallback)
useEffect(() => {
  async function checkVendor() {
      const resolvedUserId = userId || authUserId;
      if (!resolvedUserId) {
      setIsVendor(false);
      setVendorApproved(false);
      return;
    }

      const { data: agreementRows, error: agreementError } = await supabase
        .from('vendor_agreements')
        .select('id')
        .eq('user_id', resolvedUserId)
        .eq('verified', true)
        .limit(1);

      const { data: vendorRows, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', resolvedUserId)
        .limit(1);

      const hasVerifiedAgreement = Array.isArray(agreementRows) && agreementRows.length > 0;
      const hasVendorRecord = Array.isArray(vendorRows) && vendorRows.length > 0;

      console.log("Vendor check by resolved user_id:", {
        resolvedUserId,
        authUserId,
        userId,
        hasVerifiedAgreement,
        hasVendorRecord,
        agreementError,
        vendorError,
      });

    const approved = hasVerifiedAgreement || hasVendorRecord;

    setIsVendor(approved);
    setVendorApproved(approved);
  }

  checkVendor();
}, [authUserId, userId]);



  // ===== NEW: Notice popup state for buttons =====
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);

  // Resolve marketplace identity from Supabase auth first, then fallback to localStorage.
  useEffect(() => {
// On mount, fetch user info with auth-first identity resolution
async function fetchUserInfo() {

  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (authUser) {
    setAuthUser(authUser);
    setAuthUserId(authUser.id || null);
    setUserId(authUser.id || "");
    setUserEmail(authUser.email || "");

    const { data: byAuthId } = await supabase
      .from("users")
      .select("id,name,email,verified,phone_verified,phone_code,user_code")
      .eq("id", authUser.id)
      .maybeSingle();

    const { data: byEmail } = !byAuthId && authUser.email
      ? await supabase
          .from("users")
          .select("id,name,email,verified,phone_verified,phone_code,user_code")
          .ilike("email", authUser.email)
          .maybeSingle()
      : { data: null };

    const data = byAuthId || byEmail;

    if (data) {
      setUserName(data.name || "");
      setUserEmail(data.email || authUser.email || "");
      setUserId(data.id || authUser.id || "");
      setUserEmailVerified(!!data.verified);
      setUserVerified(!!data.verified && !!data.phone_verified);

      if (data.user_code) {
        setUserCode(data.user_code);
        if (typeof window !== "undefined") {
          localStorage.setItem("xchange_user_code", data.user_code);
        }
      }

      if (!!data.verified && !data.phone_verified) {
        setPhoneCode(data.phone_code || "");
        setPhoneVerifyStep(true);
        setShowJoinModal(true);
      }
    }

    return;
  }

  const storedCode = localStorage.getItem("xchange_user_code");

  if (!storedCode) {
    console.log("No user code found in browser");
    return;
  }

  console.log("Looking up user_code:", storedCode);

  const { data, error } = await supabase
    .from("users")
    .select("id,name,email,verified,phone_verified,phone_code,user_code")
    .eq("user_code", storedCode)
    .single();

  if (error) {
    console.error("User lookup error:", error);
    return;
  }

  console.log("User record:", data);

if (data) {
  setUserName(data.name || "");
  setUserEmail(data.email || "");
  setUserId(data.id || "");
  setUserEmailVerified(!!data.verified);
  setUserVerified(!!data.verified && !!data.phone_verified);

  // If email is verified but phone is not, force the phone verification step.
  if (!!data.verified && !data.phone_verified) {
    setPhoneCode(data.phone_code || "");
    setPhoneVerifyStep(true);
    setShowJoinModal(true);
  }
}


    }
    fetchUserInfo();
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('xchange_user_code');
          if (code) {
            setUserCode(code);
          }
      
    }
  }, []);

  // Handle marketplace email verification links: /marketplace?code=...
  useEffect(() => {
    if (!router.isReady) return;

    const code = typeof router.query.code === "string" ? router.query.code : "";
    if (!code) return;

    async function verifyFromMarketplaceCode() {
      const { data, error } = await supabase
        .from("users")
        .select("id,name,email,user_code,verified,phone_verified,phone_code")
        .eq("user_code", code)
        .maybeSingle();

      if (error || !data) {
        alert("Invalid or expired verification link.");
        router.replace("/marketplace", undefined, { shallow: true });
        return;
      }

      if (!data.verified) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ verified: true })
          .eq("id", data.id);

        if (updateError) {
          alert("Failed to verify your email. Please try again.");
          router.replace("/marketplace", undefined, { shallow: true });
          return;
        }
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("xchange_user_code", data.user_code);
      }

      setUserCode(data.user_code);
      setUserId(data.id || "");
      setUserName(data.name || "");
      setUserEmail(data.email || "");
      setUserEmailVerified(true);

      if (data.phone_verified) {
        setUserVerified(true);
      } else {
        setUserVerified(false);
        setPhoneCode(data.phone_code || "");
        setPhoneVerifyStep(true);
        setShowJoinModal(true);
        setSmsStatus("");
        setPhoneVerifyError("");
        try {
          if (data.phone && data.phone_code) {
            setSmsSending(true);
            await sendMarketplaceVerificationSms(data.phone, data.phone_code);
            setSmsStatus("Email verified. SMS code sent. Please verify your phone.");
          } else {
            setSmsStatus("Email verified. Please verify your phone to finish setup.");
          }
        } catch (err) {
          setPhoneVerifyError(err?.message || "Failed to send SMS verification code.");
          setSmsStatus("Email verified. Please verify your phone to finish setup.");
        } finally {
          setSmsSending(false);
        }
      }

      router.replace("/marketplace", undefined, { shallow: true });
    }

    verifyFromMarketplaceCode();
  }, [router.isReady, router.query.code]);
  // Affiliate logic: Only show affiliate status if user is approved as a member AND has an approved affiliate application
  const [affiliateApproved, setAffiliateApproved] = useState(false);
  const [affiliateUserId, setAffiliateUserId] = useState("");
  const [checkedAffiliate, setCheckedAffiliate] = useState(false);

 // Check affiliate status
useEffect(() => {

  async function checkAffiliateStatus() {

    if (!userCode) {
      setAffiliateApproved(false);
      setAffiliateUserId("");
      setCheckedAffiliate(true);
      return;
    }

    try {
      const affiliateId = userCode.slice(0, 8).toUpperCase();

      // Use server API to avoid RLS blocking client-side reads on affiliate_applications
      const resp = await fetch(`/api/affiliate/check-status?affiliateId=${encodeURIComponent(affiliateId)}`);
      const payload = await resp.json();

      setAffiliateDebug({ data: payload, error: null, userCode });

      if (payload?.approved) {
        setAffiliateApproved(true);
        setAffiliateUserId(payload.affiliateId || affiliateId);
      } else {
        setAffiliateApproved(false);
        setAffiliateUserId("");
      }
    } catch (err) {
      console.error("Affiliate check failed:", err);
      setAffiliateApproved(false);
      setAffiliateUserId("");
    }
    setCheckedAffiliate(true);
  }
  checkAffiliateStatus();

}, [userCode]);


  const [products, setProducts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [affiliateProducts, setAffiliateProducts] = useState([]);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingAffiliate, setLoadingAffiliate] = useState(true);

  const physicalProducts = products.filter(product => product.type === "physical");

  // Popup modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinForm, setJoinForm] = useState({ name: '', email: '', phone: '', password: '', passwordConfirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [phoneVerifyStep, setPhoneVerifyStep] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeInput, setPhoneCodeInput] = useState("");
  const [phoneVerifyError, setPhoneVerifyError] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [joinProgress, setJoinProgress] = useState("");
  const [joinSubmitted, setJoinSubmitted] = useState(false);

  function normalizePhone(countryCode, rawPhone) {
    const cc = String(countryCode || "+61").replace(/[^+0-9]/g, "");
    const local = String(rawPhone || "").replace(/\D/g, "");
    return `${cc}${local}`;
  }

  async function sendMarketplaceVerificationSms(destinationPhone, code) {
    const response = await fetch('/api/smsglobal/SMSSend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public: true,
        to: destinationPhone,
        message: `Your Xchange Marketplace verification code is: ${code}`
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Failed to send SMS verification code.');
    }

    return payload;
  }

  async function sendMarketplaceVerificationEmail(email, userCode) {
    const response = await fetch('/api/send-verification-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userCode })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || 'Failed to send verification email.');
    }

    return payload;
  }

  async function handleResendPhoneCode() {
    if (!userCode) return;
    setSmsSending(true);
    setSmsStatus("");
    setPhoneVerifyError("");

    try {
      const { data: dbUser, error } = await supabase
        .from("users")
        .select("id, phone, phone_code")
        .eq("user_code", userCode)
        .maybeSingle();

      if (error || !dbUser?.phone) {
        throw new Error("Could not load your phone number for verification.");
      }

      const nextCode = dbUser.phone_code || phoneCode;
      if (!nextCode) {
        throw new Error("No verification code found for this user.");
      }

      await sendMarketplaceVerificationSms(dbUser.phone, nextCode);
      setPhoneCode(nextCode);
      setSmsStatus("SMS code sent. Please check your phone.");
    } catch (err) {
      setPhoneVerifyError(err?.message || "Failed to resend verification code.");
    } finally {
      setSmsSending(false);
    }
  }

  async function handleResendVerificationEmail() {
    if (!userCode) return;
    setVerificationNotice("");

    try {
      const { data, error } = await supabase
        .from("users")
        .select("email,user_code")
        .eq("user_code", userCode)
        .maybeSingle();

      if (error || !data?.email || !data?.user_code) {
        throw new Error("Could not find your account email.");
      }

      await sendMarketplaceVerificationEmail(data.email, data.user_code);
      setVerificationNotice("Verification email sent. Please check your inbox.");
    } catch (err) {
      setVerificationNotice(err?.message || "Failed to resend verification email.");
    }
  }

  async function resumePhoneVerification({ resendSms = false } = {}) {
    if (!userCode) {
      setVerificationNotice("Please create your account first.");
      setShowJoinModal(true);
      setPhoneVerifyStep(false);
      return;
    }

    setVerificationNotice("");
    setPhoneVerifyError("");
    setSmsStatus("");

    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,user_code,verified,phone_verified,phone,phone_code")
      .eq("user_code", userCode)
      .maybeSingle();

    if (error || !data) {
      setVerificationNotice("We could not find your verification record. Please join again.");
      return;
    }

    setUserName(data.name || "");
    setUserEmail(data.email || "");
    setUserId(data.id || "");
    setUserEmailVerified(!!data.verified);

    if (data.phone_verified) {
      setUserVerified(true);
      setVerificationNotice("Your phone is already verified.");
      return;
    }

    if (!data.verified) {
      try {
        await fetch('/api/send-verification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, userCode: data.user_code })
        });
        setVerificationNotice("Please verify your email first. We sent a fresh email link.");
      } catch {
        setVerificationNotice("Please verify your email first using the email link we sent.");
      }
      return;
    }

    setPhoneCode(data.phone_code || "");
    setPhoneCodeInput("");
    setPhoneVerifyStep(true);
    setShowJoinModal(true);
    setUserVerified(false);

    if (resendSms && data.phone && data.phone_code) {
      try {
        setSmsSending(true);
        await sendMarketplaceVerificationSms(data.phone, data.phone_code);
        setSmsStatus("New SMS code sent. Enter it below.");
      } catch (err) {
        setPhoneVerifyError(err?.message || "Failed to send SMS verification code.");
      } finally {
        setSmsSending(false);
      }
    } else {
      setSmsStatus("Enter the 6-digit SMS code to complete your phone verification.");
    }
  }

  function handleJoinChange(e) {
    setJoinForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }
  async function handleJoinSubmit(e) {
    e.preventDefault();
    setJoinSubmitted(true);
    setJoinProgress("Creating your account...");
    setPhoneVerifyError("");
    setSmsStatus("");
    setVerificationNotice("");
    // Password validation
    if (!joinForm.password || joinForm.password.length < 6) {
      setJoinSubmitted(false);
      setJoinProgress("");
      alert("Password must be at least 6 characters.");
      return;
    }
    if (joinForm.password !== joinForm.passwordConfirm) {
      setJoinSubmitted(false);
      setJoinProgress("");
      alert("Passwords do not match.");
      return;
    }
    // Generate unique user code (safe browser UUID)
    function uuidv4() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    const userCode = uuidv4();
    // Check for existing email
    const { data: existing, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", joinForm.email)
      .maybeSingle();
    if (checkError) {
      setJoinSubmitted(false);
      setJoinProgress("");
      alert("Error checking email: " + checkError.message);
      return;
    }
    if (existing) {
      setJoinSubmitted(false);
      setJoinProgress("");
      alert("A user with this email already exists. Please use a different email or log in.");
      return;
    }












   // Generate phone verification code
const phoneCode = Math.floor(100000 + Math.random() * 900000).toString();

// Insert user record with phone_code and phone_verified false
// Hash password (simple client-side hash for demo; use bcrypt server-side in production)
const hashPassword = async (pw) => {
  const enc = new TextEncoder();
  const buf = await window.crypto.subtle.digest('SHA-256', enc.encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const passwordHash = await hashPassword(joinForm.password);

const fullPhone = normalizePhone(joinForm.countryCode, joinForm.phone);

const { data, error } = await supabase
  .from("users")
  .insert([
    {
      name: joinForm.name,
      email: joinForm.email,
      phone: fullPhone,
      user_code: userCode,
      password_hash: passwordHash,
      phone_code: phoneCode,
      phone_verified: false,
    }
  ]);

if (!error) {
  let emailSent = false;
  let emailError = "";
  setJoinProgress("Sending your verification email...");
  try {
    await sendMarketplaceVerificationEmail(joinForm.email, userCode);
    emailSent = true;
  } catch (err) {
    emailError = err?.message || "Failed to send verification email.";
  }

  setJoinProgress("Sending your SMS code...");
  try {
    setSmsSending(true);
    setSmsStatus("");
    await sendMarketplaceVerificationSms(fullPhone, phoneCode);
    setSmsStatus("SMS code sent. Please enter it below.");
  } catch (smsErr) {
    setPhoneVerifyError(smsErr?.message || "Failed to send SMS verification code.");
  } finally {
    setSmsSending(false);
  }

  setJoinForm({
    name: '',
    email: '',
    phone: '',
    password: '',
    passwordConfirm: '',
    countryCode: '+61',
    comments: ''
  });

  setJoinSubmitted(false);
  setUserCode(userCode);
  setPhoneCode(phoneCode);
  setPhoneCodeInput("");
  setPhoneVerifyStep(true);
  setShowJoinModal(true);
  setUserVerified(false);
  setJoinProgress("");

  if (!emailSent) {
    setVerificationNotice("Account created, but email failed. Use 'Resend verification email' in the pending bar.");
    setPhoneVerifyError(emailError || "Verification email failed to send.");
    alert(`Account created, but verification email failed: ${emailError || 'unknown error'}`);
  } else {
    setVerificationNotice("Account created. Check your email and SMS to finish verification.");
    alert("Account created. We sent your verification email and SMS code.");
  }

} else {
  setJoinSubmitted(false);
  setJoinProgress("");
  alert("Error creating user: " + error.message);
}

}

async function handlePhoneCodeSubmit(e) {
  e.preventDefault();
  setPhoneVerifyError("");

  const currentCode = phoneCode || "";
  
  if (phoneCodeInput === currentCode) {

    // Mark phone as verified in DB
    const { error } = await supabase
      .from("users")
      .update({ phone_verified: true })
      .eq("user_code", userCode);

    if (error) {
      setPhoneVerifyError("Could not verify phone right now. Please try again.");
      return;
    }

    setPhoneVerifyStep(false);
    setShowJoinModal(false);
    setUserVerified(true);
    setUserEmailVerified(true);
    setSmsStatus("");
    setPhoneCodeInput("");

    if (typeof window !== "undefined" && userCode) {
      localStorage.setItem("xchange_user_code", userCode);
    }

    alert("Phone number verified!");

  } else {
    setPhoneVerifyError("Incorrect code. Please try again.");
  }
}

const digitalProducts = products.filter(product => product.type === "digital");

useEffect(() => {

  async function loadProducts() {

    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    setProducts(data || []);
    setLoadingProducts(false);
  }

  async function loadCourses() {

    const { data } = await supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    setCourses(data || []);
    setLoadingCourses(false);
  }

  async function loadAffiliateProducts() {

    const { data } = await supabase
      .from("affiliate_products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setAffiliateProducts(data || []);
    setLoadingAffiliate(false);
  }

  loadProducts();
  loadCourses();
  loadAffiliateProducts();

}, []);

// ===== NEW: Handler for button clicks when not verified =====
function handleVerifyClick(e) {
  e.preventDefault();
  setShowVerifyNotice(true);
}

// ===== NEW: Notice Modal for Unverified User Clicks =====
function VerifyNoticeModal({ open, onClose }) {

  if (!open) return null;

  return (
    <div>

      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 300
      }} onClick={onClose} />

      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        background: '#1e293b',
        color: '#fff',
        borderRadius: 16,
        padding: 32,
        minWidth: 320,
        zIndex: 350,
        boxShadow: '0 12px 36px 0 rgba(0,0,0,0.35)',
        textAlign: 'center'
      }}>

        <div style={{
          fontWeight: 600,
          fontSize: 24,
          marginBottom: 16
        }}>
          Users must be verified to use this site
        </div>

        <div style={{
          fontSize: 17,
          marginBottom: 18
        }}>
          Please create an account and verify your email and phone number to browse, purchase or join the Xchange Marketplace.
        </div>

        <button
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-8 rounded-xl mt-2 text-lg"
          onClick={onClose}
        >
          Close
        </button>

      </div>

    </div>
  );
}

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      {/* Add space above the top banner */}
      <div style={{ height: 32 }} />
      <div className="max-w-7xl mx-auto px-6 py-45">

        {/* ==== TOP BANNER ==== */}
        <div className="bg-[#0d87f1] rounded-xl mb-2 flex items-center justify-between mx-auto shadow-lg"
          style={{ width: 1450, maxWidth: "100%", padding: "2px 10px" }}
        >
          <div className="flex items-center gap-1">
            <img src="/xchange-logo.gif" alt="Xchange Marketplace Icon" className="w-40 h-40 object-contain" />
            <div>
              <div style={{ fontSize: 48, fontWeight: 600 }}>
                The Xchange Marketplace
              </div>
              <div style={{ fontSize: 18, opacity: 0.92, marginTop: 6 }}>
                Browse and promote online courses, physical products, and digital products.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <select
              className="bg-black text-white font-extrabold px-4 py-5 rounded-2xl text-lg shadow focus:outline-none border border-[#0d87f1]"
              style={{ minWidth: 220, fontWeight: 600 }}
              onChange={e => {
                const val = e.target.value;
                if (val) {
                  const el = document.getElementById(val);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              defaultValue=""
              disabled={!userVerified}
              title={!userVerified ? "You must be logged in and verified to browse categories" : undefined}
              onClick={!userVerified ? handleVerifyClick : undefined}
            >
              <option value="" disabled>Select Category…</option>
              <option value="online-courses">Online Courses</option>
              <option value="physical-products">Physical Products</option>
              <option value="digital-products">Digital Products</option>
              <option value="affiliate-marketplace">Affiliate Marketplace</option>
            </select>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/marketplace/login">
                <button
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-extrabold px-5 py-3 rounded-2xl"
                  style={{ minWidth: 120, maxWidth: 140, width: '100%' }}
                  disabled={false} // Never disable Log In button
                  title="Log in to your Xchange account"
                  // No longer triggers handleVerifyClick
                >
                  Log In
                </button>
              </Link>
              <button
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-3 rounded-2xl"
                style={{ minWidth: 120, maxWidth: 140, width: '100%' }}
                onClick={async () => {
                  await supabase.auth.signOut();
                  localStorage.removeItem('xchange_user_code');
                  setUserCode('');
                  setUserVerified(false);
                  setUserEmail('');
                  setUserName('');
                  setUserId('');
                  setAuthUserId(null);
                  window.location.reload();
                }}
                disabled={!(userVerified || authUserId)}
                title={!(userVerified || authUserId) ? "You are not logged in" : undefined}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
        {/* ==== USER VERIFICATION STATUS ==== */}
        {userCode && !userVerified && (
          <div style={{
            background: '#991b1b',
            color: '#fff',
            borderRadius: 10,
            padding: '10px 24px',
            fontWeight: 600,
            fontSize: 18,
            margin: '16px 0',
            textAlign: 'center',
            border: '2px solid #dc2626',
            boxShadow: '0 2px 8px 0 rgba(220,38,38,0.10)'
          }}>
            <span style={{ fontSize: 22, fontWeight: 600 }}>❗User verification pending.</span> Please check your email and SMS to verify your account.
            {verificationNotice && (
              <div style={{ marginTop: 10, fontSize: 16, color: '#fde68a' }}>{verificationNotice}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
                onClick={() => resumePhoneVerification({ resendSms: false })}
              >
                Verify Phone Now
              </button>
              <button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg"
                onClick={handleResendVerificationEmail}
              >
                Resend Verification Email
              </button>
              <button
                type="button"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                onClick={() => resumePhoneVerification({ resendSms: true })}
                disabled={smsSending}
              >
                {smsSending ? 'Sending SMS…' : 'Send SMS Code to your Phone'}
              </button>
            </div>
          </div>
        )}





{/* 🔹 LOGIN STRIP */}
<div
  style={{
    maxWidth: 1320,
    margin: "12px auto 20px auto",
    background: "rgb(62, 40, 185)",
    border: "1px solid rgba(59,130,246,0.25)",
    borderRadius: 10,
    padding: "10px 16px",
    textAlign: "center",
  }}
>
  <Link href="/login">
    <span
      style={{
        color: "#9ec5f5",
        fontSize: 18,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      🔐 Already a member of the Gr8 Result Main Platform?  ----   Click here to Log-in to access your dashboard →
    </span>
  </Link>
</div>

        {userCode && userVerified && (
          <div style={{
            background: '#22c55e',
            color: '#222',
            borderRadius: 10,
            padding: '10px 24px',
            fontWeight: 600,
            fontSize: 18,
            margin: '16px 0',
            textAlign: 'center',
            border: '2px solid #15803d',
            boxShadow: '0 2px 8px 0 rgba(34,197,94,0.10)'
          }}>
            {/* User Name (always show) */}
            <div style={{ fontSize: 28, fontWeight: 600, color: '#166534', marginBottom: 2 }}>
              {userName ? userName : '[No Name Found]'}
            </div>
            {/* User Email (always show) */}
            <div style={{ fontSize: 18, color: '#0d87f1', fontWeight: 600, marginBottom: 8 }}>
              {userEmail ? userEmail : '[No Email Found]'}
            </div>
            <span style={{ fontSize: 22, fontWeight: 600 }}>✅ User verified!</span>
            <span style={{ marginLeft: 8 }}>Your User Code: <span style={{ fontFamily: 'monospace', color: '#166534', fontWeight: 600 }}>{userCode}</span></span>
          </div>
        )}
        <div style={{ height: 32 }} />
        {/* TEXT + FORM SECTION */}
        <div className="flex gap-8 mb-10 mx-auto" style={{ width: 1450, maxWidth: "100%" }}>
          <div className="bg-[#181f2e] rounded-xl p-8 text-white flex-1" style={{ width: 1200 }}>
            <h2 className="font-bold mb-4" style={{ fontSize: 42, color: '#22c55e' }}>
              Welcome to<br />
              The Xchange Marketplace!
            </h2>
            <p className="mb-3" style={{ fontSize: 22 }}>
              Browse our thriving community marketplace — online courses, digital downloads, and unique physical goods for all interests.
            </p>
            <p className="mb-3" style={{ fontSize: 22 }}>
              From fitness programs, self-improvement guides, the latest in business, to custom printed clothing.
            </p>
            <p className="mb-3" style={{ fontSize: 22 }}>
              We also offer a range of High Quality Affiliate Products for you to market and earn commissions.
            </p>
            <p className="mb-3" style={{ fontSize: 22 }}>
              Enjoy what we have on offer and check back often.
            </p>
            <p className="mb-3" style={{ fontSize: 22 }}>
              You must be a part of our community to access all features and purchase products. Join our Marketplace community today! Click the button below, it's FREE to join.
            </p>
            <div className="flex justify-center mt-8">
              <button
                className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-4 px-10 rounded-2xl text-2xl shadow-lg border-2 border-[#15803d] transition-all duration-150"
                style={{ minWidth: 260 }}
                onClick={() => {
                  if (userVerified) {
                    setShowJoinModal('already');
                  } else if (userCode) {
                    resumePhoneVerification({ resendSms: false });
                  } else {
                    setShowJoinModal(true);
                  }
                }}
                disabled={userVerified}
                title={userVerified ? "Already a member" : undefined}
              >
                Click here to Join Xchange Marketplace!
              </button>
            </div>
          </div>
          <div
            className="bg-[#181f2e] rounded-xl p-8 text-white flex-shrink-0"
            style={{ width: 500, border: "1px solid #0d87f1" }}
          >
            <h3 className="font-bold mb-4" style={{ fontSize: 36, color: '#0d87f1' }}>
              Want to add an offer for sale ? It’s free to list. Add Your Product or Service — Get in Touch
            </h3>
            <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4">
              <input
                  type="text"
                  name="name"
                  value={joinForm.name}
                  onChange={handleJoinChange}
                  placeholder="Name"
                  className="mb-3 p-3 rounded-lg border border-gray-300 w-full"
                  disabled={!userVerified}
                />
                <input
                  type="email"
                  name="email"
                  value={joinForm.email}
                  onChange={handleJoinChange}
                  placeholder="Email"
                  className="mb-3 p-3 rounded-lg border border-gray-300 w-full"
                  disabled={!userVerified}
                />
                <input
                  type="tel"
                  name="phone"
                  value={joinForm.phone}
                  onChange={handleJoinChange}
                  placeholder="Phone"
                  className="mb-3 p-3 rounded-lg border border-gray-300 w-full"
                  disabled={!userVerified}
                />
                <input
                  type="text"
                  name="comments"
                  value={joinForm.comments}
                  onChange={handleJoinChange}
                  placeholder="Comments"
                  className="mb-3 p-3 rounded-lg border border-gray-300 w-full"
                  disabled={!userVerified}
                />
              <button
                type="submit"
                className="bg-[#0d87f1] hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
                disabled={joinSubmitted || !userVerified}
                title={!userVerified ? "You must be logged in and verified to send a request" : undefined}
                onClick={!userVerified ? handleVerifyClick : undefined}
              >
                {joinSubmitted ? 'Submitting…' : 'Send Request'}
              </button>
              {joinSubmitted && <div className="text-green-400 mt-2">Processing your request…</div>}
            </form>
          </div>
        </div>

        {/* ==== ONLINE COURSES ==== */}
        <div id="online-courses" className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl px-6 py-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/xchange-logo.gif" className="w-24 h-24 object-contain" />
            <div>
              <h2 className="text-3xl font-semibold">Online Courses</h2>
              <p className="text-sm opacity-90 mt-1">
                Master new skills with expert-led training programs.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <select className="px-4 py-2 rounded text-black font-semibold bg-white border border-blue-600 text-lg min-w-[220px]"
              disabled={!userVerified}
              title={!userVerified ? "You must be logged in and verified to browse course types" : undefined}
              onClick={!userVerified ? handleVerifyClick : undefined}
            >
              <option>Browse Course Type</option>
              <option>Business & Entrepreneurship</option>
              <option>Health & Fitness</option>
              <option>Technology & Coding</option>
              <option>Marketing & Sales</option>
              <option>Personal Development</option>
              <option>Design & Creative</option>
              <option>Language & Communication</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <Grid>
          {loadingCourses ? (
            <Loading />
          ) : (
            courses.map(course => (
              <ProductCard
                key={course.id}
                image={course.cover_url}
                title={course.title}
                description={course.description}
                price={course.price}
                link={`/courses/${course.id}`}
                buttonText="View →"
                userVerified={userVerified}
                onShowVerifyNotice={handleVerifyClick}
              />
            ))
          )}
        </Grid>

        {/* ==== PHYSICAL PRODUCTS ==== */}
        <div id="physical-products" className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl px-6 py-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/xchange-logo.gif" className="w-24 h-24 object-contain" />
            <div>
              <h2 className="text-3xl font-semibold">Physical Products</h2>
              <p className="text-sm opacity-90 mt-1">
                Explore our range of high-quality physical products.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <select className="px-4 py-2 rounded text-black font-semibold bg-white border border-blue-600 text-lg min-w-[220px]"
              disabled={!userVerified}
              title={!userVerified ? "You must be logged in and verified to browse categories" : undefined}
              onClick={!userVerified ? handleVerifyClick : undefined}
            >
              <option>Browse Category</option>
              <option>Clothing</option>
              <option>Health</option>
              <option>Fitness</option>
              <option>Accessories</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <Grid>
          {loadingProducts ? (
            <Loading />
          ) : (
            physicalProducts.map(product => (
              <ProductCard
                key={product.id}
                id={product.id}
                image={product.image_urls?.[0]}
                title={product.title}
                description={product.description}
                price={product.price}
                userVerified={userVerified}
                onShowVerifyNotice={handleVerifyClick}
              />
            ))
          )}
        </Grid>

        {/* ==== DIGITAL PRODUCTS ==== */}
        <div id="digital-products" className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl px-6 py-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/xchange-logo.gif" className="w-24 h-24 object-contain" />
            <div>
              <h2 className="text-3xl font-semibold">Digital Products</h2>
              <p className="text-sm opacity-90 mt-1">
                Download premium digital tools and resources instantly.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <select className="px-4 py-2 rounded text-black font-semibold bg-white border border-blue-600 text-lg min-w-[220px]"
              disabled={!userVerified}
              title={!userVerified ? "You must be logged in and verified to browse categories" : undefined}
              onClick={!userVerified ? handleVerifyClick : undefined}
            >
              <option>Browse Category</option>
              <option>Ebooks</option>
              <option>Templates</option>
              <option>Software</option>
              <option>Courses</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <Grid>
          {loadingProducts ? (
            <Loading />
          ) : (
            digitalProducts.map(product => (
              <ProductCard
                key={product.id}
                id={product.id}
                type={product.type}
                image={product.image_urls?.[0]}
                title={product.title}
                description={product.description}
                price={product.price}
                userVerified={userVerified}
                onShowVerifyNotice={handleVerifyClick}
              />
            ))
          )}
        </Grid>

        {/* ==== AFFILIATE MARKETPLACE ==== */}
        <div>
          {/* Affiliate Marketplace Banner (blue) */}
          <div id="affiliate-marketplace" className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl px-6 py-4 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/xchange-logo.gif" className="w-24 h-24 object-contain" />
              <div>
                <h2 className="text-3xl font-semibold">Affiliate Marketplace</h2>
                <p className="text-sm opacity-90 mt-1">
                  Promote offers and earn commission.
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <select className="px-4 py-2 rounded text-black font-semibold bg-white border border-blue-600 text-lg min-w-[220px]"
                disabled={!userVerified}
                title={!userVerified ? "You must be logged in and verified to sort offers" : undefined}
                onClick={!userVerified ? handleVerifyClick : undefined}
              >
                <option>Sort Offers</option>
                <option>Highest Commission</option>
                <option>Highest Gravity</option>
                <option>Newest</option>
              </select>
            </div>
          </div>
          {/* AffiliateNotice (red dynamic notice) */}
          <AffiliateNotice approved={affiliateApproved} affiliateUserId={affiliateUserId} userEmail={userEmail} userName={userName} />
          <div
            className="mb-16"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 420px))',
              justifyContent: 'center',
              gap: 32,
              alignItems: 'stretch'
            }}
          >
            {/* Vendor Card */}
            <div className="bg-[#101a2c] rounded-xl border border-blue-600 p-6 flex flex-col justify-between items-center" style={{ boxShadow: "0 0 0 4px #0d87f1 inset", minHeight: 420, width: 420 }}>
              <div className="text-center">
                <img src="/logo/gr8result-logo.png" className="w-32 mx-auto mb-4" alt="Gr8 Result Vendor Logo" />
                <h2 className="text-blue-400 text-2xl font-bold mb-2">
                  Become a Gr8 Result Vendor
                </h2>
                <p className="text-md opacity-95 mb-2">
                  List your products or services on the Xchange Marketplace and let our network of approved affiliates promote and sell for you.
                </p>
                <p className="text-sm opacity-85 mb-2">
                  Vendors can offer digital or physical products, online courses, or unique services. Set your own commission rates and reach new customers through our affiliate network.
                </p>
                <p className="text-sm opacity-85 mb-2">
                  Our platform handles payments, tracking, and affiliate payouts, so you can focus on growing your business. Get started today and expand your reach!
                </p>
              </div>
            <div className="flex flex-col gap-3 w-full">
              <Link href={userVerified ? "/legal/vendor-agreement" : "#"}>
              <button
                className="w-full min-w-[320px] bg-blue-500 hover:bg-blue-600 text-white font-semibold py-5 rounded-xl text-2xl whitespace-normal"
              >
                Apply to become a Vendor
              </button>
              </Link>
              <Link href={vendorApproved ? "/modules/vendor" : "#"}>
                <button
                  className={`w-full min-w-[320px] py-4 rounded-xl text-xl ${
                    vendorApproved
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-gray-600 text-gray-300 cursor-not-allowed"
                  }`}
                  disabled={!vendorApproved}
                >
                  Visit Vendor's Dashboard
                </button>
              </Link>
            </div>
            </div>
            {/* Affiliate Card */}
            <div className="bg-[#101a2c] rounded-xl border border-green-600 p-6 flex flex-col justify-between items-center" style={{ boxShadow: "0 0 0 4px #22c55e inset", minHeight: 420, width: 420 }}>
              <div className="text-center">
                <img src="/logo/gr8result-logo.png" className="w-32 mx-auto mb-4" alt="Gr8 Result Affiliate Logo" />
                <h2 className="text-green-400 text-2xl font-bold mb-2">
                  Become a Gr8 Result Affiliate
                </h2>
                <p className="text-md opacity-95 mb-2">
                  Do you want to become an affiliate for our high quality brands and products?
                </p>
                <p className="text-sm opacity-85 mb-2">
                  Sign up here and apply to become an elite affiliate for the listed products. You will earn commission on sales generated from traffic you send.
                </p>
                <p className="text-sm opacity-85 mb-2">
                  Gravity measures how popular and successful a product is. EPC (Earnings Per Click) shows the average commission earned for an offer. Higher values mean better earning potential!
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full mt-6">

                <Link href={userVerified ? "/marketplace/apply" : "#"}>
              <button
                className="w-full min-w-[320px] bg-green-500 hover:bg-green-600 text-white font-semibold py-5 rounded-xl text-2xl whitespace-normal"
              >
                Apply to become an Affiliate
              </button>
                </Link>

                <Link href={affiliateApproved ? "/modules/affiliates" : "#"}>
                <button
                  className={`w-full min-w-[320px] py-4 rounded-xl text-xl ${
                    affiliateApproved
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-gray-600 text-gray-300 cursor-not-allowed"
                  }`}
                  disabled={!affiliateApproved}
                >
                  Visit Affiliate's Dashboard
                </button>
                </Link>

              </div>
                  
            </div>
          </div>
          
          {/* Affiliate Product Cards restored below the two fixed cards */}
          <div
            className="mb-16"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 32,
              alignItems: 'stretch'
            }}
          >
            {loadingAffiliate ? (
              <Loading />
            ) : (
              affiliateProducts.map(product => (
                  <AffiliateProductCard
                    key={product.id}
                    product={product}
                    affiliateApproved={affiliateApproved}
                    userVerified={userVerified}
                    userEmailVerified={userEmailVerified}
                    hasAffiliateApplication={product.hasAffiliateApplication}
                    onShowEmailVerifyModal={handleVerifyClick}
                    user={userId ? { id: userId, name: userName, email: userEmail, code: userCode } : null}
                  />
              ))
            )}
          </div>
        </div>
      </div>
      {/* ===== Notice for Unverified User Actions ===== */}
      <VerifyNoticeModal open={showVerifyNotice} onClose={() => setShowVerifyNotice(false)} />
      {/* Join Xchange Modal */}
      {showJoinModal && (
        <Fragment>
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.45)', zIndex: 50
          }} onClick={() => setShowJoinModal(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#181f2e', color: '#fff', borderRadius: 16, padding: 36, minWidth: 380, zIndex: 100,
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.25)'
          }}>
            {showJoinModal === 'already' ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 18, color: '#22c55e' }}>Already a Member!</h2>
                <div style={{ fontSize: 20, color: '#fff', marginBottom: 16 }}>
                  You are already a verified member of Xchange.<br />
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>Welcome back!</span>
                </div>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-8 rounded-xl mt-2 text-lg"
                  onClick={() => setShowJoinModal(false)}
                >
                  Close
                </button>
              </div>
            ) : !phoneVerifyStep ? (
              <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Name"
                  value={joinForm.name}
                  onChange={handleJoinChange}
                  className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700"
                  required
                  disabled={userVerified}
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={joinForm.email}
                  onChange={handleJoinChange}
                  className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700"
                  required
                  disabled={userVerified}
                />
                <div className="flex gap-2 items-center mb-2">
                  <select
                    name="countryCode"
                    value={joinForm.countryCode || '+61'}
                    onChange={e => setJoinForm(f => ({ ...f, countryCode: e.target.value }))}
                    className="bg-[#222] rounded px-2 py-2 text-white border border-slate-700"
                    style={{ width: 90 }}
                    required
                    disabled={userVerified}
                  >
                    <option value="+61">+61 (AU)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+64">+64 (NZ)</option>
                    <option value="+91">+91 (IN)</option>
                    <option value="+81">+81 (JP)</option>
                    <option value="+65">+65 (SG)</option>
                    <option value="+49">+49 (DE)</option>
                    <option value="+33">+33 (FR)</option>
                    <option value="+27">+27 (ZA)</option>
                    <option value="+34">+34 (ES)</option>
                    <option value="+39">+39 (IT)</option>
                    <option value="+7">+7 (RU)</option>
                    <option value="+86">+86 (CN)</option>
                    <option value="+852">+852 (HK)</option>
                    <option value="+62">+62 (ID)</option>
                    <option value="+60">+60 (MY)</option>
                    <option value="+66">+66 (TH)</option>
                    <option value="+63">+63 (PH)</option>
                    <option value="+55">+55 (BR)</option>
                    <option value="+20">+20 (EG)</option>
                    <option value="+234">+234 (NG)</option>
                    <option value="+92">+92 (PK)</option>
                    <option value="+880">+880 (BD)</option>
                    <option value="+82">+82 (KR)</option>
                    <option value="+90">+90 (TR)</option>
                    <option value="+358">+358 (FI)</option>
                    <option value="+46">+46 (SE)</option>
                    <option value="+31">+31 (NL)</option>
                    <option value="+32">+32 (BE)</option>
                    <option value="+41">+41 (CH)</option>
                    <option value="+43">+43 (AT)</option>
                    <option value="+420">+420 (CZ)</option>
                    <option value="+48">+48 (PL)</option>
                    <option value="+351">+351 (PT)</option>
                    <option value="+386">+386 (SI)</option>
                    <option value="+421">+421 (SK)</option>
                    <option value="+36">+36 (HU)</option>
                    <option value="+40">+40 (RO)</option>
                    <option value="+386">+386 (SI)</option>
                    <option value="+420">+420 (CZ)</option>
                    <option value="+372">+372 (EE)</option>
                    <option value="+370">+370 (LT)</option>
                    <option value="+371">+371 (LV)</option>
                    <option value="+48">+48 (PL)</option>
                    <option value="+47">+47 (NO)</option>
                    <option value="+45">+45 (DK)</option>
                    <option value="+386">+386 (SI)</option>
                    <option value="+420">+420 (CZ)</option>
                    <option value="+372">+372 (EE)</option>
                    <option value="+370">+370 (LT)</option>
                    <option value="+371">+371 (LV)</option>
                    <option value="+48">+48 (PL)</option>
                    <option value="+47">+47 (NO)</option>
                    <option value="+45">+45 (DK)</option>
                  </select>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone (no spaces, e.g. 412345678)"
                    value={joinForm.phone}
                    onChange={handleJoinChange}
                    className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700 w-full"
                    pattern="[0-9]{6,15}"
                    required
                    title="Enter your phone number in international format, e.g. 412345678 for +61 412345678"
                    disabled={userVerified}
                  />
                </div>
                <div className="relative mb-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Create Password"
                    value={joinForm.password}
                    onChange={handleJoinChange}
                    className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700 w-full pr-12"
                    required
                    disabled={userVerified}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={userVerified}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575m1.875-2.25A9.956 9.956 0 0112 3c5.523 0 10 4.477 10 10 0 1.657-.403 3.22-1.125 4.575m-1.875 2.25A9.956 9.956 0 0112 21c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575m1.875-2.25A9.956 9.956 0 0112 3c5.523 0 10 4.477 10 10 0 1.657-.403 3.22-1.125 4.575m-1.875 2.25A9.956 9.956 0 0112 21c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
                <div className="relative mb-2">
                  <input
                    type={showPasswordConfirm ? "text" : "password"}
                    name="passwordConfirm"
                    placeholder="Confirm Password"
                    value={joinForm.passwordConfirm}
                    onChange={handleJoinChange}
                    className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700 w-full pr-12"
                    required
                    disabled={userVerified}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    tabIndex={-1}
                    onClick={() => setShowPasswordConfirm(v => !v)}
                    aria-label={showPasswordConfirm ? "Hide password" : "Show password"}
                    disabled={userVerified}
                  >
                    {showPasswordConfirm ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575m1.875-2.25A9.956 9.956 0 0112 3c5.523 0 10 4.477 10 10 0 1.657-.403 3.22-1.125 4.575m-1.875 2.25A9.956 9.956 0 0112 21c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575m1.875-2.25A9.956 9.956 0 0112 3c5.523 0 10 4.477 10 10 0 1.657-.403 3.22-1.125 4.575m-1.875 2.25A9.956 9.956 0 0112 21c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg mt-2"
                  disabled={joinSubmitted || userVerified}
                >
                  {joinSubmitted ? 'Submitting…' : 'Join Now'}
                </button>
                {joinProgress && (
                  <div style={{ color: '#93c5fd', fontSize: 16 }}>{joinProgress}</div>
                )}
              </form>
            ) : (
              <form onSubmit={handlePhoneCodeSubmit} className="flex flex-col gap-4">
                <label htmlFor="phoneCodeInput" style={{ color: '#22c55e', fontWeight: 600 }}>Enter the code sent to your phone:</label>
                <input
                  type="text"
                  id="phoneCodeInput"
                  value={phoneCodeInput}
                  onChange={e => setPhoneCodeInput(e.target.value)}
                  className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  required
                />
                <button
                  type="button"
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg"
                  onClick={handleResendPhoneCode}
                  disabled={smsSending}
                >
                  {smsSending ? 'Sending SMS…' : 'Send SMS Code to your Phone'}
                </button>
                {phoneVerifyError && <div style={{ color: 'red' }}>{phoneVerifyError}</div>}
                {smsStatus && <div style={{ color: '#22c55e' }}>{smsStatus}</div>}
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg mt-2"
                >
                  Verify Phone
                </button>
              </form>
            )}
          </div>
        </Fragment>
      )}
    </div>
  );
}

/* ===== COMPONENTS ===== */

function SectionBanner({ title, subtitle }) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl px-6 py-4 mb-8 flex items-center gap-4">
      <img src="/xchange-logo.gif" className="w-12 h-12 object-contain" />
      <div>
        <h2 className="text-3xl font-semibold">{title}</h2>
        <p className="text-sm opacity-90 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function Grid({ children }) {
  return (
    <div
      className="mb-16"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 32,
        alignItems: 'stretch'
      }}
    >
      {children}
    </div>
  );
}

function Loading() {
  return <div className="md:col-span-4">Loading...</div>;
}

function ProductCard({ id, image, title, description, price, link, buttonText, type, userVerified, onShowVerifyNotice }) {
    // Stripe checkout handler
async function handleBuyNow() {

  try {

    // Read affiliate cookie
    const cookieMatch = document.cookie.match(/gr8_aff_ref=([^;]+)/);
    const affiliateRef = cookieMatch ? cookieMatch[1] : null;

    console.log("Affiliate ref sent to checkout:", affiliateRef);

    const res = await fetch('/api/stripe-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: {
          title: title,
          price: price,
          type: type || '',
          id: id || '',
        },
        affiliate_ref: affiliateRef
      })
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Could not start checkout.');
    }

  } catch (e) {
    console.error("Checkout error:", e);
    alert('Error starting checkout.');
  }

}    

     
  const [expanded, setExpanded] = useState(false);
  const maxLength = 120;
  const isLong = description && description.length > maxLength;
  // Determine if this is a physical or digital product card by presence of price and absence of link/buttonText (not a course)
  const isPhysicalOrDigital = price !== undefined && !link;
  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-700 overflow-hidden flex flex-col min-h-[420px]">
      <img
        src={image || "/placeholder.jpg"}
        alt={title}
        className="h-56 w-full object-cover"
      />
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-sm opacity-80 mb-4">
          {expanded || !isLong ? description : description?.slice(0, maxLength) + (isLong ? "..." : "")}
        </p>
        {isLong && (
          <button
            className="text-blue-400 underline text-xs mb-2 self-start"
            onClick={userVerified ? () => setExpanded(e => !e) : onShowVerifyNotice}
            disabled={!userVerified}
            title={!userVerified ? "You must be logged in and verified to expand description" : undefined}
          >
            {expanded ? "Read less" : "Read more"}
          </button>
        )}
        {price !== undefined && (
          <div className="text-blue-400 font-bold text-lg mb-4">
            {price ? `$${Number(price).toFixed(2)}` : "Free"}
          </div>
        )}
        {link && (
          <div className="mt-auto flex flex-col gap-2">
            <Link href={userVerified ? link : "#"}>
              <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
                disabled={!userVerified}
                title={!userVerified ? "You must be logged in and verified to view this" : undefined}
                onClick={!userVerified ? onShowVerifyNotice : undefined}
              >
                {buttonText}
              </button>
            </Link>
            {/* Green Buy Course Now button for online courses triggers Stripe checkout directly */}
            {link.startsWith('/courses/') && (
              <button
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded font-bold"
                onClick={userVerified ? handleBuyNow : onShowVerifyNotice}
                disabled={!userVerified}
                title={!userVerified ? "You must be logged in and verified to purchase" : undefined}
              >
                Buy Course Now
              </button>
            )}
          </div>
        )}
        {/* Buy Now button for physical/digital product cards only, always at bottom */}
        {isPhysicalOrDigital && (
          <div className="mt-auto flex flex-col">
            <button
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded font-bold mt-4"
              onClick={userVerified ? handleBuyNow : onShowVerifyNotice}
              disabled={!userVerified}
              title={!userVerified ? "You must be logged in and verified to purchase" : undefined}
            >
              Buy Now
            </button>
          </div>
        )}
      </div>
    </div>
  );

}