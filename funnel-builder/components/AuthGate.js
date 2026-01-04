// components/AuthGate.js
import { useEffect, useState } from "react";
import supabaseDefault, { supabase as supabaseNamed } from "../utils/supabase-client";
const supabase = supabaseNamed || supabaseDefault;

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    // 1) Grab current session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });

    // 2) Listen to auth changes (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9CA3AF"
      }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: 420,
          background: "#0b0f19",
          border: "1px solid #1f2937",
          borderRadius: 12,
          padding: 20,
          textAlign: "center"
        }}>
          <h2 style={{ margin: 0, marginBottom: 8 }}>Please sign in</h2>
          <p style={{ marginTop: 0, color: "#9CA3AF" }}>
            You need an account to access this page.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10 }}>
            <a href="/login">
              <button style={{
                padding: "10px 14px",
                background: "#2563eb",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: "pointer"
              }}>
                Sign in
              </button>
            </a>
            <a href="/onboarding">
              <button style={{
                padding: "10px 14px",
                background: "#10b981",
                border: "none",
                borderRadius: 8,
                color: "#0b0f19",
                cursor: "pointer",
                fontWeight: 600
              }}>
                Sign up
              </button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Logged in → show the protected UI
  return children;
}
