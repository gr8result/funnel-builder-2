// components/AuthGate.js
import { useAuth } from "../context/AuthContext";


export default function AuthGate({ children }) {
  const { loading, session, error, retryAuth } = useAuth();

  if (error && !session) {
    return <div role="status" style={{ padding: 24 }}>
      <p>We couldn’t reconnect to your saved login. Retrying automatically.</p>
      <button onClick={retryAuth}>Retry connection</button>
    </div>;
  }
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
                padding: "14px 24px",
                background: "linear-gradient(135deg,#3b82f6,#ef465d)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: "pointer",
                fontSize: 18,
                fontWeight: 600,
                boxShadow: "0 2px 8px rgba(59,130,246,0.18)",
                transition: "background 0.2s, box-shadow 0.2s"
              }}>
                Sign in
              </button>
            </a>
            <a href="/onboarding">
              <button style={{
                padding: "14px 24px",
                background: "linear-gradient(135deg,#22c55e,#3b82f6)",
                border: "none",
                borderRadius: 8,
                color: "#0b0f19",
                cursor: "pointer",
                fontSize: 18,
                fontWeight: 600,
                boxShadow: "0 2px 8px rgba(34,197,94,0.18)",
                transition: "background 0.2s, box-shadow 0.2s"
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
