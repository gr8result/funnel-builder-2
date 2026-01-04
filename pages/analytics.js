export default function Analytics() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Analytics</h1>
      <p className="muted" style={{ margin: "0 0 16px" }}>
        Placeholder so you don’t get a 404. We’ll wire in traffic and conversion charts later.
      </p>
      <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Page views</li>
          <li>Funnel conversion rate</li>
          <li>Top sources</li>
        </ul>
      </div>
    </div>
  );
}
