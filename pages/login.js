// /pages/login.js
// ✅ Full login flow with approval + billing redirect logic
// Automatically routes unverified users to pending or billing as needed

import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

function formatSignupError(error) {
  const raw = String(error?.message || "");
  const msg = raw.toLowerCase();

  if (msg.includes("database error saving new user")) {
    return "We could not finish creating your account due to a server setup issue. Please contact support or try again shortly.";
  }

  if (msg.includes("already registered") || msg.includes("user already registered")) {
    return "This email is already registered. Please sign in or reset your password.";
  }

  if (msg.includes("password")) {
    return raw;
  }

  return raw || "Something went wrong while creating your account.";
}

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
        try {
          setBusy(true);
          setMsg("");

          // Try to create user
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          // 🔥 HANDLE DUPLICATE CLEANLY (THIS IS THE FIX)
          if (error && error.message.includes("duplicate key value")) {
            console.warn("User already exists → switching to sign in");

            // Try logging them in instead
            const loginRes = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (loginRes.error) {
              setMsg("This email already exists. Try signing in or resetting your password.");
              return;
            }

            // Continue as logged-in user
            return router.push("/account");
          }

          if (error) throw error;

          const newUser = data.user || data.session?.user;

          if (!newUser) {
            setMsg("Signup failed. Try again.");
            return;
          }

          // ✅ Create account record
          const { error: insertError } = await supabase.from("accounts").insert([
            {
              user_id: newUser.id,
              email: newUser.email,
              full_name: newUser.email?.split("@")[0] || "New User",
              status: "pending",
              is_approved: false,
              subscription_status: "none",
              created_at: new Date().toISOString(),
            },
          ]);

          if (insertError) {
            console.error(insertError);
            setMsg("Account created but setup failed.");
            return;
          }

          setMsg("✅ Account created. Check your email or sign in.");
          setSuccess(true);

          setTimeout(() => {
            setMode("signin");
            setMsg("");
          }, 3000);

        } catch (err) {
          console.error(err);
          setMsg(err.message || "Signup failed.");
        } finally {
          setBusy(false);
        }

        return;
      }
        

      // --- SIGNIN ---
      // DEV BYPASS: on localhost only, allow login with the dev credentials without hitting Supabase
      const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      if (isLocalhost && process.env.NODE_ENV !== "production" && email === process.env.NEXT_PUBLIC_DEV_BYPASS_EMAIL && password === process.env.NEXT_PUBLIC_DEV_BYPASS_PASSWORD) {
        return router.push("/dashboard");
      }

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
        // Check workspace membership via the API (uses service-role key, bypasses RLS).
        // If this user belongs to any workspace they were invited to, they're a team member
        // — skip onboarding and go straight to the dashboard.
        const token = data.session?.access_token;
        const wsRes = await fetch("/api/workspaces", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const wsJson = await wsRes.json().catch(() => ({}));
        if (wsJson.workspaces?.length > 0) {
          return router.push("/dashboard");
        }

        // No account and no workspace → brand-new owner signup, send to onboarding
        await supabase.from("accounts").insert([
          {
            user_id: user.id,
            email: user.email,
            full_name: user.email?.split("@")[0] || "New User",
            status: "pending",
            is_approved: false,
            subscription_status: "none",
            created_at: new Date().toISOString(),
          },
        ]);
        return router.push("/account");
      }

      if (account.status === "paused") {
        await supabase.auth.signOut();
        setMsg("Your account is temporarily paused. Please contact support to restore access.");
        return;
      }

      // ✅ Routing logic
      if (!account.is_approved || account.status === "pending") {
        return router.push("/account");
      }

      if (account.is_approved === true) {
        // Honour explicit redirect param (e.g. from approval email link)
        const redirectTo = router.query.redirect;
        if (redirectTo && redirectTo.startsWith("/")) {
          return router.push(redirectTo);
        }
        // Approved but no active subscription → must complete billing first
        const hasSub = account.subscription_status && account.subscription_status !== "none" && account.subscription_status !== "inactive";
        if (!hasSub) {
          return router.push("/billing");
        }
        return router.push("/dashboard");
      }

      // fallback
      router.push("/account");
    } catch (err) {
      console.error(err);
      if (mode === "signup") {
        setMsg(formatSignupError(err));
      } else {
        setMsg(err.message || "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!email) return setMsg("Enter your email to reset password.");
    setMsg("If your email is registered, a password reset link has been sent. Check your inbox and spam folder.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/reset-password",
    });
    if (error) setMsg(error.message);
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

const title = { fontSize: 22, fontWeight: 600, margin: "12px 0 4px" };
const subtitle = { opacity: 0.8, fontSize: 18, marginBottom: 20 };
const label = { fontWeight: 600, fontSize: 16, marginTop: 10, display: "block" };
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
  fontSize: 16,
};
const btnMain = {
  width: "100%",
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontWeight: 600,
  padding: "12px",
  marginTop: 12,
  cursor: "pointer",
};
const linkBtn = {
  background: "transparent",
  border: "none",
  color: "#60a5fa",
  cursor: "pointer",
  fontSize: 16,
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
import Link from "next/link";
