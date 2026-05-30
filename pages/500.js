export default function Custom500() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        padding: 40,
      }}
    >
      <div
        style={{
          maxWidth: 600,
          textAlign: "center",
          background: "#111827",
          padding: 60,
          borderRadius: 16,
          border: "1px solid #1f2937",
        }}
      >
        <h1
          style={{
            fontSize: 48,
            fontWeight: 600,
            marginBottom: 20,
            color: "white",
          }}
        >
          500
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "#d1d5db",
            marginBottom: 30,
          }}
        >
          Something went wrong. Please try again.
        </p>

        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#22c55e",
            borderRadius: 8,
            color: "white",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

Custom500.disableLayout = true;