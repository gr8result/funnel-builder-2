export default function Billing() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Billing & Modules</h1>
      <p className="muted" style={{ margin: "0 0 16px" }}>
        Placeholder so you don’t get a 404. Stripe test checkout remains enabled; PayPal is a placeholder.
      </p>

      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Current plan: <em>Developer / Test</em></li>
          <li>Modules: Website builder, Funnels, Assets, Leads</li>
          <li>Upgrade / manage (coming soon)</li>
        </ul>
      </div>
    </div>
  );
}
