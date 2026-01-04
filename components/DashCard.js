import Link from "next/link";

export default function DashCard({ href, title, subtitle, emoji = "✉️" }) {
  return (
    <Link href={href} className="no-underline">
      <div
        style={{
          background: "#224a95",     // mid blue
          color: "white",
          borderRadius: 12,
          padding: "16px 18px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
          transition: "transform .07s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      >
        <div style={{ fontSize: 18, fontWeight: 700, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>{emoji}</span>
          {title}
        </div>
        {subtitle && (
          <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>{subtitle}</div>
        )}
      </div>
    </Link>
  );
}
