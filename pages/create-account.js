import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

const PLAN_LABELS = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  professional: "Professional",
};

function normalizePlan(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("professional")) return "professional";
  if (raw.includes("scale")) return "scale";
  if (raw.includes("growth")) return "growth";
  if (raw.includes("starter")) return "starter";
  return raw || "";
}

function billingPath(plan) {
  const normalized = normalizePlan(plan);
  return normalized ? `/billing?plan=${encodeURIComponent(normalized)}` : "/billing";
}

function onboardingPath(plan) {
  const normalized = normalizePlan(plan);
  return normalized ? `/account?next=${encodeURIComponent(billingPath(normalized))}` : "/account?next=%2Fbilling";
}

export default function CreateAccount() {
  const router = useRouter();
  const selectedPlan = useMemo(() => normalizePlan(router.query.plan), [router.query.plan]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("details");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    const handleSession = async (data) => {
      const user = data?.session?.user;
      if (!user) return;

      setEmail((current) => current || user.email || "");
      const { data: account } = await supabase
        .from("accounts")
        .select("phone_verified, selected_plan")
        .eq("user_id", user.id)
        .maybeSingle();

      if (user.email_confirmed_at && account?.phone_verified) {
        const token = data.session?.access_token;
        if (token) {
          await fetch("/api/account/finalize-signup-verification", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null);
        }
        router.replace(onboardingPath(selectedPlan || account.selected_plan));
      } else if (user.email_confirmed_at) {
        setStep("phone");
        setMessage("Email verified. Enter the SMS code to finish account verification.");
      }
    };

    supabase.auth.getSession().then(({ data }) => handleSession(data));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession({ session });
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [router, router.isReady, selectedPlan]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!fullName.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your email.");
    if (!phone.trim()) return setError("Please enter your phone number.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/create-account?plan=${encodeURIComponent(selectedPlan)}`;
      const { error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            selected_plan: selectedPlan,
          },
        },
      });
      if (signupError) throw signupError;

      const otpRes = await fetch("/api/account/start-signup-phone-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          selectedPlan,
        }),
      });
      const otpJson = await otpRes.json().catch(() => ({}));
      if (!otpRes.ok) throw new Error(otpJson.error || "Account created, but the SMS code could not be sent.");

      setStep("phone");
      setMessage("Account created. We sent a 6-digit code to your phone. Check your email too, because email verification is also required.");
    } catch (err) {
      setError(err.message || "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyPhone(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!code.trim()) return setError("Enter the SMS code.");

    setBusy(true);
    try {
      const res = await fetch("/api/account/verify-signup-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Phone verification failed.");

      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      if (user?.email_confirmed_at || json.emailVerified) {
        const token = data?.session?.access_token;
        if (token) {
          await fetch("/api/account/finalize-signup-verification", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null);
        }
        router.push(onboardingPath(selectedPlan));
        return;
      }

      setStep("email");
      setMessage("Phone verified. Now click the verification link in your email. Once that is done, you will go straight to billing.");
    } catch (err) {
      setError(err.message || "Phone verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/start-signup-phone-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, selectedPlan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not resend code.");
      setMessage("A new code has been sent.");
    } catch (err) {
      setError(err.message || "Could not resend code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <section className="panel">
        <img src="/logo.png" alt="Gr8 Result Digital Solutions" className="logo" />
        <p className="eyebrow">Create Account</p>
        <h1>Start your Gr8 Result account</h1>
        <p className="copy">
          {selectedPlan ? `${PLAN_LABELS[selectedPlan] || selectedPlan} plan selected.` : "Choose your plan after verification."}
        </p>

        {step === "details" ? (
          <form onSubmit={handleCreate} className="form">
            <label>Name<input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" /></label>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <label>Phone<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
            <label>Confirm Password<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>
            <button disabled={busy}>{busy ? "Creating..." : "Create account and send code"}</button>
          </form>
        ) : step === "phone" ? (
          <form onSubmit={handleVerifyPhone} className="form">
            <label>SMS Code<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} /></label>
            <button disabled={busy}>{busy ? "Checking..." : "Verify phone"}</button>
            <button type="button" className="secondary" onClick={resendCode} disabled={busy}>Send another code</button>
          </form>
        ) : (
          <div className="notice">
            <h2>Phone verified</h2>
            <p>Check your email and click the verification link. After email verification, you will complete the onboarding application, then go to billing before the rest of the platform opens.</p>
            <button onClick={() => router.push("/login")}>I verified email, sign in</button>
          </div>
        )}

        {message ? <div className="ok">{message}</div> : null}
        {error ? <div className="err">{error}</div> : null}

        <p className="signin">Already have an account? <a href="/login">Sign in</a></p>
      </section>

      <style jsx>{`
        .wrap { min-height: 100vh; background: #07111f; color: #e5e7eb; display: grid; place-items: center; padding: 28px; }
        .panel { width: 100%; max-width: 520px; background: #0f1726; border: 1px solid rgba(148,163,184,0.24); border-radius: 14px; padding: 34px; box-shadow: 0 30px 80px rgba(0,0,0,0.35); }
        .logo { width: 74px; height: 74px; object-fit: contain; border-radius: 12px; display: block; margin: 0 auto 18px; }
        .eyebrow { color: #38bdf8; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 8px; text-align: center; }
        h1 { font-size: 32px; line-height: 1.1; margin: 0; text-align: center; color: #fff; }
        .copy { text-align: center; color: #cbd5e1; font-size: 18px; margin: 12px 0 24px; }
        .form { display: grid; gap: 14px; }
        label { display: grid; gap: 6px; color: #cbd5e1; font-weight: 700; }
        input { width: 100%; box-sizing: border-box; background: #08111f; color: #fff; border: 1px solid #334155; border-radius: 9px; padding: 12px 13px; }
        button { border: none; border-radius: 10px; padding: 14px 18px; background: #22c55e; color: #03110a; font-weight: 800; cursor: pointer; }
        button:disabled { opacity: 0.65; cursor: wait; }
        .secondary { background: transparent; color: #93c5fd; border: 1px solid #334155; }
        .ok, .err { margin-top: 16px; border-radius: 10px; padding: 12px 14px; font-weight: 700; line-height: 1.45; }
        .ok { background: rgba(34,197,94,0.12); color: #bbf7d0; border: 1px solid rgba(34,197,94,0.35); }
        .err { background: rgba(239,68,68,0.12); color: #fecaca; border: 1px solid rgba(239,68,68,0.35); }
        .notice { display: grid; gap: 12px; color: #cbd5e1; text-align: center; }
        .notice h2 { margin: 0; color: #fff; }
        .signin { text-align: center; margin: 20px 0 0; color: #94a3b8; }
        a { color: #60a5fa; }
      `}</style>
    </main>
  );
}
