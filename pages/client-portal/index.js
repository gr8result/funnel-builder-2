import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ClientPortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session || !active) {
        if (active) setIsCheckingSession(false);
        return;
      }

      try {
        const response = await fetch("/api/client-portal/resolve-project", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok && payload?.projectId) {
          const query = payload.workspaceId ? `?workspace_id=${encodeURIComponent(payload.workspaceId)}` : "";
          router.replace(`/client-portal/${encodeURIComponent(payload.projectId)}${query}`);
          return;
        }
        if (response.status === 403 || payload?.error) {
          setError("No active client portal project is assigned to this account.");
        }
      } catch (sessionError) {
        console.error("Client portal session check failed", sessionError);
      } finally {
        if (active) setIsCheckingSession(false);
      }
    }

    checkExistingSession();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const token = data?.session?.access_token;
      if (!token) {
        setError("Sign in succeeded but the portal could not resolve your project.");
        return;
      }

      const response = await fetch("/api/client-portal/resolve-project", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.projectId) {
        throw new Error(payload?.error || "No active client portal project is assigned to this account.");
      }

      const query = payload.workspaceId ? `?workspace_id=${encodeURIComponent(payload.workspaceId)}` : "";
      router.replace(`/client-portal/${encodeURIComponent(payload.projectId)}${query}`);
    } catch (loginError) {
      setError(loginError?.message || "Could not sign in to the client portal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email address to reset your password.");
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/client-portal`,
    });
    if (resetError) {
      setError(resetError.message || "We could not send a password reset email.");
      return;
    }
    setError("");
    window.alert("If the email exists on the portal, a password reset link has been sent.");
  }

  return (
    <>
      <Head>
        <title>Client Portal Login</title>
      </Head>
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.branding}>
            <img src="/logo.png" alt="Gr8 Result logo" style={styles.logo} />
            <div>
              <div style={styles.kicker}>Gr8 Result Digital Solutions</div>
              <h1 style={styles.title}>Client Portal</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={styles.input}
              autoComplete="email"
              required
            />

            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
              autoComplete="current-password"
              required
            />

            {error ? <div style={styles.error}>{error}</div> : null}

            <button type="submit" disabled={isSubmitting || isCheckingSession} style={styles.primaryButton}>
              {isSubmitting ? "Logging in..." : "Log In"}
            </button>
          </form>

          <div style={styles.secondaryActions}>
            <button type="button" onClick={handleForgotPassword} style={styles.linkButton}>Forgot Password</button>
            <button type="button" onClick={() => router.push("/client-portal/activate")} style={styles.linkButton}>Activate Account</button>
          </div>
        </section>
      </main>
    </>
  );
}

ClientPortalLoginPage.disableLayout = true;

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    padding: 24,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width: "min(440px, 100%)",
    background: "#ffffff",
    border: "1px solid #dfe7f2",
    borderRadius: 16,
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.10)",
    padding: 28,
  },
  branding: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    objectFit: "contain",
  },
  kicker: {
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#0369a1",
    fontWeight: 800,
    margin: 0,
  },
  title: {
    margin: "4px 0 0",
    fontSize: 30,
    lineHeight: 1.15,
    color: "#0f172a",
  },
  form: {
    display: "grid",
    gap: 10,
  },
  label: {
    display: "block",
    fontWeight: 700,
    color: "#1e293b",
    fontSize: 14,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 16,
    background: "#f8fafc",
    color: "#0f172a",
  },
  primaryButton: {
    marginTop: 10,
    border: "none",
    borderRadius: 10,
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 16,
    padding: "12px 16px",
    cursor: "pointer",
  },
  secondaryActions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },
  linkButton: {
    background: "transparent",
    border: "none",
    padding: 0,
    color: "#0f766e",
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    lineHeight: 1.5,
  },
};
