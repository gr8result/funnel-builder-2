import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [tokenMode, setTokenMode] = useState(false);

  useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
      return () => clearTimeout(timeout);
    }
  }, [success, router]);

  // Check for access token in URL
  useEffect(() => {
    let tries = 0;
    function checkToken() {
      const hash = window.location.hash;
      const search = window.location.search;
      const urlParams = new URLSearchParams(hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(search.replace(/^\?/, ''));
      const error = urlParams.get('error') || queryParams.get('error');
      const errorDesc = urlParams.get('error_description') || queryParams.get('error_description');
      if (error === 'access_denied' && (urlParams.get('error_code') === 'otp_expired' || queryParams.get('error_code') === 'otp_expired')) {
        setMsg('This reset link has expired. Please request a new one.');
        return;
      }
      if (errorDesc) {
        setMsg(errorDesc.replace(/\+/g, ' '));
        return;
      }
      // Accept token from hash or query string
      const token = urlParams.get('access_token') || urlParams.get('passwordresetaccess_token') || queryParams.get('access_token') || queryParams.get('passwordresetaccess_token');
      if (token) {
        setMsg("");
        return;
      }
      tries++;
      if (tries < 10) {
        setTimeout(checkToken, 200); // Retry for up to 2 seconds
      } else {
        setMsg("Invalid or missing reset token.");
      }
    }
    checkToken();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    setSuccess(false);
    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      setBusy(false);
      return;
    }
    // Extract access_token or passwordresetaccess_token from URL hash, query string, or manual input
    let accessToken = null;
    if (!tokenMode) {
      const hash = window.location.hash;
      const search = window.location.search;
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(search.replace(/^\?/, ''));
      accessToken = params.get('access_token') || params.get('passwordresetaccess_token') || queryParams.get('access_token') || queryParams.get('passwordresetaccess_token');
    } else {
      accessToken = manualToken.trim();
    }
    if (!accessToken) {
      setMsg("Missing or invalid reset token.");
      setBusy(false);
      return;
    }
    // Actually update the password in Supabase
    const { error } = await supabase.auth.updateUser({ password }, { accessToken });
    if (error) {
      setMsg(error.message || "Password reset failed.");
      setBusy(false);
      return;
    }
    setSuccess(true);
    setMsg("Password reset successful!");
    setBusy(false);
  };

      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c121a", color: "#fff", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#111827", padding: "40px 36px", borderRadius: 16, border: "1px solid #1f2937", boxShadow: "0 0 14px rgba(0,0,0,0.4)", textAlign: "center" }}>
            <h2 style={{ fontWeight: 600, marginBottom: 18, color: "#e5e7eb" }}>Reset Password</h2>
            <form onSubmit={onSubmit} autoComplete="off">
              {/* Manual token entry toggle */}
              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer', fontSize: 16, marginBottom: 4 }}
                  onClick={() => setTokenMode((v) => !v)}
                >
                  {tokenMode ? 'Use token from email link' : 'Paste token manually'}
                </button>
                {tokenMode && (
                  <input
                    type="text"
                    placeholder="Paste access token here"
                    value={manualToken}
                    onChange={e => setManualToken(e.target.value)}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #33415c', marginTop: 4, marginBottom: 8, fontSize: 16 }}
                  />
                )}
              </div>
              <label style={{ fontWeight: 600, display: "block", textAlign: "left", marginBottom: 6 }}>New Password</label>
              <div style={{ position: "relative", marginBottom: 18 }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #33415c", fontSize: 16, color: "#222", background: "#fff" }}
                  autoFocus
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", color: "#3b82f6", fontWeight: 600, cursor: "pointer", fontSize: 16 }}
                  tabIndex={-1}
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
              <label style={{ fontWeight: 600, display: "block", textAlign: "left", marginBottom: 6 }}>Confirm Password</label>
              <div style={{ position: "relative", marginBottom: 18 }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #33415c", fontSize: 16, color: "#222", background: "#fff" }}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", color: "#3b82f6", fontWeight: 600, cursor: "pointer", fontSize: 16 }}
                  tabIndex={-1}
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
              <div style={{ marginBottom: 12, color: success ? "#22c55e" : "#f87171", fontWeight: 600, minHeight: 22 }}>
                {msg}
              </div>
              <button type="submit" disabled={busy} style={{ width: "100%", padding: 12, borderRadius: 8, background: "#3b82f6", color: "#fff", fontWeight: 600, fontSize: 18, border: "none", cursor: "pointer" }}>
                {busy ? "Updating..." : "Reset Password"}
              </button>
            </form>
          </div>
        </div>
    );
}
