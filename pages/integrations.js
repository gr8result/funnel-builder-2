export default function Integrations() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Integrations</h1>
      <p className="muted" style={{ margin: "0 0 16px" }}>
        Connect services like Stripe, PayPal (placeholder), and more.
      </p>
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Stripe (test mode active)</li>
          <li>PayPal (placeholder)</li>
          <li>Future: Email/SMS providers</li>
        </ul>
      </div>
    </div>
  );
}

