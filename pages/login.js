// /pages/login.js
// ✅ Full login flow with approval + billing redirect logic
// Automatically routes unverified users to pending or billing as needed

import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setSuccess(false);

    if (!email || !password) return setMsg("Please enter your email and password.");
    if (mode === "signup" && password !== confirmPassword)
      return setMsg("Passwords do not match.");

    try {
      setBusy(true);

      // --- SIGNUP ---
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: "http://localhost:3000/login" },
        });
        if (error) throw error;

        const newUser = data.user || data.session?.user;
        if (newUser) {
          const { data: existing } = await supabase
            .from("accounts")
            .select("id")
            .eq("user_id", newUser.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from("accounts").insert([
              {
                user_id: newUser.id,
                email: newUser.email,
                name: newUser.email?.split("@")[0] || "New User",
                status: "pending",
                is_approved: false,
                subscription_status: "none",
                created_at: new Date().toISOString(),
              },
            ]);
          }
        }

        setMsg("✅ Verification email sent! Please check your inbox.");
        setSuccess(true);
        setTimeout(() => {
          setMode("signin");
          setMsg("");
        }, 15000);
        return;
      }

      // --- SIGNIN ---
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const user = data?.user;
      if (!user) return setMsg("Invalid login credentials.");

      const { data: account } = await supabase
        .from("accounts")
        .select("is_approved, subscription_status, status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!account) {
        // If account doesn't exist, redirect to onboarding
        await supabase.from("accounts").insert([
          {
            user_id: user.id,
            email: user.email,
            name: user.email?.split("@")[0] || "New User",
            status: "pending",
            is_approved: false,
            subscription_status: "none",
            created_at: new Date().toISOString(),
          },
        ]);
        return router.push("/pending-approval");
      }

      // ✅ Routing logic
      if (!account.is_approved || account.status === "pending") {
        return router.push("/pending-approval");
      }

      if (
        account.is_approved === true &&
        (account.subscription_status === "none" || account.subscription_status === "pending")
      ) {
        return router.push("/billing");
      }

      if (account.is_approved && account.subscription_status === "active") {
        return router.push("/dashboard");
      }

      // fallback
      router.push("/pending-approval");
    } catch (err) {
      console.error(err);
      setMsg(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!email) return setMsg("Enter your email to reset password.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/login",
    });
    setMsg(
      error ? error.message : "Password reset link sent to your email."
    );
  };

  return (
    <div style={wrap}>
      <div style={box}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img
            src="/logo.png"
            alt="Gr8 Result Logo"
            style={{ width: 72, borderRadius: 12 }}
          />
          <h1 style={title}>Gr8 Result Digital Solutions</h1>
          <p style={subtitle}>
            {mode === "signup"
              ? "Create your account"
              : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={onSubmit}>
          <label style={label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
            required
          />

          <label style={label}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              required
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={showBtn}
            >
              {showPass ? "Hide" : "Show"}
            </button>
          </div>

          {mode === "signup" && (
            <>
              <label style={label}>Confirm Password</label>
              <input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={input}
                required
              />
            </>
          )}

          {msg && <div style={msgBox(success)}>{msg}</div>}

          <button type="submit" disabled={busy} style={btnMain}>
            {busy
              ? "Please wait..."
              : mode === "signup"
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          {mode === "signup" ? (
            <button onClick={() => setMode("signin")} style={linkBtn}>
              Already have an account? Sign in
            </button>
          ) : (
            <>
              <button onClick={() => setMode("signup")} style={linkBtn}>
                New here? Create account
              </button>
              <br />
              <button onClick={handleForgot} style={linkBtn}>
                Forgot password?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Styles --- */
const wrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0c121a",
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
};

const box = {
  width: "100%",
  maxWidth: 420,
  background: "#111827",
  padding: "36px 30px",
  borderRadius: 14,
  border: "1px solid #1f2937",
  boxShadow: "0 0 14px rgba(0,0,0,0.5)",
};

const title = { fontSize: 20, fontWeight: 900, margin: "12px 0 4px" };
const subtitle = { opacity: 0.8, fontSize: 14, marginBottom: 20 };
const label = { fontWeight: 700, fontSize: 14, marginTop: 10, display: "block" };
const input = {
  width: "100%",
  background: "#0e1420",
  color: "#e6edf3",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "10px",
  marginTop: 4,
  marginBottom: 10,
};
const showBtn = {
  position: "absolute",
  right: 10,
  top: 6,
  background: "transparent",
  border: "none",
  color: "#60a5fa",
  cursor: "pointer",
  fontSize: 13,
};
const btnMain = {
  width: "100%",
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontWeight: 900,
  padding: "12px",
  marginTop: 12,
  cursor: "pointer",
};
const linkBtn = {
  background: "transparent",
  border: "none",
  color: "#60a5fa",
  cursor: "pointer",
  fontSize: 14,
  marginTop: 6,
};
const msgBox = (success) => ({
  background: success ? "#16a34a" : "#1e293b",
  color: "#fff",
  padding: "10px",
  borderRadius: 8,
  marginTop: 8,
  textAlign: "center",
  fontWeight: 600,
});
