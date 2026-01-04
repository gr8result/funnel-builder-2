// components/Layout.js
export default function Layout({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0d10",
        color: "#e6edf3",
        padding: "16px",
      }}
    >
      <main style={{ maxWidth: 1400, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
