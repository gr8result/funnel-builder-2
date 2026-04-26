import Head from "next/head";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";

function getQueryValue(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default function UnsubscribePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const params = useMemo(() => ({
    email: String(getQueryValue(router.query.email)).trim().toLowerCase(),
    user: String(getQueryValue(router.query.user)).trim(),
    token: String(getQueryValue(router.query.token)).trim(),
  }), [router.query.email, router.query.token, router.query.user]);

  const hasValidParams = Boolean(params.email && params.user && params.token);

  async function handleUnsubscribe() {
    if (!hasValidParams || busy) return;

    try {
      setBusy(true);
      setResult(null);

      const response = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not unsubscribe this email.");
      }

      setResult({ ok: true, message: payload.message || `${params.email} has been unsubscribed.` });
    } catch (error) {
      setResult({ ok: false, message: error?.message || "Could not unsubscribe this email." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Unsubscribe</title>
      </Head>

      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.eyebrow}>Email Preferences</div>
          <h1 style={styles.title}>Unsubscribe</h1>
          <p style={styles.copy}>
            {hasValidParams
              ? `Stop future broadcast emails for ${params.email}.`
              : "This unsubscribe link is missing information or has expired."}
          </p>

          {result ? (
            <div style={result.ok ? styles.success : styles.error}>{result.message}</div>
          ) : null}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={!hasValidParams || busy}
              style={{
                ...styles.primaryButton,
                opacity: !hasValidParams || busy ? 0.55 : 1,
                cursor: !hasValidParams || busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Unsubscribing..." : "Unsubscribe Me"}
            </button>
          </div>

          <p style={styles.note}>
            This stops future broadcasts sent from this workspace for this email address.
          </p>
        </section>
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    margin: 0,
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at top, rgba(56,189,248,0.18), transparent 34%), linear-gradient(180deg, #08111d 0%, #0f172a 55%, #111827 100%)",
    color: "#e5eefb",
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: "min(520px, 100%)",
    borderRadius: 24,
    padding: "28px 24px",
    background: "rgba(10, 18, 32, 0.92)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    boxShadow: "0 30px 80px rgba(2, 8, 23, 0.45)",
  },
  eyebrow: {
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.1,
  },
  copy: {
    margin: "12px 0 0",
    color: "#cbd5e1",
    fontSize: 16,
    lineHeight: 1.6,
  },
  actions: {
    marginTop: 24,
    display: "flex",
    gap: 12,
  },
  primaryButton: {
    border: 0,
    borderRadius: 14,
    padding: "14px 18px",
    background: "linear-gradient(135deg, #ef4444, #f97316)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    boxShadow: "0 16px 36px rgba(239,68,68,0.24)",
  },
  success: {
    marginTop: 18,
    borderRadius: 14,
    padding: "14px 16px",
    background: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(34, 197, 94, 0.32)",
    color: "#bbf7d0",
    lineHeight: 1.5,
  },
  error: {
    marginTop: 18,
    borderRadius: 14,
    padding: "14px 16px",
    background: "rgba(248, 113, 113, 0.12)",
    border: "1px solid rgba(248, 113, 113, 0.28)",
    color: "#fecaca",
    lineHeight: 1.5,
  },
  note: {
    margin: "18px 0 0",
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.6,
  },
};