// components/DashCard.js
import Link from "next/link";

const cardStyle = {
  background: "#24448a",
  border: "1px solid #2a3a66",
  borderRadius: 12,
  padding: 16,
  color: "#fff",
  display: "block",
  textDecoration: "none",
  transition: "background 120ms ease-in-out, transform 120ms ease-in-out",
};
const titleStyle = { fontWeight: 700, marginBottom: 4 };
const subStyle = { fontSize: 12, opacity: 0.8 };

export default function DashCard({ href = "#", title, subtitle, icon }) {
  return (
    <Link href={href} style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {icon ? <span style={{ fontSize: 18 }}>{icon}</span> : null}
        <div>
          <div style={titleStyle}>{title}</div>
          {subtitle ? <div style={subStyle}>{subtitle}</div> : null}
        </div>
      </div>
    </Link>
  );
}
