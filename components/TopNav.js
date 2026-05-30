// /components/TopNav.js
export default function TopNav() {
  return (
    <div
      style={{
        background: "#111827",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "12px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 16, color: "#22c55e" }}>
        Gr8 Result Digital Solutions
      </div>
      <div
        style={{
          fontSize: 16,
          opacity: 0.8,
        }}
      >
        Your Company
      </div>
    </div>
  );
}
