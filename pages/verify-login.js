// /pages/verify-login.js
// Verify login (no SideNav) — logo + name identical to original working layout.

import { useState } from "react";
import Head from "next/head";
import { supabase } from "../utils/supabase-client";

export default function VerifyLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("approved")
      .eq("user_id", user.id)
      .single();

    if (!profile) window.location.assign("/account");
    else if (!profile.approved) window.location.assign("/billing");
    else window.location.assign("/dashboard");
  };

  return (
    <>
      <Head>
        <title>Verify Login | Gr8 Result Digital Solutions</title>
      </Head>

      <div style={wrap}>
        <div style={card}>
          {/* Logo + Brand */}
          <div style={brand}>
            <img
              src="/images/logo.png"
              alt="Gr8 Result Digital Solutions"
              style={logo}
            />
            <div style={brandText}>
              <h1 style={brandTitle}>Gr8 Result</h1>
              <h2 style={brandSubtitle}>Digital Solutions</h2>
            </div>
          </div>

          <h3 style={heading}>Welcome Back</h3>
          <p style={desc}>Please log in to continue your setup.</p>

          <form onSubmit={handleLogin}>
            <label style={label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              required
            />

            <label style={label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              required
            />

            {msg && <div style={error}>{msg}</div>}

            <button type="submit" style={btn}>
              Continue
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

/* ---------- STYLES ---------- */

const wrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0c121a",
  color: "#fff",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
};

const card = {
  width: "100%",
  maxWidth: 420,
  background: "#111827",
  padding: "40px 36px",
  borderRadius: 16,
  border: "1px solid #1f2937",
  boxShadow: "0 0 14px rgba(0,0,0,0.4)",
  textAlign: "center",
};

const brand = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  marginBottom: 26,
};

const logo = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  border: "2px solid #3b82f6",
  backgroundColor: "#0c121a",
  objectFit: "cover",
};

const brandText = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  lineHeight: 1.1,
  textAlign: "left",
};

const brandTitle = {
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
  margin: 0,
};

const brandSubtitle = {
  fontSize: 14,
  fontWeight: 600,
  color: "#93c5fd",
  margin: 0,
};

const heading = {
  fontSize: 20,
  fontWeight: 800,
  marginBottom: 6,
};

const desc = {
  fontSize: 14,
  opacity: 0.8,
  marginBottom: 20,
};

const label = {
  fontWeight: 700,
  fontSize: 14,
  marginTop: 10,
  display: "block",
  textAlign: "left",
};

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

const btn = {
  width: "100%",
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontWeight: 900,
  padding: "12px",
  marginTop: 10,
  cursor: "pointer",
  transition: "background 0.2s",
};

const error = {
  background: "#311a1a",
  color: "#f87171",
  padding: "10px",
  borderRadius: 8,
  marginTop: 8,
};
