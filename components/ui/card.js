// /components/ui/card.js
export function Card({ color = "#1e293b", icon = "📦", title, children }) {
  return (
    <div
      style={{
        backgroundColor: "#0c121a",
        border: `1px solid ${color}`,
        borderRadius: "16px",
        padding: "20px",
        marginTop: "20px",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        maxWidth: "1320px",
      }}
    >
      <h3
        style={{
          fontSize: "18px",
          color,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <span>{icon}</span>
        {title}
      </h3>
      <div style={{ color: "#e2e8f0", fontSize: "15px" }}>{children}</div>
    </div>
  );
}
