// /pages/accept-invite.js
// Landing page for workspace invite email links.
// Supabase processes the magic-link token from the URL hash automatically
// (via onAuthStateChange). Once logged in we activate any pending workspace
// memberships and redirect the user to the dashboard.
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // loading | activating | done | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let handled = false;

    async function handleInvite(session) {
      if (!session?.access_token || handled) return;
      handled = true;

      setStatus("activating");

      try {
        const res = await fetch("/api/workspaces/activate-invite", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to activate invite");

        const first = json.activated?.[0];
        if (first) {
          // Make the new workspace the active one
          if (typeof window !== "undefined") {
            localStorage.setItem("active_workspace_id", first.id);
          }
          setMessage(`Welcome to ${first.name}! Redirecting you to the dashboard…`);
        } else {
          setMessage("You're all set! Redirecting you to the dashboard…");
        }

        setStatus("done");
        setTimeout(() => router.replace("/dashboard"), 2000);
      } catch (e) {
        setStatus("error");
        setMessage(e?.message || "Something went wrong. Please contact support.");
      }
    }

    // Supabase fires SIGNED_IN / USER_UPDATED after processing the hash token
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          await handleInvite(session);
        }
      }
    );

    // Fallback: already logged-in users arriving at this page
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) handleInvite(data.session);
    });

    return () => subscription?.unsubscribe();
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", color: "#f8fafc", maxWidth: 400, padding: 24 }}>
        {status === "loading" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ margin: "0 0 8px" }}>Verifying your invite…</h2>
            <p style={{ color: "#94a3b8", margin: 0 }}>Just a moment while we set things up.</p>
          </>
        )}
        {status === "activating" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 style={{ margin: "0 0 8px" }}>Activating workspace access…</h2>
            <p style={{ color: "#94a3b8", margin: 0 }}>Almost there!</p>
          </>
        )}
        {status === "done" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: "0 0 8px" }}>You&apos;re in!</h2>
            <p style={{ color: "#94a3b8", margin: 0 }}>{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ margin: "0 0 8px" }}>Something went wrong</h2>
            <p style={{ color: "#f87171", margin: "0 0 16px" }}>{message}</p>
            <a
              href="/login"
              style={{
                color: "#60a5fa",
                textDecoration: "none",
                borderBottom: "1px solid #60a5fa",
              }}
            >
              Go to login →
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// Skip the main app Layout (TopNav, SideNav) for this page
AcceptInvitePage.disableLayout = true;
